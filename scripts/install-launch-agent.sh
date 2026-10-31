#!/bin/zsh
set -euo pipefail
SCRIPT_DIR="${0:A:h}"
START_SCRIPT="$SCRIPT_DIR/start-tunnel.sh"
LABEL='io.github.chatgpt-mac-local-mcp-bridge'
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOGDIR="$HOME/Library/Logs/chatgpt-mac-local-mcp-bridge"
mkdir -p "$HOME/Library/LaunchAgents" "$LOGDIR"
chmod 700 "$START_SCRIPT"
export MCP_START_SCRIPT="$START_SCRIPT" MCP_PLIST="$PLIST" MCP_LOGDIR="$LOGDIR" MCP_LABEL="$LABEL"
node --input-type=module <<'NODE'
import fs from 'node:fs';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const { MCP_START_SCRIPT: script, MCP_PLIST: plist, MCP_LOGDIR: logdir, MCP_LABEL: label } = process.env;
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${esc(label)}</string>
<key>ProgramArguments</key><array><string>${esc(script)}</string></array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>${esc(logdir)}/output.log</string>
<key>StandardErrorPath</key><string>${esc(logdir)}/error.log</string>
</dict></plist>
`;
fs.writeFileSync(plist, xml, { mode: 0o600 });
NODE
launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed $LABEL. Check: launchctl print gui/$(id -u)/$LABEL"
echo "Logs: $LOGDIR"
