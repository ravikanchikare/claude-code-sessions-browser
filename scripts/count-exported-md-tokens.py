#!/usr/bin/env python3
"""Count tokens in exported *.md (tiktoken). https://github.com/openai/tiktoken

From repo root:  npm run count-tokens
Extra args:       npm run count-tokens -- --format md --root ./exported-md
Direct Python is supported if tiktoken is on that interpreter (use npm otherwise).
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path

try:
    import tiktoken
except ModuleNotFoundError:  # pragma: no cover
    print(
        "error: missing tiktoken. From repo root run:  npm run count-tokens",
        file=sys.stderr,
    )
    print(
        f"  (if invoking python: {sys.executable}  — use npm or venv, or: "
        f"python3 -m pip install -r scripts/requirements-tiktoken.txt for that python)",
        file=sys.stderr,
    )
    raise SystemExit(1) from None


def _md_cell(s: str) -> str:
    return s.replace("|", "\\|").replace("\n", " ")


def session_key_from_rel(rel: Path) -> tuple[str, str] | None:
    """
    Layout: <project>/<session_id>/.../*.md
    Returns (project, session_id) or None if the path does not include a session folder.
    """
    parts = rel.parts
    if len(parts) >= 3:
        return parts[0], parts[1]
    if len(parts) == 2:
        # e.g. <project>/file.md — no session directory
        return parts[0], f"(in {parts[0]} root)"
    if len(parts) == 1:
        return "(exported-md root)", rel.stem
    return None


def main() -> int:
    here = Path(__file__).resolve().parent
    default_root = here.parent / "exported-md"

    p = argparse.ArgumentParser(
        description="Count tokens in exported markdown (default: parent/exported-md).",
    )
    p.add_argument(
        "--root",
        type=Path,
        default=default_root,
        help=f"Root directory to scan (default: {default_root})",
    )
    p.add_argument(
        "--encoding",
        default="o200k_base",
        help='tiktoken encoding name (default: o200k_base). Also: cl100k_base, p50k_base, ...',
    )
    p.add_argument(
        "--model",
        default=None,
        help='If set, use tiktoken.encoding_for_model() instead of --encoding (e.g. gpt-4o)',
    )
    p.add_argument(
        "--top",
        type=int,
        default=20,
        help="Show this many largest files (default: 20; use 0 to skip)",
    )
    p.add_argument(
        "--no-by-session",
        action="store_true",
        help="Omit per-session breakdown; only print flat totals per top-level project folder",
    )
    p.add_argument(
        "--format",
        choices=("text", "md", "tsv"),
        default="text",
        help="text: default layout; md: markdown tables; tsv: tab-separated (headers row)",
    )
    args = p.parse_args()

    root: Path = args.root.resolve()
    if not root.is_dir():
        print(f"error: not a directory: {root}", file=sys.stderr)
        return 1

    if args.model:
        enc = tiktoken.encoding_for_model(args.model)
        enc_name = f"model:{args.model}"
    else:
        enc = tiktoken.get_encoding(args.encoding)
        enc_name = args.encoding

    by_file: list[tuple[Path, int]] = []
    err: list[tuple[Path, str]] = []
    for path in sorted(root.rglob("*.md")):
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as e:
            err.append((path, str(e)))
            continue
        n = len(enc.encode(text))
        by_file.append((path, n))

    total = sum(n for _, n in by_file)
    by_project: defaultdict[str, int] = defaultdict(int)
    by_project_session: defaultdict[str, defaultdict[str, int]] = defaultdict(
        lambda: defaultdict(int)
    )
    for path, n in by_file:
        rel = path.relative_to(root)
        if rel.parts:
            by_project[rel.parts[0]] += n
        else:
            by_project["(root)"] += n
        key = session_key_from_rel(rel)
        if key is not None:
            proj, ses = key
            by_project_session[proj][ses] += n

    def emit_text() -> None:
        print(f"root:     {root}")
        print(f"encoding: {enc_name} (tiktoken)\n")
        print(f"files: {len(by_file):,} markdown files")
        if err:
            print(f"read errors: {len(err)}")
        print(f"total tokens: {total:,}\n")

        if not args.no_by_session:
            print("Sessions by project (line items)\n")
            for proj in sorted(by_project_session.keys()):
                sessions = by_project_session[proj]
                subtotal = sum(sessions.values())
                n_sess = len(sessions)
                print(f"{proj}")
                print(
                    f"  {n_sess} session(s)  ·  {subtotal:,} tokens in this project\n"
                )
                for ses, tok in sorted(sessions.items(), key=lambda x: -x[1]):
                    print(f"  - {ses}  {tok:,}")
                print()
            print("—" * 60)
            print()
        else:
            print("By top-level folder (no session split)\n")
            for name, sub in sorted(by_project.items(), key=lambda x: -x[1]):
                print(f"  {name}: {sub:,}")
            print()

        if args.top > 0:
            print(f"\nLargest {args.top} files (tokens):")
            for path, n in sorted(by_file, key=lambda x: -x[1])[: args.top]:
                rel = path.relative_to(root)
                print(f"  {n:>10,}  {rel}")

    def emit_md() -> None:
        print("## Token counts (tiktoken)\n")
        err_note = f"\n- **Read errors:** {len(err)}" if err else ""
        print(
            f"- **Root:** `{root}`\n"
            f"- **Encoding:** `{enc_name}`\n"
            f"- **Files:** {len(by_file):,}{err_note}\n"
            f"- **Total tokens:** {total:,}\n"
        )
        if args.no_by_session:
            print("### By project\n")
            print("| Project | Tokens |")
            print("|---------|--------|")
            for name, sub in sorted(by_project.items(), key=lambda x: -x[1]):
                print(f"| {_md_cell(name)} | {sub:,} |")
        else:
            print("### Project roll-up\n")
            print("| Project | Sessions | Tokens |")
            print("|---------|----------|--------|")
            for proj in sorted(by_project_session.keys()):
                sessions = by_project_session[proj]
                subtot = sum(sessions.values())
                print(f"| {_md_cell(proj)} | {len(sessions)} | {subtot:,} |")
            print()
            print("### Sessions by project\n")
            for proj in sorted(by_project_session.keys()):
                sessions = by_project_session[proj]
                subtot = sum(sessions.values())
                n_sess = len(sessions)
                print(f"#### {_md_cell(proj)}")
                print(
                    f"*{n_sess} session(s)  ·  {subtot:,} tokens*\n"
                )
                print("| Session | Tokens |")
                print("|---------|-------:|")
                for ses, tok in sorted(
                    sessions.items(), key=lambda x: -x[1]
                ):
                    print(f"| `{_md_cell(ses)}` | {tok:,} |")
                print()
        if args.top > 0 and by_file:
            print()
            print(f"### Largest {args.top} files\n")
            print("| Tokens | Path |")
            print("|--------|------|")
            for path, n in sorted(by_file, key=lambda x: -x[1])[: args.top]:
                rel = path.relative_to(root)
                print(f"| {n:,} | `{_md_cell(str(rel))}` |")

    def emit_tsv() -> None:
        print(f"# root\t{root}")
        print(f"# encoding\t{enc_name}")
        print(f"# files\t{len(by_file)}")
        if err:
            print(f"# read_errors\t{len(err)}")
        print(f"# total_tokens\t{total}")
        if args.no_by_session:
            print("project\ttokens")
            for name, sub in sorted(by_project.items(), key=lambda x: -x[1]):
                print(f"{name}\t{sub}")
        else:
            print("row_kind\tproject\tsession\ttokens")
            for proj in sorted(by_project_session.keys()):
                for ses, tok in sorted(
                    by_project_session[proj].items(), key=lambda x: -x[1]
                ):
                    print(f"session\t{proj}\t{ses}\t{tok}")
            for proj in sorted(by_project.keys()):
                print(f"project_subtotal\t{proj}\t\t{by_project[proj]}")
        if args.top > 0 and by_file:
            print("row_kind\ttokens\trelpath")
            for path, n in sorted(by_file, key=lambda x: -x[1])[: args.top]:
                rel = path.relative_to(root)
                print(f"file\t{n}\t{rel}")

    if args.format == "text":
        emit_text()
    elif args.format == "md":
        emit_md()
    else:
        emit_tsv()

    for path, msg in err:
        print(f"  (skipped) {path.relative_to(root)}: {msg}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
