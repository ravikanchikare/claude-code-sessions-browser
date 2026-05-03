# Claude Session Browser

Browse, compare, and copy transcripts of Claude Code conversation logs across multiple `.claude` root folders.

## Quick Start

Run instantly without installing:

```bash
npx cc-session-viewer
```

**Or install globally for the best experience!**
Installing globally maps the short command `cc-session-viewer` so you can use it anywhere:

```bash
npm install -g cc-session-viewer

cc-session-viewer
```

This launches the app at `http://localhost:3333`. It auto-detects `~/.claude` as the default root—no arguments needed.

## Development

```bash
# Terminal 1 — API server
npx tsx bin/cli.ts --dev --no-open

# Terminal 2 — Vite dev server (hot reload)
npx vite
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` requests to the Express backend on port 3333.

### Custom roots

```bash
npx tsx bin/cli.ts --dev --no-open --roots "/path/to/.claude,/other/path/.claude"
```

## Clean Build

```bash
rm -rf dist build
npm run build
```

## Export sessions to Markdown (CLI)

Standalone script: writes minimal `.md` files (title + `User:` / `Claude:` / `Claude Summary:` content only), using the same parser and filters as the app. Output mirrors `projects/{projectId}/{sessionId}/` with `transcript.md` and `subagents/agent-*.md`.

```bash
# List all project folders under `projects/` (`project_id` and `sessions` only; `project_id` = `--project` value). `sessions` counts UUID `*.jsonl` at the project root (same as the in-app sidebar).
npm run list-projects
npm run list-projects -- -r /path/to/.claude

npm run export-md -- --out ./my-export --project -Users-you-Documents-your-repo
npm run export-md -- --out ./all-md --all -r ~/.claude
npm run export-md -- --dry-run -o ./tmp -p YOUR_PROJECT_ID
```

Run `npm run export-md -- --help` for options.

### Token count (exported `.md`)

Uses [tiktoken](https://github.com/openai/tiktoken) in a local venv. From repo root:

```bash
npm run count-tokens
npm run count-tokens -- --format md
```

`npm run count-tokens -- --help` for flags (`--root`, encoding, etc.).

## Features

- **Multi-root browsing** — configure multiple `.claude` folders, browse all projects and sessions
- **Session viewer** — checkpoint-grouped conversations with collapsible tool calls and thinking blocks
- **Side-by-side comparison** — select 2 sessions to compare in independently scrollable columns
- **Project pinning** — pin frequently used projects to the top of the list
- **Copy transcript** — full session, per-turn, or compare selection, as plain text with `User:`, `Claude:`, and `Claude Summary:` labels
