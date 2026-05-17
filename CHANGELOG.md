# Changelog

[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) + [SemVer](https://semver.org/).

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

[0.3.0]: https://github.com/yigegongjiang/cli-prompt-launcher/compare/v0.1.0...v0.3.0
[0.1.0]: https://github.com/yigegongjiang/cli-prompt-launcher/releases/tag/v0.1.0
