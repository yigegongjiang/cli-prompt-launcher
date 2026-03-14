import addressScene from "../scenes/address.md" with { type: "text" };
import aiExpertScene from "../scenes/ai-expert.md" with { type: "text" };
import codeExpertScene from "../scenes/code-expert.md" with { type: "text" };
import defaultScene from "../scenes/default.md" with { type: "text" };
import itExpertScene from "../scenes/it-expert.md" with { type: "text" };

import { getConfigDir, getUserSceneAliases, isInitialized, loadUserScenes } from "./config";

export type Engine = "claude" | "codex";

// Built-in scene texts — only used as seed data by init.ts
export const BUILTIN_SCENE_TEXTS: Record<string, string> = {
  address: addressScene,
  "ai-expert": aiExpertScene,
  "code-expert": codeExpertScene,
  default: defaultScene,
  "it-expert": itExpertScene,
};

// Built-in aliases — fallback only when config dir has not been initialized
const BUILTIN_ALIASES: Record<string, string> = {
  address: "address",
  ai: "ai-expert",
  "ai-expert": "ai-expert",
  code: "code-expert",
  "code-expert": "code-expert",
  d: "default",
  default: "default",
  it: "it-expert",
  "it-expert": "it-expert",
};

export interface ResolvedScene {
  engine: Engine;
  sceneId: string;
}

export function resolveSceneToken(token: string | undefined | null): ResolvedScene | null {
  if (!token) return null;

  const engine: Engine = token.startsWith(".") ? "codex" : "claude";
  const rawScene = engine === "codex" ? token.slice(1) : token;
  const sceneKey = rawScene === "" ? "d" : rawScene;

  // 1. config aliases (primary after init)
  const aliases = getUserSceneAliases();
  const aliasTarget = aliases[sceneKey];
  if (aliasTarget) {
    return { engine, sceneId: aliasTarget };
  }

  // 2. config scene files
  if (loadUserScenes().has(sceneKey)) {
    return { engine, sceneId: sceneKey };
  }

  // 3. built-in fallback (only when not yet initialized)
  if (!isInitialized()) {
    const builtinId = BUILTIN_ALIASES[sceneKey];
    if (builtinId) {
      return { engine, sceneId: builtinId };
    }
  }

  return null;
}

export function getSceneText(sceneId: string): string {
  // 1. config scene files (primary)
  const userText = loadUserScenes().get(sceneId);
  if (userText !== undefined) return userText;

  // 2. built-in fallback (only when not yet initialized)
  if (!isInitialized()) {
    const builtinText = BUILTIN_SCENE_TEXTS[sceneId];
    if (builtinText !== undefined) return builtinText;
  }

  throw new Error(`Scene "${sceneId}" not found. Check ${getConfigDir()}/scenes/ directory.`);
}

export function listAllSceneNames(): string[] {
  const names = new Set<string>();

  if (isInitialized()) {
    for (const key of Object.keys(getUserSceneAliases())) names.add(key);
    for (const key of loadUserScenes().keys()) names.add(key);
  } else {
    for (const key of Object.keys(BUILTIN_ALIASES)) names.add(key);
  }

  return [...names].sort();
}
