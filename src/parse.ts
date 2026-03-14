import { getDefaultSceneId } from "./config";
import { resolveSceneToken, type Engine } from "./scenes";

export type Mode = "interactive" | "print" | "stream";

export interface Invocation {
  engine: Engine;
  mode: Mode;
  sceneId: string;
  useEditor: boolean;
  userText?: string;
}

export class UsageError extends Error {}

export function parseInvocation(mode: Mode, args: string[], useEditor = false): Invocation {
  if (args.length === 0) {
    return {
      engine: "claude",
      mode,
      sceneId: getDefaultSceneId(),
      useEditor,
    };
  }

  if (args.length > 1) {
    throw new UsageError("Accepts 0 or 1 scene argument; prompt is entered after launch.");
  }

  const resolvedScene = resolveSceneToken(args[0]);
  if (!resolvedScene) {
    throw new UsageError("Only scene arguments are supported; prompt is entered after launch.");
  }

  return {
    engine: resolvedScene.engine,
    mode,
    sceneId: resolvedScene.sceneId,
    useEditor,
  };
}
