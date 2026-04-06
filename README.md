# Claude Session Browser

Browse, compare, and export Claude Code conversation logs across multiple `.claude` root folders.

## Quick Start

```bash
npm install
npm run build
npm start
```

This builds the frontend and server, then launches the app at `http://localhost:3333`. It auto-detects `~/.claude` as the default root—no arguments needed.

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

## Features

- **Multi-root browsing** — configure multiple `.claude` folders, browse all projects and sessions
- **Session viewer** — checkpoint-grouped conversations with collapsible tool calls and thinking blocks
- **Side-by-side comparison** — select 2 sessions to compare in independently scrollable columns
- **Project pinning** — pin frequently used projects to the top of the list
- **Export** — export as Markdown or JSON, scoped to session/project/root/selection
