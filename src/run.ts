import { createInterface } from "node:readline/promises";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getConfiguredArgs } from "./config";
import { getSceneText } from "./scenes";
import { UsageError, type Invocation } from "./parse";
import { ClaudeStreamFormatter } from "./format-claude-stream";
import { CodexStreamFormatter } from "./format-codex-stream";
import { renderLaunchPreview } from "./preview";

const CLAUDE_BIN = "claude";
const CODEX_BIN = "codex";

export interface LaunchPlan {
  args: string[];
  binary: string;
  formatter: "claude-stream" | "codex-stream" | null;
  stdin: "ignore" | "inherit";
}

export async function runInvocation(invocation: Invocation): Promise<number> {
  const needsInput = invocation.mode !== "interactive" || invocation.useEditor;
  const resolvedInvocation = needsInput
    ? {
        ...invocation,
        userText: await readUserTextFromTerminal(invocation.useEditor),
      }
    : invocation;

  const plan = buildLaunchPlan(resolvedInvocation);

  return runCommand(plan);
}

export function buildLaunchPlan(invocation: Invocation): LaunchPlan {
  const sceneText = getSceneText(invocation.sceneId);
  const isClaude = invocation.engine === "claude";
  const configArgs = getConfiguredArgs(invocation.engine, invocation.mode);

  const formatter: LaunchPlan["formatter"] =
    invocation.mode === "stream" ? (isClaude ? "claude-stream" : "codex-stream") : null;

  const args = buildFinalArgs(invocation, configArgs, sceneText);

  return {
    args,
    binary: isClaude ? CLAUDE_BIN : CODEX_BIN,
    formatter,
    stdin: invocation.mode === "interactive" ? "inherit" : "ignore",
  };
}

function buildFinalArgs(invocation: Invocation, configArgs: string[], sceneText: string): string[] {
  const isClaude = invocation.engine === "claude";
  const isCodexNonInteractive = !isClaude && invocation.mode !== "interactive";

  const args: string[] = [];

  if (isCodexNonInteractive) args.push("exec");

  args.push(...configArgs);

  // Scene injection — structural binding, not user-configurable
  if (isClaude) {
    args.push("--append-system-prompt", sceneText);
  } else {
    args.push("-c", `developer_instructions=${JSON.stringify(sceneText)}`);
  }

  if (invocation.userText) {
    args.push(invocation.userText);
  } else if (isCodexNonInteractive) {
    args.push("");
  }

  return args;
}

// --- Single execution path ---

type LineProcessor = (line: string) => void;

function createLineProcessor(formatter: LaunchPlan["formatter"]): LineProcessor | null {
  if (!formatter) return null;

  const fmt = formatter === "codex-stream" ? new CodexStreamFormatter() : new ClaudeStreamFormatter();

  return (line) => {
    try {
      const output = fmt.format(JSON.parse(line));
      if (output) process.stdout.write(output);
    } catch {
      process.stdout.write(`${line}\n`);
    }
  };
}

async function runCommand(plan: LaunchPlan): Promise<number> {
  const processLine = createLineProcessor(plan.formatter);
  const cmd = [plan.binary, ...plan.args];

  process.stderr.write(renderLaunchPreview(cmd));

  let child: ReturnType<typeof Bun.spawn>;
  try {
    child = Bun.spawn({
      cmd,
      env: process.env,
      stdin: plan.stdin,
      stdout: processLine ? "pipe" : "inherit",
      stderr: "inherit",
    });
  } catch {
    throw new Error(`Command \`${plan.binary}\` not found. Make sure it is installed and available in PATH.`);
  }

  if (!processLine) {
    return await child.exited;
  }

  const stdout = child.stdout;
  if (!stdout || typeof stdout === "number") {
    return await child.exited;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of stdout) {
    buffer += decoder.decode(chunk, { stream: true });

    while (true) {
      const nl = buffer.indexOf("\n");
      if (nl === -1) break;

      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);

      if (line) processLine(line);
    }
  }

  const lastLine = buffer.trim();
  if (lastLine) processLine(lastLine);

  return await child.exited;
}

async function readUserTextFromTerminal(useEditor: boolean): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new UsageError("Non-interactive mode requires a TTY for prompt input.");
  }

  let userText: string;

  if (useEditor) {
    const editor =
      process.env.VISUAL ||
      process.env.EDITOR ||
      ["nvim", "vim", "vi"].find(
        (b) =>
          Bun.spawnSync({
            cmd: ["which", b],
            stdout: "ignore",
            stderr: "ignore",
          }).exitCode === 0,
      ) ||
      "vi";
    const tmpFile = join(tmpdir(), `jj-${process.pid}-${Date.now()}.md`);
    await Bun.write(tmpFile, "");
    try {
      const child = Bun.spawn({
        cmd: ["sh", "-c", `${editor} "$0"`, tmpFile],
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      if ((await child.exited) !== 0) throw new UsageError("Editor exited with non-zero status.");
      userText = (await Bun.file(tmpFile).text()).trim();
    } finally {
      await unlink(tmpFile).catch(() => {});
    }
  } else {
    process.stderr.write("\x1b[2m(Enter for newline, :q to submit)\x1b[0m\n");
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
      prompt: "> ",
    });
    rl.prompt();
    const lines: string[] = [];
    for await (const line of rl) {
      const ch = line.trimStart()[0];
      if (ch === ":" || ch === "：") {
        rl.close();
        break;
      }
      lines.push(line);
      rl.prompt();
    }
    userText = lines.join("\n").trim();
  }

  if (userText.length === 0) throw new UsageError("Empty prompt.");
  return userText;
}
