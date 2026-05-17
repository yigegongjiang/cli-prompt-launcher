import { getDefaultSceneId } from "./config";
import { resolveSceneToken, type Engine } from "./scenes";

export type Mode = "interactive" | "print" | "stream";

export interface Invocation {
  engine: Engine;
  mode: Mode;
  sceneId: string;
  userText?: string;
}

export class UsageError extends Error {}

export function parseInvocation(args: string[], wantStream: boolean): Invocation {
  if (args.length > 2) {
    throw new UsageError("Too many arguments. Usage: jjlauncher [scene] [prompt]");
  }

  // 0 args → REPL with default scene
  if (args.length === 0) {
    if (wantStream) throw new UsageError("`-s` requires a prompt argument.");
    return {
      engine: "claude",
      mode: "interactive",
      sceneId: getDefaultSceneId(),
    };
  }

  const resolved = resolveSceneToken(args[0]);
  if (!resolved) {
    throw new UsageError(`Unknown scene: "${args[0]}".`);
  }

  // 1 arg → REPL with given scene
  if (args.length === 1) {
    if (wantStream) throw new UsageError("`-s` requires a prompt argument.");
    return {
      engine: resolved.engine,
      mode: "interactive",
      sceneId: resolved.sceneId,
    };
  }

  // 2 args → scene + prompt, single-shot
  const prompt = args[1];
  if (prompt.length === 0) throw new UsageError("Empty prompt.");

  return {
    engine: resolved.engine,
    mode: wantStream ? "stream" : "print",
    sceneId: resolved.sceneId,
    userText: prompt,
  };
}
