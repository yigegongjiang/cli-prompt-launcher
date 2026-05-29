# Claude Code CLI flags 速查 (v2.1.156)

> 来源: 官方 [CLI reference](https://code.claude.com/docs/en/cli-reference) + 本地 `claude --help` (binary `2.1.156`), 抓取于 2026-05-29.
> 官方文档声明 `claude --help` 不全, 下表取**二者并集**.
>
> 标注: 无 = 两处都有 · `(docs)` 仅官方文档 · `(help)` 仅本地 help · `✦` jjlauncher 已用/结构占用 · `仅-p` 只在 print 生效 (被 stream 槽位继承).

## 1. 会话生命周期

<!-- prettier-ignore -->
| Flag | 值 | 说明 |
|---|---|---|
| `-c, --continue` | — | 继续当前目录最近一次会话 |
| `-r, --resume` | id/name | 按 ID/名恢复, 或开交互选择器 |
| `--fork-session` | — | 恢复时新建 session ID (配 `-r`/`-c`) |
| `--session-id` | UUID | 指定会话 ID |
| `--from-pr` | PR号/URL | 恢复与 PR 关联的会话 |
| `-n, --name` | 字符串 | 会话显示名 (`/resume`、终端标题可见) |
| `--no-session-persistence` | — | 不落盘、不可恢复 (仅-p) |
| `--teleport` (docs) | — | 把 web 会话拉到本地终端 |
| `--remote` (docs) | 字符串 | 在 claude.ai 新建 web 会话 |

## 2. 非交互 / 输出 (headless)

<!-- prettier-ignore -->
| Flag | 值 | 说明 |
|---|---|---|
| `-p, --print` ✦ | — | 打印后退出 (管道/脚本) |
| `--output-format` ✦ | text \| json \| stream-json | 输出格式 (仅-p) |
| `--input-format` | text \| stream-json | 输入格式 (仅-p) |
| `--verbose` ✦ | — | 逐轮详细输出 (stream-json 必需) |
| `--include-partial-messages` ✦ | — | 输出流式分块 (需 -p + stream-json) |
| `--include-hook-events` | — | 输出 hook 生命周期事件 (需 stream-json) |
| `--replay-user-messages` | — | 回显 stdin 用户消息 (需收发均 stream-json) |
| `--prompt-suggestions` | bool | 每轮预测下条 prompt (需 -p+stream-json+verbose) |
| `--json-schema` | JSON Schema | 结构化输出校验 (仅-p) |
| `--max-turns` (docs) | 整数 | 限制 agent 轮数 (仅-p) |
| `--max-budget-usd` | 金额 | 花费上限后停 (仅-p) |
| `--fallback-model` | 模型 | 过载/不可用时回退 (仅 -p / 后台) |
| `--exclude-dynamic-system-prompt-sections` | — | cwd/env/git 段移到首条 user msg, 提升跨用户缓存 |

## 3. 系统提示

> ⚠ jjlauncher 用 `--append-system-prompt` 注入 scene (`run.ts:67`), 此组**勿在 config 重复配**.

<!-- prettier-ignore -->
| Flag | 值 | 说明 |
|---|---|---|
| `--system-prompt` | 文本 | 替换整个默认系统提示 |
| `--system-prompt-file` (docs) | 文件 | 同上, 从文件读 |
| `--append-system-prompt` ✦ | 文本 | 追加到默认提示后 |
| `--append-system-prompt-file` (docs) | 文件 | 追加文件内容 |

替换类与 append 类可组合; `--system-prompt` 与 `--system-prompt-file` 互斥.

## 4. 模型 / Agent

<!-- prettier-ignore -->
| Flag | 值 | 说明 |
|---|---|---|
| `--model` | 别名/全名 | 会话模型 (覆盖设置与 `ANTHROPIC_MODEL`) |
| `--effort` | low \| medium \| high \| xhigh \| max | effort 级别 (可用值依模型) |
| `--betas` | 字符串 | API beta headers (仅 API key 用户) |
| `--agent` | 名称 | 指定会话 agent |
| `--agents` | JSON | 动态定义子 agent (含 `description`+`prompt`) |
| `--teammate-mode` (docs) | auto \| in-process \| tmux | agent team 队友显示模式 |
| `--brief` (help) | — | 启用 `SendUserMessage` 工具 (agent→user 通信) |

## 5. 权限 / 工具

<!-- prettier-ignore -->
| Flag | 值 | 说明 |
|---|---|---|
| `--permission-mode` | default \| acceptEdits \| plan \| auto \| dontAsk \| bypassPermissions | 起始权限模式 |
| `--dangerously-skip-permissions` ✦ | — | 跳过所有权限 (= `bypassPermissions`) |
| `--allow-dangerously-skip-permissions` ✦ | — | 把 bypass 加进 Shift+Tab 循环, 不默认启用 |
| `--permission-prompt-tool` (docs) | MCP工具 | 非交互下用 MCP 工具处理权限提示 |
| `--allowedTools` / `--allowed-tools` | 列表 | 免提示执行的工具 (如 `"Bash(git *)" "Edit"`) |
| `--disallowedTools` / `--disallowed-tools` | 列表 | 拒绝规则 (裸名移出 context; 带 scope 仅拒匹配) |
| `--tools` | 列表/`""`/`default` | 限制可用内置工具集 |
| `--add-dir` | 目录… | 额外可访问目录 (仅授文件权, 不发现配置) |
| `--disable-slash-commands` | — | 禁用所有 skills/命令 |

## 6. MCP / 设置 / 插件

<!-- prettier-ignore -->
| Flag | 值 | 说明 |
|---|---|---|
| `--mcp-config` | 文件/JSON… | 加载 MCP 服务器 (空格分隔, 可多个) |
| `--strict-mcp-config` | — | 只用 `--mcp-config` 的 MCP, 忽略其它来源 |
| `--mcp-debug` (help) | — | **DEPRECATED**, 改用 `--debug` |
| `--settings` | 文件/JSON | 加载/覆盖设置 (覆盖同名 key, omit 的保留) |
| `--setting-sources` | user,project,local | 限定加载哪些设置源 |
| `--plugin-dir` | 目录/zip | 本会话加载插件 (可重复) |
| `--plugin-url` | URL | 从 URL 取插件 zip (可重复) |

## 7. 启动行为 / 环境

<!-- prettier-ignore -->
| Flag | 值 | 说明 |
|---|---|---|
| `--bare` | — | 极简: 跳过 hooks/LSP/插件/auto-memory/CLAUDE.md 自动发现等; 认证仅 API key |
| `--file` (help) | file_id:path… | 启动时下载文件资源 |
| `--init` (docs) | — | 会话前跑 `init` matcher 的 Setup hooks (仅-p) |
| `--init-only` (docs) | — | 跑 Setup+SessionStart hooks 后退出 |
| `--maintenance` (docs) | — | 会话前跑 `maintenance` matcher Setup hooks (仅-p) |

## 8. IDE / 浏览器 / worktree / 远程 / 后台

<!-- prettier-ignore -->
| Flag | 值 | 说明 |
|---|---|---|
| `--ide` ✦ | — | 启动时自动连 IDE (恰好 1 个可用时) |
| `--chrome` / `--no-chrome` | — | 开/关 Chrome 浏览器集成 |
| `-w, --worktree` | 名称 | 在隔离 git worktree 启动; 可传 `#PR号` |
| `--tmux` | — | 为 worktree 建 tmux (需 `-w`) |
| `--remote-control` / `--rc` | 名称 | 交互会话 + Remote Control (claude.ai 可控) |
| `--remote-control-session-name-prefix` | 前缀 | RC 自动命名前缀 (默认 hostname) |
| `--bg` (docs) | 字符串 | 作为后台 agent 启动并立即返回 |
| `--exec` (docs) | 命令 | 跑 shell 命令作后台 job (配 `--bg`) |
| `--channels` (docs) | plugin:name@mkt | 监听 MCP channel 通知 (research preview) |
| `--dangerously-load-development-channels` (docs) | — | 加载非白名单 channel (本地开发) |

## 9. 调试 / 信息

<!-- prettier-ignore -->
| Flag | 值 | 说明 |
|---|---|---|
| `-d, --debug` | 类别 | 调试模式 (如 `"api,hooks"`、`"!1p,!file"`) |
| `--debug-file` | 路径 | 调试日志写文件 (隐式开 debug) |
| `-v, --version` | — | 版本号 |
| `-h, --help` | — | 帮助 |

**子命令** (启动器不调用, 仅备查): `agents` `attach` `auth` `auto-mode` `daemon` `doctor` `install` `logs` `mcp` `plugin`(`plugins`) `project` `remote-control` `respawn` `rm` `setup-token` `stop`(`kill`) `ultrareview` `update`(`upgrade`).

---

## jjlauncher 填充指南

槽位与继承 (`src/config.ts`): `interactive = args+interactive` · `print = args+print` · `stream = args+print+stream`.

现状:

<!-- prettier-ignore -->
| 槽位 | 现值 |
|---|---|
| `args` | `--dangerously-skip-permissions` `--allow-dangerously-skip-permissions` |
| `interactive` | `--ide` |
| `print` | `-p` |
| `stream` | `--output-format stream-json --verbose --include-partial-messages` |

### ⛔ 勿配 (占用/冲突/无意义)

- 系统提示类 (`--append-system-prompt` / `--system-prompt*`): scene 已结构注入 (`run.ts:67`), 再配会叠加/打架.
- `-p` / `--output-format` / `--verbose` / `--include-partial-messages`: 已由 `print`/`stream` 槽位管理.
- 会话恢复类 (`-c -r --from-pr --session-id --fork-session --teleport`): 每次开新会话注入 scene, 恢复旧会话无意义.
- 远程/后台类 (`--remote* --bg --exec --channels`): 脱离本地前台启动器模型.

### ✅ 推荐扩充

- **`args`** (三模式通用): `--model` · `--effort` · `--add-dir` · `--settings` / `--setting-sources` · `--mcp-config` / `--strict-mcp-config` (工程 `sanitizeMcpConfig` 已自动跳过缺失文件, `run.ts:88`) · `--agents`.
- **`interactive`**: `-w/--worktree` · `--tmux` · `--chrome`.
- **`print`** (被 stream 继承): `--max-turns` / `--max-budget-usd` (防失控) · `--fallback-model` (过载回退) · `--no-session-persistence` (一次性) · `--exclude-dynamic-system-prompt-sections` (append 注入下仍生效, 提升跨调用缓存).
- **`stream`**: `--include-hook-events` (需 `ClaudeStreamFormatter` 能处理, 否则 fallback 原样打印).

### 小优化

`args` 现同时含 `--dangerously-skip-permissions` (已直接 bypass) + `--allow-dangerously-skip-permissions` (仅加进 Shift+Tab 循环) — 后者在 print/stream 下无效. 更干净:

```json
{
  "claude": {
    "args": ["--dangerously-skip-permissions"],
    "interactive": ["--ide", "--allow-dangerously-skip-permissions"],
    "print": ["-p"],
    "stream": ["--output-format", "stream-json", "--verbose", "--include-partial-messages"]
  }
}
```
