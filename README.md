# Claude Session Browser

Browse, compare, and export Claude Code conversation logs across multiple `.claude` root folders.

## How to Run

```bash
cd claude-session-browser
npm install

# Dev mode (two terminals):
npx tsx bin/cli.ts --dev --no-open --roots "path1,path2"
npx vite

# Example with multiple roots:
npx tsx bin/cli.ts --dev --no-open --roots "/Users/devrev/claude_backup/claude_bak_23rd_Dec_2025,/Users/devrev/claude_backup/claude_testing_1,/Users/devrev/claude_backup/claude_testing_2"
```

## Features

- **Multi-root browsing** - Configure multiple `.claude` folders, browse all projects and sessions
- **Session viewer** - Full conversation display with metadata, collapsible tool calls and thinking blocks
- **Side-by-side comparison** - Select up to 3 sessions to compare in independently scrollable columns
- **Project pinning** - Pin frequently used projects to the top of the list
- **Export** - Export human messages + assistant text as Markdown or JSON, scoped to session/project/root/selection
