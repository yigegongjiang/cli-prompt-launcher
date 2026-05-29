import { getConfiguredArgs } from "./config";
import { getSceneText } from "./scenes";
import { type Invocation } from "./parse";
import { ClaudeStreamFormatter } from "./format-claude-stream";
import { CodexStreamFormatter } from "./format-codex-stream";
import { renderLaunchPreview } from "./preview";
import { existsSync } from "node:fs";

const CLAUDE_BIN = "claude";
const CODEX_BIN = "codex";

export interface LaunchPlan {
  args: string[];
  binary: string;
  formatter: "claude-stream" | "codex-stream" | null;
  stdin: "ignore" | "inherit";
}

export interface RunOptions {
  // Receives every chunk of agent-emitted text after this turn's child has produced it.
  // - print mode: raw stdout bytes decoded as utf-8
  // - stream mode: text already rendered by the stream formatter
  // Used by `--loop auto` to scan for the handoff sentinel.
  onAgentText?: (text: string) => void;
  // Optional override of the prompt embedded in this turn (used by `--loop auto` to inject
  // <previous_handoff>...</previous_handoff> + <original_task>...</original_task>).
  promptOverride?: string;
  // Optional extra system-prompt suffix appended to the scene text (handoff protocol).
  systemSuffix?: string;
}

export async function runInvocation(invocation: Invocation, opts: RunOptions = {}): Promise<number> {
  return runCommand(buildLaunchPlan(invocation, opts), opts);
}

export function buildLaunchPlan(invocation: Invocation, opts: RunOptions = {}): LaunchPlan {
  const sceneText = getSceneText(invocation.sceneId) + (opts.systemSuffix ?? "");
  const isClaude = invocation.engine === "claude";
  const configArgs = getConfiguredArgs(invocation.engine, invocation.mode);

  const formatter: LaunchPlan["formatter"] =
    invocation.mode === "stream" ? (isClaude ? "claude-stream" : "codex-stream") : null;

  const userText = opts.promptOverride ?? invocation.userText;
  const args = buildFinalArgs(invocation, configArgs, sceneText, userText);

  return {
    args,
    binary: isClaude ? CLAUDE_BIN : CODEX_BIN,
    formatter,
    stdin: invocation.mode === "interactive" ? "inherit" : "ignore",
  };
}

function buildFinalArgs(invocation: Invocation, configArgs: string[], sceneText: string, userText: string | undefined): string[] {
  const isClaude = invocation.engine === "claude";
  const isCodexNonInteractive = !isClaude && invocation.mode !== "interactive";

  const args: string[] = [];

  if (isCodexNonInteractive) args.push("exec");

  args.push(...(isClaude ? sanitizeMcpConfig(configArgs) : configArgs));

  // Scene injection — structural binding, not user-configurable
  if (isClaude) {
    args.push("--append-system-prompt", sceneText);
  } else {
    args.push("-c", `developer_instructions=${JSON.stringify(sceneText)}`);
  }

  if (userText) {
    args.push(userText);
  } else if (isCodexNonInteractive) {
    args.push("");
  }

  return args;
}

/**
 * Drop non-existent `--mcp-config` file paths so a missing project `.mcp.json`
 * doesn't abort `claude` startup ("MCP config file not found"). Inline JSON
 * (starts with `{`) and existing files are kept; a `--mcp-config` left with no
 * surviving source is removed entirely. `--strict-mcp-config` is preserved —
 * with no `.mcp.json` it means "no MCP at all", matching the isolation intent.
 */
function sanitizeMcpConfig(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== "--mcp-config") {
      out.push(args[i]);
      continue;
    }
    // `--mcp-config <configs...>` is variadic: gather following non-flag tokens.
    const sources: string[] = [];
    let j = i + 1;
    for (; j < args.length && !args[j].startsWith("-"); j++) {
      sources.push(args[j]);
    }
    const kept = sources.filter((s) => s.trimStart().startsWith("{") || existsSync(s));
    if (kept.length > 0) out.push("--mcp-config", ...kept);
    i = j - 1; // skip consumed source tokens
  }
  return out;
}

// --- Single execution path ---

type LineProcessor = (line: string) => void;

function createLineProcessor(
  formatter: LaunchPlan["formatter"],
  onAgentText: ((text: string) => void) | undefined,
): LineProcessor | null {
  if (!formatter) return null;

  const fmt = formatter === "codex-stream" ? new CodexStreamFormatter() : new ClaudeStreamFormatter();

  return (line) => {
    try {
      const output = fmt.format(JSON.parse(line));
      if (output) {
        process.stdout.write(output);
        onAgentText?.(output);
      }
    } catch {
      const fallback = `${line}\n`;
      process.stdout.write(fallback);
      onAgentText?.(fallback);
    }
  };
}

async function runCommand(plan: LaunchPlan, opts: RunOptions): Promise<number> {
  const cmd = [plan.binary, ...plan.args];
  process.stderr.write(renderLaunchPreview(cmd));

  // Interactive (REPL): full inherit, no piping. Auto-loop never reaches this branch
  // (parse.ts rejects --loop on interactive invocations).
  if (plan.stdin === "inherit") {
    let child: ReturnType<typeof Bun.spawn>;
    try {
      child = Bun.spawn({
        cmd,
        env: process.env,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
    } catch (err) {
      throw new Error(spawnErrorMessage(plan.binary, err));
    }
    return await child.exited;
  }

  // Non-interactive: always pipe stdout so we can tee to terminal + scan for sentinel.
  const processLine = createLineProcessor(plan.formatter, opts.onAgentText);

  let child: ReturnType<typeof Bun.spawn>;
  try {
    child = Bun.spawn({
      cmd,
      env: process.env,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "inherit",
    });
  } catch (err) {
    throw new Error(spawnErrorMessage(plan.binary, err));
  }

  const stdout = child.stdout;
  if (!stdout || typeof stdout === "number") {
    return await child.exited;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  // A mid-stream error (broken pipe, decode failure, etc.) must not abort the
  // outer loop. Surface the error to stderr and let the child finish exiting so
  // the caller sees a real exit code rather than an exception bubble.
  try {
    for await (const chunk of stdout) {
      const text = decoder.decode(chunk, { stream: true });

      if (!processLine) {
        // print mode: raw text passthrough + feed scanner
        process.stdout.write(text);
        opts.onAgentText?.(text);
        continue;
      }

      // stream mode: split JSONL lines, hand each to formatter (which writes + feeds scanner)
      buffer += text;
      while (true) {
        const nl = buffer.indexOf("\n");
        if (nl === -1) break;

        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);

        if (line) processLine(line);
      }
    }

    const tail = buffer.trim();
    if (tail) {
      if (processLine) processLine(tail);
      else {
        process.stdout.write(tail);
        opts.onAgentText?.(tail);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[warn] stdout stream error from \`${plan.binary}\`: ${msg}\n`);
  }

  return await child.exited;
}

function spawnErrorMessage(binary: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const looksLikeMissing = /ENOENT|not found|no such file/i.test(msg);
  if (looksLikeMissing) {
    return `Failed to spawn \`${binary}\`: ${msg}. Make sure it is installed and available in PATH.`;
  }
  return `Failed to spawn \`${binary}\`: ${msg}`;
}
