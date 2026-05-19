import { getDefaultSceneId } from "./config";
import { resolveSceneToken, type Engine } from "./scenes";

export type Mode = "interactive" | "print" | "stream";

export type LoopSpec =
  | { kind: "fixed"; count: number }
  | { kind: "auto"; maxIter: number }
  | { kind: "refine"; maxIter: number };

export interface Invocation {
  engine: Engine;
  mode: Mode;
  sceneId: string;
  userText?: string;
  // When the original prompt contains `<<>>`, it is split into ≥2 non-empty segments
  // and executed sequentially as independent single-shots. `userText` holds the first
  // segment for backwards-compatible reads; `userTexts` is the actual trigger for
  // serial execution.
  userTexts?: string[];
  loop: LoopSpec;
}

export class UsageError extends Error {}

export const DEFAULT_AUTO_MAX_ITER = 100;

export const PROMPT_SEPARATOR = "<<>>";
const SEPARATOR_SPLIT_RE = /\s*<<>>\s*/;

function splitPrompt(prompt: string): string[] {
  if (!prompt.includes(PROMPT_SEPARATOR)) return [prompt];
  return prompt.split(SEPARATOR_SPLIT_RE);
}

export function parseInvocation(args: string[], wantStream: boolean, loop: LoopSpec): Invocation {
  if (args.length > 2) {
    throw new UsageError("Too many arguments. Usage: jjlauncher [scene] [prompt]");
  }

  // 0 args → REPL with default scene
  if (args.length === 0) {
    if (wantStream) throw new UsageError("`-s` requires a prompt argument.");
    if (loop.kind !== "fixed" || loop.count > 1) {
      throw new UsageError("`--loop` requires a prompt argument (interactive mode is not loopable).");
    }
    return {
      engine: "claude",
      mode: "interactive",
      sceneId: getDefaultSceneId(),
      loop: { kind: "fixed", count: 1 },
    };
  }

  const resolved = resolveSceneToken(args[0]);
  if (!resolved) {
    throw new UsageError(`Unknown scene: "${args[0]}".`);
  }

  // 1 arg → REPL with given scene
  if (args.length === 1) {
    if (wantStream) throw new UsageError("`-s` requires a prompt argument.");
    if (loop.kind !== "fixed" || loop.count > 1) {
      throw new UsageError("`--loop` requires a prompt argument (interactive mode is not loopable).");
    }
    return {
      engine: resolved.engine,
      mode: "interactive",
      sceneId: resolved.sceneId,
      loop: { kind: "fixed", count: 1 },
    };
  }

  // 2 args → scene + prompt, single-shot or loop
  const prompt = args[1];
  if (prompt.length === 0) throw new UsageError("Empty prompt.");

  const segments = splitPrompt(prompt);
  const isSplit = segments.length > 1;

  if (isSplit) {
    if (segments.some((s) => s.length === 0)) {
      throw new UsageError(
        `Empty segment between \`${PROMPT_SEPARATOR}\` markers. Each segment must be non-empty.`,
      );
    }
    if (loop.kind !== "fixed" || loop.count !== 1) {
      throw new UsageError(
        `Prompt with \`${PROMPT_SEPARATOR}\` is split into sequential steps and cannot combine with \`--loop\`.`,
      );
    }
  }

  return {
    engine: resolved.engine,
    mode: wantStream ? "stream" : "print",
    sceneId: resolved.sceneId,
    userText: segments[0],
    userTexts: isSplit ? segments : undefined,
    loop,
  };
}
