## Learned User Preferences

- Names the in-app feature “copy transcript” (replacing a prior export-oriented flow).
- Wants copied transcript text labeled with distinct roles: `User:`, `Claude:`, and `Claude Summary:` (or equivalent) so turns are human-readable.
- When copying transcript text, only include each message’s `content` (or equivalent), not tool invocations (for example `bash` tool calls) or other tool metadata.
- Session/overflow “copy transcript” should include subagent session transcripts, not just the top-level session.
- Per-expandable turn row: show a small copy (clipboard) control; copy scope follows `turn_pair` from user message through the assistant’s final `end_turn` result.

## Learned Workspace Facts

- Local dev: `npm run dev` in this repo; the app is typically available at `http://localhost:3333`.
- When serving the built Vite UI, `dist` must resolve to this package’s `dist/`: from `server/` (e.g. `tsx`) use one `..` to `dist`; from `build/server` use `../..` to `dist` (mis-resolution can point at a parent monorepo folder).
- `scripts/export-project-sessions-md.ts` is a standalone path for exporting project sessions to a user-chosen directory, producing lean JSON and simple `.md` from message content.
