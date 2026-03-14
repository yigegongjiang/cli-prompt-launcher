import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

const mode = process.argv[2] ?? "host";
const distDir = join(process.cwd(), "dist");

const targets =
  mode === "release"
    ? [
        { name: "jj", target: null },
        { name: "jj-darwin-arm64", target: "bun-darwin-arm64" },
        { name: "jj-darwin-x64", target: "bun-darwin-x64" },
      ]
    : [{ name: "jj", target: null }];

await cleanupBunBuildArtifacts();
await rm(distDir, { force: true, recursive: true });
await mkdir(distDir, { recursive: true });

for (const buildTarget of targets) {
  const args = [
    "build",
    "--compile",
    "--outfile",
    join(distDir, buildTarget.name),
    "--no-compile-autoload-dotenv",
    "--no-compile-autoload-bunfig",
    "--no-compile-autoload-package-json",
  ];

  if (buildTarget.target) {
    args.push("--target", buildTarget.target);
  }

  args.push("src/cli.ts");

  const child = Bun.spawn({
    cmd: ["bun", ...args],
    cwd: process.cwd(),
    env: process.env,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "ignore",
  });

  const exitCode = await child.exited;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

await cleanupBunBuildArtifacts();

async function cleanupBunBuildArtifacts(): Promise<void> {
  const entries = await readdir(process.cwd(), { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".bun-build"))
      .map((entry) => rm(join(process.cwd(), entry.name), { force: true })),
  );
}
