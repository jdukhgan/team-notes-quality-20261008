#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f client/dist/index.html ]]; then
  echo 'Build the client first: bash scripts/build.sh' >&2
  exit 1
fi
exec python3 -m server.service --static-dir client/dist "$@"
