#!/usr/bin/env bash
set -euo pipefail

# Resolve source repo paths — .sources/ (CI) or sibling dirs (local dev)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

resolve() {
  local name="$1"
  if [ -d "$ROOT/.sources/$name" ]; then
    echo "$ROOT/.sources/$name"
  elif [ -d "$ROOT/../$name" ]; then
    echo "$ROOT/../$name"
  else
    echo "ERROR: cannot find $name repo (checked .sources/$name and ../$name)" >&2
    return 1
  fi
}

SUKKO="$(resolve sukko)"
SUKKO_CLI="$(resolve sukko-cli)"
SUKKO_JS="$(resolve sukko-js)"

mkdir -p "$ROOT/generated"

echo "Extracting config reference..."
cd "$ROOT/scripts/extract-config"
go run . "$SUKKO/ws" > "$ROOT/generated/config-reference.json"

echo "Extracting CLI reference..."
cd "$SUKKO_CLI"
go run ./cmd/gendocs > "$ROOT/generated/cli-reference.json"

echo "Extracting edition limits..."
cd "$ROOT/scripts/extract-editions"
go run . "$SUKKO/ws" > "$ROOT/generated/editions.json"

echo "Extracting SDK reference..."
cd "$ROOT"
node scripts/extract-sdk/index.js "$SUKKO_JS" > generated/sdk-reference.json

echo "Extraction complete."
