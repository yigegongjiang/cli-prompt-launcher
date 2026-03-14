import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getConfigDir, DEFAULT_CONFIG } from "./config";
import { BUILTIN_SCENE_TEXTS } from "./scenes";

export function ensureInitialized(): void {
  const configDir = getConfigDir();
  const configFile = join(configDir, "config.json");

  if (existsSync(configFile)) return;

  const scenesDir = join(configDir, "scenes");
  mkdirSync(scenesDir, { recursive: true });

  writeFileSync(configFile, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");

  for (const [name, text] of Object.entries(BUILTIN_SCENE_TEXTS)) {
    const scenePath = join(scenesDir, `${name}.md`);
    if (!existsSync(scenePath)) {
      writeFileSync(scenePath, text);
    }
  }

  process.stderr.write(`Initialized config: ${configDir}\n`);
}
