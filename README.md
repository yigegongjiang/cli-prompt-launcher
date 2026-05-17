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
jjlauncher [scene]                  Interactive REPL
jjlauncher [scene] 'prompt'         Single-shot (print)
jjlauncher -s [scene] 'prompt'      Single-shot + stream-JSON renderer
```

- 默认引擎 Claude Code: `jjlauncher d`. 前缀 `.` 走 Codex: `jjlauncher .d`.
- 无 scene 参数 → 使用 `scenes.default` (config).
- 内置 scene: `default` / `ai-expert` / `it-expert` / `code-expert` / `address`.
- 别名: `d`→`default`, `ai`→`ai-expert`, `it`→`it-expert`, `code`→`code-expert`.

### Prompt 传参

prompt 是单个位置参数, 用 shell 引号 (推荐单引号) 一行喂入. POSIX 单引号内除 `'` 外所有字符 (含换行) 字面保留, **零转义**:

```bash
jjlauncher d 'hello'

jjlauncher d '多行 prompt
含 $variable、"双引号"、反斜杠 \、特殊符号 ¥%&* 一概原样'

jjlauncher d "$(cat prompt.md)"     # 文件喂入 (shell 处理, jjlauncher 不需要 -f)
jjlauncher -s code 'review 这段 diff'

# 内容含 ' 时三种应对 (仍是单行):
jjlauncher d "I'm here"             # 切双引号
jjlauncher d 'I'\''m here'          # POSIX 经典拼接
jjlauncher d <<<"I'm here"          # here-string (bash/zsh)
```

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
