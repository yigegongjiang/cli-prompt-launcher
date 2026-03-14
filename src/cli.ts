import { parseInvocation, type Mode, UsageError } from "./parse";
import { runInvocation } from "./run";
import { listAllSceneNames } from "./scenes";
import { getConfigDir } from "./config";
import { ensureInitialized } from "./init";

ensureInitialized();

function buildHelpText(): string {
  const scenes = listAllSceneNames();
  const configDir = getConfigDir();

  return `CLI Prompt Launcher (Bun)

Usage:
  jj [scene]               Interactive mode
  jj -p [scene]            Non-interactive text mode (multiline input, :q to submit)
  jj -s [scene]            Stream mode (Claude stream-json; Codex exec --json events)
  jj -e [-p|-s] [scene]    Edit prompt with $EDITOR

Scenes:
  ${scenes.join(", ")}
  Default is Claude code, use . prefix for Codex, e.g. .d / .code

Config:
  ${configDir}/config.json    Launch arguments
  ${configDir}/scenes/*.md    Custom scenes
`;
}

const rawArgs = getRawArgs(process.argv);
const { mode, args, useEditor } = resolveCliMode(rawArgs);

try {
  const invocation = parseInvocation(mode, args, useEditor);
  const exitCode = await runInvocation(invocation);
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

function resolveCliMode(args: string[]): {
  args: string[];
  mode: Mode;
  useEditor: boolean;
} {
  if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    process.stdout.write(buildHelpText());
    process.exit(0);
  }

  if (args[0] === "--version" || args[0] === "-v") {
    process.stdout.write("0.1.0\n");
    process.exit(0);
  }

  let mode: Mode = "interactive";
  let useEditor = false;
  const filtered: string[] = [];

  for (const arg of args) {
    if (arg === "-e" || arg === "--editor") {
      useEditor = true;
      continue;
    }

    if (arg === "--print" || arg === "-p" || arg === "print") {
      mode = "print";
      continue;
    }

    if (arg === "--stream" || arg === "-s" || arg === "stream") {
      mode = "stream";
      continue;
    }

    filtered.push(arg);
  }

  return { args: filtered, mode, useEditor };
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
