import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";

const binaryPath = join(process.cwd(), "dist", "jj");
const packageName = "cli-prompt-launcher";

try {
  await access(binaryPath, constants.X_OK);
} catch {
  process.stderr.write("Executable dist/jj not found. Run `bun run build` first.\n");
  process.exit(1);
}

const tarballName = await packTarball();
const tarballPath = resolve(process.cwd(), "dist", tarballName);

await runCommand(["bun", "remove", "-g", packageName], true);
const exitCode = await runCommand(["bun", "install", "-g", tarballPath]);
process.exit(exitCode);

async function runCommand(cmd: string[], ignoreFailure = false): Promise<number> {
  const child = Bun.spawn({
    cmd,
    cwd: process.cwd(),
    env: process.env,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "ignore",
  });

  const exitCode = await child.exited;
  if (exitCode !== 0 && !ignoreFailure) {
    process.exit(exitCode);
  }

  return exitCode;
}

async function packTarball(): Promise<string> {
  const pack = Bun.spawn({
    cmd: ["bun", "pm", "pack", "--quiet", "--destination", "dist"],
    cwd: process.cwd(),
    env: process.env,
    stdout: "pipe",
    stderr: "inherit",
    stdin: "ignore",
  });

  const stdout = pack.stdout;
  if (!stdout || typeof stdout === "number") {
    process.stderr.write("Pack failed: could not capture tarball filename.\n");
    process.exit(1);
  }

  const tarballName = (await new Response(stdout).text()).trim();
  const exitCode = await pack.exited;

  if (exitCode !== 0 || tarballName.length === 0) {
    process.stderr.write("Pack failed: Bun returned no tarball filename.\n");
    process.exit(exitCode || 1);
  }

  return tarballName;
}
