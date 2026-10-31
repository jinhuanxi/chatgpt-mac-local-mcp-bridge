#!/bin/bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-$(cd "$HERE/.." && pwd)}"
if [ ! -f "$TARGET/src/server.mjs" ] || [ ! -f "$TARGET/package.json" ]; then
  echo "Project not found: $TARGET"
  echo "Usage: bash upgrade.command /full/path/to/mac-local-mcp-bridge"
  exit 1
fi
if [ ! -d "$TARGET/node_modules" ]; then
  echo "Missing node_modules. Run original setup.command first."; exit 1
fi
BACKUP="$TARGET/.upgrade-backups/$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$BACKUP"
cp "$TARGET/src/server.mjs" "$BACKUP/server.mjs"
cp "$TARGET/package.json" "$BACKUP/package.json"
HAD_DEVTOOLS=0
if [ -e "$TARGET/src/devtools.mjs" ]; then HAD_DEVTOOLS=1; cp "$TARGET/src/devtools.mjs" "$BACKUP/devtools.mjs"; fi
rollback() {
  echo "Upgrade failed; restoring previous files from $BACKUP"
  cp "$BACKUP/server.mjs" "$TARGET/src/server.mjs"
  cp "$BACKUP/package.json" "$TARGET/package.json"
  if [ "$HAD_DEVTOOLS" -eq 1 ]; then cp "$BACKUP/devtools.mjs" "$TARGET/src/devtools.mjs"; else rm -f "$TARGET/src/devtools.mjs"; fi
}
trap rollback ERR
cp "$HERE/src/server.mjs" "$TARGET/src/server.mjs"
cp "$HERE/src/devtools.mjs" "$TARGET/src/devtools.mjs"
cp "$HERE/package.json" "$TARGET/package.json"
node --check "$TARGET/src/server.mjs"
node --check "$TARGET/src/devtools.mjs"
(cd "$TARGET" && npm run check)
trap - ERR
echo "UPGRADE SUCCESSFUL; backup: $BACKUP"
echo "Your existing tunnel profile and config.json were preserved."
echo "To enable development commands, stop the tunnel and set allowProjectCommands=true in config.json."