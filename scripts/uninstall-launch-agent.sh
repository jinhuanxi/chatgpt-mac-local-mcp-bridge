#!/bin/zsh
set -euo pipefail
LABEL='io.github.chatgpt-mac-local-mcp-bridge'
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
if [[ -f "$PLIST" ]]; then
  launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
  rm "$PLIST"
fi
echo 'LaunchAgent removed. Keychain, workspace, tunnel and project files remain untouched.'
