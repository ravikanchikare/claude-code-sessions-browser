#!/usr/bin/env bash
# Entry for npm run count-tokens — venv with tiktoken, then the Python script.
set -euo pipefail
export PIP_DISABLE_PIP_VERSION_CHECK=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/.venv"
PY="$VENV/bin/python"
REQ="$SCRIPT_DIR/requirements-tiktoken.txt"
TARGET="$SCRIPT_DIR/count-exported-md-tokens.py"

if [[ ! -x "$PY" ]]; then
  python3 -m venv "$VENV"
fi
if ! "$PY" -c "import tiktoken" 2>/dev/null; then
  echo "Installing tiktoken in scripts/.venv (first run)…" >&2
  "$VENV/bin/pip" install -q -r "$REQ"
fi
exec "$PY" "$TARGET" "$@"
