# CLI Prompt Launcher

`jj` launches Claude Code or Codex with shared scene prompts.

## Setup

Requires: Bun, `claude`, `codex`.

```bash
bun install
bun run preview    # builds and installs jj globally via bun
```

## Usage

```
jj [scene]               Interactive mode (default)
jj -p [scene]            Text mode (multiline input, :q to submit)
jj -s [scene]            Stream mode (raw JSON events)
jj -e [-p|-s] [scene]    Edit prompt in $EDITOR first
```

- Default engine is Claude Code: `jj d`; prefix scene with `.` for Codex: `jj .d`
- No scene arg → uses `scenes.default` from config
- Built-in scenes: `default`, `ai-expert`, `it-expert`, `code-expert`, `address`
- Aliases: `d`→`default`, `ai`→`ai-expert`, `it`→`it-expert`, `code`→`code-expert`

## Config

Auto-initialized on first run:

```
~/.config/cli-prompt-launcher/
├── config.json          # see example/config.json
└── scenes/*.md
```

Add a scene: create `scenes/foo.md`, optionally alias it in `config.json` → `"f": "foo"`, then run `jj foo`, `jj f`, or `jj .f`.

## License

MIT
