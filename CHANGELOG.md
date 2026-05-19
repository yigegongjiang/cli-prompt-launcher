# Changelog

[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) + [SemVer](https://semver.org/).

## [0.9.0] - 2026-05-19

### Changed

- **Breaking**: 非交互单跑的默认输出从 raw `print` 翻转为 `stream-JSON` 渲染. `jjlauncher [scene] 'prompt'` 现在直接走原 `-s` 路径 (`ClaudeStreamFormatter` / `CodexStreamFormatter` 渲染 stream-json). 理由: 实际使用中 stream 形态体验明显优于 raw stdout (有进度/分段/工具调用可见), 应该作为默认; `-s` 长期只是一个"我每次都得加"的肌肉记忆 flag, 与"无 flag 推导 mode"的设计意图相悖.

### Added

- 标志 `-p` / `--print` / `print`: 显式切回 raw print 透传模式 (不走 stream formatter). 与 v0.4.0 删除前的语义一致, 但定位反转 — 从"默认"降级为"按需". 兼容 `--loop` / `<<>>` 顺序分段等所有现有组合.

### Removed

- 标志 `-s` / `--stream` / `stream`: 默认即 stream, flag 冗余 (思路同 v0.4.0 删除 `-p`). 显式带 `-s` 会被当成未知 scene 报错 — 直接去掉即可.

## [0.8.0] - 2026-05-19

### Added

- prompt 顺序分段: 在 prompt 中嵌入 `<<>>` (空双尖括号) 即把 prompt 拆成 N 段独立 single-shot 串行执行, 每段一个全新 child, 零跨轮状态. 无需新增 flag — 直接 `jjlauncher d 'step 1 <<>> step 2 <<>> step 3'`. 分隔符两侧空白被吃掉; 至少 2 段且每段非空否则 UsageError. 与 `--loop N (N>1)` / `--loop auto` / `--loop refine` 互斥 (语义复合度过高, 先简单实现). stderr 标 `==> step i/N` 进度. 选 `<<>>` 而非 `<>`: 后者在 HTML/SQL/英文写作中频繁出现会误触发; `<<>>` 在主流编程语言/英文文档中几乎不存在, 视觉对称, shell 单引号下零转义, 与已有 `<<JJ_HANDOFF>>` sentinel 风格一致.
- 稳定性: 任一段 child 非 0 退出或 spawn 异常都仅打 `[warn]` 并继续下一段, 跑满全部段后返回最后一段 exit code — 与 fixed loop 的"绝对稳定"语义对齐.

## [0.7.2] - 2026-05-19

### Fixed

- `--loop N` (fixed 模式) 第 1 轮 child 非 0 退出会直接 break, 后续轮次丢失 — 用户原意"跑满 N 次"被违背. 现在任意一轮 exit≠0 或 `runInvocation` 抛异常都只打 `[warn]` 并继续下一轮, loop 必跑满 N 次, 返回最后一轮的 exit code.
- `--loop auto` / `--loop refine` 子进程 exit≠0 时立即 `return exit` 中断整个循环 — 与 fixed 模式行为不一致, 单轮抖动就让多轮自动化 game over. 现在同样 warn-continue, 由 `--max-iter` 或 `status="end"` 唯一决定终止.

### Changed

- 移除 `--loop auto/refine` "连续 3 次 handoff 解析失败 abort" 硬规则 (原退出码 3). 由 `--max-iter` 兜底, 与"绝对稳定, 要么执行要么不执行"的循环承诺一致.
- handoff 解析失败时 stderr 新增 `agent_output_tail="..."` (LLM 输出末尾 400 字符, 换行转义), 便于排查"为什么没出 sentinel". 同时所有 loop 警告统一格式 `[warn] loop i/N (mode): ...; proceeding to next iteration.`.
- `Bun.spawn` 异常不再一律改写成"Command not found", 保留 ENOENT / EACCES 等原始 errno, 仅在确认是"找不到"时才追加 PATH 提示.
- 子进程 stdout 流读取加 try/catch — 中途断流 / 解码失败不再冒泡到外层 loop, 让 child 正常 exit 返回真实 code.
- `runAgentLoop` 全程零成功 handoff 时返回退出码 4 (新), 并打 `[error]` 总结日志. 至少有一次成功 handoff 的运行仍返回 0.

## [0.7.1] - 2026-05-17

### Changed

- `--loop refine` handoff schema 收敛到极简: `{"status": "end" | "continue"}` 一字段. 移除 `iteration` (父进程自己已经在数, agent 在 refine 模式下根本不知道自己第几轮, 写的值要么瞎填要么被覆盖) 与 `summary` (没有任何下一轮 agent 会读, 仅 `/handoff` 端点可见的人工观察功能弱于其带来的 agent 写作摩擦). `parseHandoff` 对缺失字段自动 fallback (`iteration→0`, `summary→""`, 数组→`[]`), 完全向后兼容.

## [0.7.0] - 2026-05-17

### Added

- `--loop refine` 打磨式自动循环: 与 `--loop auto` 并列的第二种自动模式. 每轮跑全新独立 child, 但**只把原始 prompt 原文喂给下一轮** — 不注入 previous_handoff / next_actions / summary, 跨轮唯一信号是 agent 自决的 end/continue 状态位. 适用"同一 prompt 反复独立打磨"场景 (大项目优化、refactor 试验等), agent 在每轮以全新视角重做同一件事, 像同一块石头反复打磨. CLI: `jjlauncher --loop refine [scene] 'prompt'`, 复用 `--max-iter` 与 `/handoff` 端点.
- `/handoff` 端点响应新增 `mode` 字段 (`"auto"` / `"refine"`), 便于 curl 时识别当前模式.

### Changed

- `--loop auto` 协议片段措辞微调: 显式自称"接力式", 把 next_actions 标注为"接力式的核心", 与 refine 的"打磨式"形成对仗. 行为不变.
- 两模式的协议片段完全隔离, 互不引用对方 — refine 协议中**不再提及 auto / next_actions / blockers**, 让 agent 在各自模式下心智模型纯净.

## [0.6.0] - 2026-05-17

### Added

- 自动循环 `--loop auto`: 每轮跑全新独立 child (无历史/无 resume), agent 在最终回复末尾以 `<<JJ_HANDOFF>>...<<JJ_HANDOFF_END>>` 输出 JSON baton (status/iteration/summary/next_actions/blockers). 父进程解析后注入下一轮 system prompt 的 `<previous_handoff>`, 直到 status=end 或达 `--max-iter` (默认 100). 协议片段由 jjlauncher 自动追加到 scene system prompt, 不污染普通模式. end 门槛要求 agent "对自身工作非常满意, 绝对不需后续 agent 介入".
- 本地观察端点: `--loop auto` 启动时 stderr 打印 `http://127.0.0.1:<port>/handoff`, 暴露 iteration/handoff/history JSON 快照, 进程退出自动关闭, 零文件落盘.
- 退出码: end → 0; max-iter → 0 + 警告; 子进程非 0 → 透传; 连续 3 轮 handoff 解析失败 → 3.

### Changed

- print 模式 stdout 从 `inherit` 改为 `pipe` + 透传, 以便父进程在 `--loop auto` 下扫 sentinel. 原有人眼输出体验不变.

## [0.5.0] - 2026-05-17

### Added

- 循环执行: `--loop N`. 把同一条 single-shot 串行重跑 N 次, 等上一次 child 退出再启下一次. 任一非 0 立即中止并以该退出码返回; preview 与循环序号 (`==> loop i/N`) 每次打印. 仅在带 prompt 的非交互场景可用, REPL / 缺 prompt / 非正整数会直接报错.

## [0.4.0] - 2026-05-17

### Changed

- **Breaking**: prompt 改为位置参数, 一行命令直接喂入: `jjlauncher [scene] 'prompt'`. 依赖 shell 引号 (POSIX 单引号支持跨行 / 特殊符号 / 零转义), 等同 `git commit -m` / `curl -d` / `claude -p` 的标准做法.
- mode 由参数推导: 无 prompt → REPL; 有 prompt → print; 有 prompt + `-s` → stream.
- `install.sh` asset 下载改用 `curl --progress-bar` (去掉 `-s` silent), 与 `update` 子命令的进度反馈 UX 对齐. checksums.txt 等小文件仍保持静默. (偏离 cli-template 的"安装静默 / 更新有进度"组合, 选择两端一致.)

### Removed

- 标志 `-p` / `--print` / `print`: 由"是否有 prompt 参数"自动判定, 显式标志冗余.
- 标志 `-e` / `--editor`: prompt 通过 shell 引号即可, 编辑器路径无价值.
- 多行交互输入 (`:q` 提交) 与 `readUserTextFromTerminal` 整段: 输入路径只保留 argv 一条, 删除所有交互兜底, 便于脚本/CI 调用.
- `config.json` 中 `interactive` / `print` / `stream` 段的输入语义不变, 仅触发方式从显式 flag 改为参数推导.

## [0.3.0] - 2026-05-17

### Added

- 子命令 `update` / `upgrade`: 从 GitHub Release 拉取最新二进制并原子替换 (含进度条、SHA256 校验、`before` / `after` 版本对照).
- 子命令 `uninstall`: 删除当前安装的二进制.
- `install.sh`: 一键安装脚本, 支持 `VERSION` / `INSTALL_DIR` / `REPO` 覆写, 校验 `checksums.txt`.
- `.github/workflows/release.yml`: tag 触发自动构建 + 发布 Release (含 SHA256 checksums).
- 顶层 `build.ts` 通过 `--define` 注入 `BUILD_NAME` / `BUILD_VERSION` / `BUILD_REPO` 到二进制.
- `AGENTS.md`: 工程级 AI 协作文档 (AI-only 声明、命名例外说明、边界、运行时配置).

### Changed

- **Breaking**: binary 名 `jj` → `jjlauncher` (`package.json#name` / `install.sh#BIN_NAME` / `build.ts` 产物名同步; 安装路径 `$INSTALL_DIR/jjlauncher`). 旧 `jj` 二进制需手动删除. 配置目录 `~/.config/cli-prompt-launcher/` 保持不变.
- 工程结构对齐 cli-template: `build.ts` 移至顶层、`tsconfig.json` 启用严格选项 (`verbatimModuleSyntax` / `noUnusedLocals` 等)、`.gitignore` 完整化.
- 安装方式: 从 `bun install -g` 切换到 GitHub Release + `install.sh`.
- `deploy.md`: tag 命令改为 annotated (`git tag -a -m`) + 加入 `tag.gpgsign=true` 与 amend 后 tag/commit 同步的解释 (对齐 cli-template v0.2.1).
- AI-only 声明仅在 `AGENTS.md`, `README.md` 只保留用户向内容.

### Removed

- 旧 `scripts/install-global.ts` (打 tarball + `bun install -g` 流程).
- `features/bun-migration.md` (任务已完成).
- `example/config.json` (与 `DEFAULT_CONFIG` 冗余, 配置文档化在 README + 首次运行自动生成).
- 未使用依赖 `@anthropic-ai/sdk`、`@modelcontextprotocol/sdk`、`@types/node`、`bun-types` (改用 `@types/bun`).
- `LICENSE` (派生模板不保留 LICENSE).

## [0.1.0] - 2026-03-15

### Added

- 三种运行模式: `jj [scene]` 交互、`jj -p [scene]` 文本输入 (`:q` 提交)、`jj -s [scene]` 流式 JSON.
- Codex 前缀 `.` (例: `jj .d` 走 Codex).
- 内置 scene: `default` / `ai-expert` / `it-expert` / `code-expert` / `address`.
- 首次运行初始化 `~/.config/cli-prompt-launcher/`.
- Claude / Codex 流事件格式化输出 (`ClaudeStreamFormatter` / `CodexStreamFormatter`).

[0.9.0]: https://github.com/yigegongjiang/cli-prompt-launcher/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/yigegongjiang/cli-prompt-launcher/compare/v0.7.2...v0.8.0
[0.7.2]: https://github.com/yigegongjiang/cli-prompt-launcher/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/yigegongjiang/cli-prompt-launcher/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/yigegongjiang/cli-prompt-launcher/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/yigegongjiang/cli-prompt-launcher/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/yigegongjiang/cli-prompt-launcher/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/yigegongjiang/cli-prompt-launcher/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/yigegongjiang/cli-prompt-launcher/compare/v0.1.0...v0.3.0
[0.1.0]: https://github.com/yigegongjiang/cli-prompt-launcher/releases/tag/v0.1.0
