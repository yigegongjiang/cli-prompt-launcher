// `--loop auto` handoff baton: agents emit a sentinel-wrapped JSON at the end
// of each turn; the parent process parses it to decide stop / continue and
// injects it into the next turn's user prompt. Each turn runs in a fresh child
// with no inherited history — the baton is the only cross-turn channel.

export const HANDOFF_BEGIN = "<<JJ_HANDOFF>>";
export const HANDOFF_END = "<<JJ_HANDOFF_END>>";

export type HandoffStatus = "end" | "continue";

export interface Handoff {
  status: HandoffStatus;
  iteration: number;
  summary: string;
  next_actions: string[];
  blockers: string[];
}

export interface AutoLoopState {
  iteration: number;
  maxIter: number;
  handoff?: Handoff;
  rawHandoffText?: string;
  parseFailures: number;
  stopRequested: boolean;
  lastError?: string;
  startedAt: number;
  updatedAt: number;
  history: Handoff[];
}

export function createAutoLoopState(maxIter: number): AutoLoopState {
  const now = Date.now();
  return {
    iteration: 0,
    maxIter,
    parseFailures: 0,
    stopRequested: false,
    startedAt: now,
    updatedAt: now,
    history: [],
  };
}

const SENTINEL_REGEX = new RegExp(
  `${escapeRegex(HANDOFF_BEGIN)}\\s*([\\s\\S]*?)\\s*${escapeRegex(HANDOFF_END)}`,
  "g",
);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Scan a stdout chunk (raw stream-json line text, or final assistant text)
// for the last well-formed handoff block. Returns null if none found.
export function parseHandoff(text: string): { handoff: Handoff; raw: string } | null {
  const matches = [...text.matchAll(SENTINEL_REGEX)];
  if (matches.length === 0) return null;

  const lastMatch = matches[matches.length - 1]!;
  const raw = lastMatch[1]!.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  const status = obj.status;
  if (status !== "end" && status !== "continue") return null;

  const iteration = typeof obj.iteration === "number" ? obj.iteration : 0;
  const summary = typeof obj.summary === "string" ? obj.summary : "";
  const next_actions = Array.isArray(obj.next_actions)
    ? obj.next_actions.filter((x): x is string => typeof x === "string")
    : [];
  const blockers = Array.isArray(obj.blockers)
    ? obj.blockers.filter((x): x is string => typeof x === "string")
    : [];

  return {
    handoff: { status, iteration, summary, next_actions, blockers },
    raw,
  };
}

// Appended to the system prompt (scene text) only when --loop auto is active.
export function buildProtocolPrompt(maxIter: number): string {
  return `

---

[JJ_LOOP_AUTO 协议 — 强制]

你处于"接力式"多轮循环 (本工程 --loop auto). 每一轮都是**独立的全新会话**, 不继承任何历史 — 像接力赛交棒, 不是马拉松. 跨轮唯一通道是一份 handoff JSON, 由你在本轮最终回复末尾输出, 父进程会把它注入下一轮的新 agent 作为 "previous_handoff" baton.

你必须在最终回复的**最后**单独成段输出, 不要解释这个机制:

${HANDOFF_BEGIN}
{
  "status": "end" | "continue",
  "iteration": <number, 当前轮次>,
  "summary": "本轮做了什么, ≤80字",
  "next_actions": ["下一轮 agent 应当继续的事 1", "..."],
  "blockers": ["如有阻塞列出, 否则空数组"]
}
${HANDOFF_END}

关于 status:
- **status="end" 的门槛极高**: 仅当你**对自己本轮的工作非常满意, 整体任务全部达成, 绝对不再需要后续 agent 介入**时才允许. 哪怕只剩一处不确定, 也要写 "continue".
- 其余一切情况 (有 next_actions / 有 blockers / 自己也不确定 / 只是"差不多") **必须** "continue".
- 上限保护: 父进程会在第 ${maxIter} 轮强制停止, 不要把这当作偷懒的理由.

关于 next_actions (接力式的核心):
- status="continue" 时**必须**非空且具体到可执行的动作
- 下一轮 agent 看不到你说过什么, 只看 next_actions, 写明白

handoff 之外的内容你可以正常工作 / 解释 / 用工具, 互不影响.
`;
}

// `--loop refine` protocol — emphasises full independence between turns.
// The next turn receives ONLY the original prompt, verbatim — no previous handoff,
// no next_actions, nothing. The only cross-turn signal consumed by the parent is
// the end/continue status bit.
export function buildRefineProtocolPrompt(maxIter: number): string {
  return `

---

[JJ_LOOP_REFINE 协议 — 强制]

你处于"打磨式"多轮循环 (本工程 --loop refine). 每一轮都是**完全独立的全新会话**, 不继承任何历史. **下一轮 agent 看不到你写的任何东西** — 它只会拿到与你完全相同的原始 prompt, 从零开始重做同一件事, 像同一块石头反复打磨.

跨轮唯一信号是你在最终回复末尾输出的一字段 JSON, 父进程**只读 status**.

你必须在最终回复的**最后**单独成段输出, 不要解释这个机制:

${HANDOFF_BEGIN}
{"status": "end" | "continue"}
${HANDOFF_END}

关于 status:
- **本模式偏向 end**. 你应当在本轮就把所有能做的事做完 — 不要"留给下一轮", 因为下一轮看不到你的任何笔记, 它会从零重做同一个 prompt.
- "status=end" 的含义: 你已尽全力, **对本轮工作非常满意**, 并且认为**再让一个零上下文的全新 agent 跑同样的 prompt 也不会找到更多有价值的改动**. 这才是 end.
- "status=continue" 的含义**仅**为: 你本轮已经尽力做完, 但仍然怀疑"换个全新视角 / 全新尝试, 可能能挖到更多东西". 这是表达"值得再来一次"的信号, 不是"任务清单还没做完".
- 上限保护: 父进程会在第 ${maxIter} 轮强制停止.

handoff 之外的内容你可以正常工作 / 解释 / 用工具, 互不影响.
`;
}

// Build the user prompt for round N (N >= 2). Round 1 uses the original prompt as-is.
export function buildContinuePrompt(originalPrompt: string, previous: Handoff): string {
  const baton = JSON.stringify(previous, null, 2);
  return `<previous_handoff>
${baton}
</previous_handoff>

<original_task>
${originalPrompt}
</original_task>

本轮是全新会话, 不知道任何之前的细节. 仅信任 previous_handoff. 按 next_actions 推进. 完成所有目标且对工作非常满意才写 status="end", 否则 "continue" 并填新的 next_actions.`;
}

export function snapshotState(state: AutoLoopState) {
  return {
    iteration: state.iteration,
    maxIter: state.maxIter,
    stopRequested: state.stopRequested,
    parseFailures: state.parseFailures,
    lastError: state.lastError,
    startedAt: new Date(state.startedAt).toISOString(),
    updatedAt: new Date(state.updatedAt).toISOString(),
    handoff: state.handoff,
    rawHandoffText: state.rawHandoffText,
    history: state.history,
  };
}
