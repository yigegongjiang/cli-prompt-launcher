import { createHash } from "node:crypto";
import { chmod, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { downloadWithProgress } from "./download";
import { DEFAULT_AUTO_MAX_ITER, parseInvocation, UsageError, type Invocation, type LoopSpec } from "./parse";
import { runInvocation } from "./run";
import { listAllSceneNames } from "./scenes";
import { getConfigDir } from "./config";
import { ensureInitialized } from "./init";
import {
  buildContinuePrompt,
  buildProtocolPrompt,
  createAutoLoopState,
  parseHandoff,
  snapshotState,
} from "./handoff";
import pkg from "../package.json" with { type: "json" };

// `build.ts` injects BUILD_* via `--define` at compile time.
// In dev (`bun run start`), they are undeclared; `typeof` is safe and falls back to package.json.
declare const BUILD_NAME: string | undefined;
declare const BUILD_VERSION: string | undefined;
declare const BUILD_REPO: string | undefined;

const NAME = typeof BUILD_NAME === "string" ? BUILD_NAME : pkg.name;
const VERSION = typeof BUILD_VERSION === "string" ? BUILD_VERSION : pkg.version;
const REPO = typeof BUILD_REPO === "string" ? BUILD_REPO : (pkg.repository ?? "");

function buildHelpText(): string {
  const scenes = listAllSceneNames();
  const configDir = getConfigDir();

  return `${NAME} ${VERSION} — Launch Claude Code or Codex with shared scene prompts

Usage:
  ${NAME} [scene]                       Interactive REPL
  ${NAME} [scene] 'prompt'              Single-shot run (print)
  ${NAME} -s [scene] 'prompt'           Single-shot run with stream-JSON renderer
  ${NAME} --loop N [scene] 'prompt'     Run the same single-shot N times serially
  ${NAME} --loop auto [scene] 'prompt'  Auto loop: agent emits a handoff each turn,
                                        stops when handoff.status="end" or after --max-iter

Auto-loop options:
  --max-iter N                          Safety cap for --loop auto (default ${DEFAULT_AUTO_MAX_ITER})

Prompt is a single positional argument. Use shell quoting for any complexity:
  ${NAME} d 'multi-line
prompt with $vars, "quotes", \\ backslashes — POSIX single-quote keeps it literal'

Scenes:
  ${scenes.join(", ")}
  Default is Claude Code, use . prefix for Codex, e.g. .d / .code

Meta commands:
  help, --help, -h            Show this help message
  version, --version, -v      Show version information
  update, upgrade             Download the latest release and replace this binary
  uninstall                   Remove this binary from disk

Config:
  ${configDir}/config.json    Launch arguments
  ${configDir}/scenes/*.md    Custom scenes
`;
}

function detectAsset(): string {
  if (process.platform !== "darwin") {
    throw new Error(`unsupported OS: ${process.platform} (only darwin is supported)`);
  }
  const a = process.arch;
  if (a !== "x64" && a !== "arm64") throw new Error(`unsupported arch: ${a}`);
  return `${NAME}-darwin-${a}`;
}

async function update(): Promise<number> {
  const assetName = detectAsset();
  const base = `https://github.com/${REPO}/releases/latest/download`;
  const assetUrl = `${base}/${assetName}`;
  const checksumsUrl = `${base}/checksums.txt`;
  const dest = process.execPath;
  if (basename(dest) !== NAME) {
    throw new Error(
      `refusing to self-update: current executable is "${basename(dest)}", expected "${NAME}". ` +
        `self-update only works on the installed binary, not when running from source via bun.`,
    );
  }

  console.log(`==> Updating ${NAME}`);
  console.log(`    repo:   ${REPO}`);
  console.log(`    target: ${dest}`);
  console.log(`    before: ${NAME} ${VERSION}`);

  console.log(`==> Downloading ${assetUrl}`);
  const assetBytes = await downloadWithProgress(assetUrl);

  // Verify checksum if checksums.txt exists for this release.
  try {
    const checksumsRes = await fetch(checksumsUrl, { redirect: "follow" });
    if (checksumsRes.ok) {
      const text = await checksumsRes.text();
      const line = text.split(/\r?\n/).find((l) => l.trim().endsWith(` ${assetName}`));
      if (line) {
        const expected = line.trim().split(/\s+/)[0]!.toLowerCase();
        const actual = createHash("sha256").update(assetBytes).digest("hex");
        if (expected !== actual) {
          console.error(`error: checksum mismatch (expected ${expected}, got ${actual})`);
          return 1;
        }
        console.log("==> Checksum OK");
      }
    }
  } catch {
    // Checksums are best-effort.
  }

  // Atomic replace via tmp on the same filesystem.
  await mkdir(dirname(dest), { recursive: true });
  const tmp = join(dirname(dest), `.${NAME}.update.${process.pid}`);
  await writeFile(tmp, assetBytes);
  await chmod(tmp, 0o755);
  try {
    await rename(tmp, dest);
  } catch (err: unknown) {
    await unlink(tmp).catch(() => {});
    throw err;
  }

  console.log(`==> Updated: ${dest}`);
  try {
    const r = Bun.spawnSync([dest, "version"]);
    if (r.success && r.stdout) {
      const after = new TextDecoder().decode(r.stdout).trim();
      if (after) console.log(`    after:  ${after}`);
    }
  } catch {
    // best-effort; if the new binary cannot exec, the replace itself already succeeded.
  }
  return 0;
}

async function uninstall(): Promise<number> {
  const dest = process.execPath;
  if (basename(dest) !== NAME) {
    throw new Error(
      `refusing to uninstall: current executable is "${basename(dest)}", expected "${NAME}". ` +
        `uninstall only works on the installed binary, not when running from source via bun.`,
    );
  }

  console.log(`==> Uninstalling ${NAME}`);
  console.log(`    target: ${dest}`);

  await unlink(dest);

  console.log(`==> Removed: ${dest}`);
  return 0;
}

async function handleMetaCommand(arg: string | undefined): Promise<number | null> {
  switch (arg) {
    case "help":
    case "--help":
    case "-h":
      process.stdout.write(buildHelpText());
      return 0;
    case "version":
    case "--version":
    case "-v":
      process.stdout.write(`${NAME} ${VERSION}\n`);
      return 0;
    case "update":
    case "upgrade":
      try {
        return await update();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`error: update failed: ${msg}`);
        return 1;
      }
    case "uninstall":
      try {
        return await uninstall();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`error: uninstall failed: ${msg}`);
        return 1;
      }
    default:
      return null;
  }
}

function parseFlags(args: string[]): { args: string[]; wantStream: boolean; loop: LoopSpec } {
  let wantStream = false;
  let loopValue: string | null = null;
  let maxIter = DEFAULT_AUTO_MAX_ITER;
  let sawMaxIter = false;
  const filtered: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--stream" || arg === "-s" || arg === "stream") {
      wantStream = true;
      continue;
    }
    if (arg === "--loop") {
      const next = args[i + 1];
      if (next === undefined) throw new UsageError('`--loop` requires a value (positive integer or "auto").');
      loopValue = next;
      i++;
      continue;
    }
    if (arg === "--max-iter") {
      const next = args[i + 1];
      if (next === undefined) throw new UsageError("`--max-iter` requires a positive integer value.");
      if (!/^\d+$/.test(next) || Number(next) < 1) {
        throw new UsageError(`Invalid --max-iter value "${next}". Expected a positive integer.`);
      }
      maxIter = Number(next);
      sawMaxIter = true;
      i++;
      continue;
    }
    filtered.push(arg);
  }

  let loop: LoopSpec = { kind: "fixed", count: 1 };
  if (loopValue !== null) {
    if (loopValue === "auto") {
      loop = { kind: "auto", maxIter };
    } else {
      if (!/^\d+$/.test(loopValue) || Number(loopValue) < 1) {
        throw new UsageError(`Invalid --loop value "${loopValue}". Expected a positive integer or "auto".`);
      }
      if (sawMaxIter) {
        throw new UsageError("`--max-iter` only applies to `--loop auto`.");
      }
      loop = { kind: "fixed", count: Number(loopValue) };
    }
  } else if (sawMaxIter) {
    throw new UsageError("`--max-iter` requires `--loop auto`.");
  }

  return { args: filtered, wantStream, loop };
}

function getRawArgs(argv: string[]): string[] {
  if (argv.length <= 1) {
    return [];
  }

  const second = argv[1];
  if (looksLikeScriptPath(second)) {
    return argv.slice(2);
  }

  return argv.slice(1);
}

function looksLikeScriptPath(value: string | undefined): boolean {
  if (!value || value.startsWith("-")) {
    return false;
  }

  if (value.startsWith("/$bunfs/")) {
    return true;
  }

  return /\.(?:[cm]?[jt]sx?)$/i.test(value);
}

async function runFixedLoop(invocation: Invocation, count: number): Promise<number> {
  let lastExit = 0;
  for (let i = 1; i <= count; i++) {
    if (count > 1) {
      process.stderr.write(`==> loop ${i}/${count}\n`);
    }
    lastExit = await runInvocation(invocation);
    if (lastExit !== 0) break;
  }
  return lastExit;
}

async function runAutoLoop(invocation: Invocation, maxIter: number): Promise<number> {
  if (!invocation.userText) {
    throw new UsageError("`--loop auto` requires a prompt argument.");
  }
  const originalPrompt = invocation.userText;
  const state = createAutoLoopState(maxIter);
  const protocolSuffix = buildProtocolPrompt(maxIter);

  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/handoff" || url.pathname === "/") {
        return new Response(JSON.stringify(snapshotState(state), null, 2), {
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      return new Response("Not Found", { status: 404 });
    },
  });

  process.stderr.write(
    `==> --loop auto (max ${maxIter}) — state: http://${server.hostname}:${server.port}/handoff\n`,
  );

  const stop = () => {
    try {
      server.stop(true);
    } catch {
      // best effort
    }
  };

  try {
    while (true) {
      if (state.stopRequested) break;
      if (state.iteration >= maxIter) {
        process.stderr.write(`==> --loop auto: max-iter ${maxIter} reached, stopping.\n`);
        break;
      }

      state.iteration += 1;
      state.updatedAt = Date.now();
      process.stderr.write(`==> loop ${state.iteration}/${maxIter} (auto)\n`);

      let accum = "";
      const onAgentText = (t: string) => {
        accum += t;
      };

      const promptOverride = state.handoff ? buildContinuePrompt(originalPrompt, state.handoff) : undefined;

      const exit = await runInvocation(invocation, {
        onAgentText,
        promptOverride,
        systemSuffix: protocolSuffix,
      });

      if (exit !== 0) {
        state.lastError = `child exited with code ${exit}`;
        state.updatedAt = Date.now();
        return exit;
      }

      const parsed = parseHandoff(accum);
      if (!parsed) {
        state.parseFailures += 1;
        state.lastError = `no handoff sentinel found in turn ${state.iteration}`;
        state.updatedAt = Date.now();
        process.stderr.write(
          `[warn] no handoff in turn ${state.iteration} (consecutive failures=${state.parseFailures})\n`,
        );
        if (state.parseFailures >= 3) {
          process.stderr.write(
            `==> --loop auto: ${state.parseFailures} consecutive parse failures, aborting.\n`,
          );
          return 3;
        }
        continue;
      }

      state.parseFailures = 0;
      state.handoff = parsed.handoff;
      state.rawHandoffText = parsed.raw;
      state.history.push(parsed.handoff);
      state.updatedAt = Date.now();
      state.lastError = undefined;

      process.stderr.write(
        `==> handoff status=${parsed.handoff.status}  summary="${parsed.handoff.summary}"\n`,
      );

      if (parsed.handoff.status === "end") {
        state.stopRequested = true;
        break;
      }
    }

    return 0;
  } finally {
    stop();
  }
}

const rawArgs = getRawArgs(process.argv);

const metaExit = await handleMetaCommand(rawArgs[0]);
if (metaExit !== null) process.exit(metaExit);

ensureInitialized();

try {
  const { args, wantStream, loop } = parseFlags(rawArgs);
  const invocation = parseInvocation(args, wantStream, loop);

  const exitCode =
    invocation.loop.kind === "auto"
      ? await runAutoLoop(invocation, invocation.loop.maxIter)
      : await runFixedLoop(invocation, invocation.loop.count);

  process.exit(exitCode);
} catch (error) {
  if (error instanceof UsageError) {
    process.stderr.write(`${error.message}\n\n${buildHelpText()}`);
    process.exit(2);
  }

  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
