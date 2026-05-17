# cli-prompt-launcher

`jjlauncher` 启动器: 把共享 scene prompt 注入 Claude Code / Codex. Bun 单文件可执行 (仅 macOS). 打 tag → GitHub Actions 自动构建并发布 release;用户用 `install.sh` 一键安装, 或通过内置 `update` 子命令自更新.

## 安装

```bash
curl -fsSL https://raw.githubusercontent.com/yigegongjiang/cli-prompt-launcher/main/install.sh | bash
```

依赖: `claude`、`codex` CLI 需另行安装并在 `PATH` 中.

默认装到 `$HOME/.local/bin`. 可用 `VERSION` / `INSTALL_DIR` / `REPO` 覆写.

## 用法

```
jjlauncher [scene]               Interactive mode (default)
jjlauncher -p [scene]            Print mode (multiline input, :q to submit)
jjlauncher -s [scene]            Stream mode (formatted Claude/Codex JSON events)
jjlauncher -e [-p|-s] [scene]    Edit prompt in $EDITOR first
```

- 默认引擎 Claude Code: `jjlauncher d`. 前缀 `.` 走 Codex: `jjlauncher .d`.
- 无 scene 参数 → 使用 `scenes.default` (config).
- 内置 scene: `default` / `ai-expert` / `it-expert` / `code-expert` / `address`.
- 别名: `d`→`default`, `ai`→`ai-expert`, `it`→`it-expert`, `code`→`code-expert`.

## 配置

首次运行自动初始化 `~/.config/cli-prompt-launcher/`:

```
config.json    引擎参数 (claude/codex args + interactive/print/stream 分模式覆写) + scene 别名
scenes/*.md    自定义 scene 文件 (首次运行内置 scene 落盘)
```

新增 scene: 在 `scenes/` 放 `foo.md`, 可在 `config.json` → `scenes.aliases` 加 `"f": "foo"`, 之后 `jjlauncher foo` / `jjlauncher f` / `jjlauncher .f` 均可用.

## 自更新 / 卸载

```bash
jjlauncher update      # 与 upgrade 等价, 拉取 latest release 并原子替换
jjlauncher uninstall   # 删除当前二进制
```

## 开发

```bash
bun install
bun run start                 # 源码运行 (update/uninstall 子命令会被守卫拒绝)
bun run build                 # 编译双架构 → dist/jjlauncher-darwin-{arm64,x64}
bun run typecheck
```

子命令: `help` / `-h` / `--help`, `version` / `-v` / `--version`, `update` / `upgrade`, `uninstall`.

## 发布

推 `v*` tag 即触发 `.github/workflows/release.yml`, 构建 + 生成 `checksums.txt` + 创建 Release. 详见 [deploy.md](./deploy.md).

```bash
git tag -a v0.3.0 -m "v0.3.0"
git push origin v0.3.0
```
