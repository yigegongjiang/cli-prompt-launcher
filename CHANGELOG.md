# Changelog

[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) + [SemVer](https://semver.org/).

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

[0.4.0]: https://github.com/yigegongjiang/cli-prompt-launcher/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/yigegongjiang/cli-prompt-launcher/compare/v0.1.0...v0.3.0
[0.1.0]: https://github.com/yigegongjiang/cli-prompt-launcher/releases/tag/v0.1.0
