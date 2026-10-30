#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
mkdir -p .stul-state
if [ ! -f .stul-state/runtime.env ]; then
  (umask 077; : > .stul-state/runtime.env)
fi
exec docker compose --env-file .env --env-file .stul-state/runtime.env "$@"
