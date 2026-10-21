#!/usr/bin/env bash
# Preparation is not authorization: every write requires owner evidence and a TTY.
set +x
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
command -v python3 >/dev/null || { printf 'Required binary missing: python3\n' >&2; exit 1; }
exec python3 "$script_dir/release.py" "$@"
