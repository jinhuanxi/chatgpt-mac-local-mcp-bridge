#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "=== Mac Local MCP Bridge: setup ==="
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js >=22 not found. Install LTS from https://nodejs.org/en/download/ and run this file again."
  read -r -p "Press Enter to close..." _
  exit 1
fi
node -e 'const v=+process.versions.node.split(".")[0]; if(v<22){console.error("Need Node.js >=22"); process.exit(1)}'
if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found; reinstall Node.js from the official site."
  exit 1
fi
if [ ! -f config.json ]; then
  cp config.example.json config.json
  echo "Created config.json with ~/Desktop/AI-Projects as the workspace."
fi
mkdir -p "$HOME/Desktop/AI-Projects"
echo "Installing dependencies (internet required)..."
npm install --ignore-scripts
echo "Installing isolated Playwright Chromium (internet required)..."
npx playwright install chromium
npm run check
echo ""
echo "Setup complete!"
echo "Workspace: $HOME/Desktop/AI-Projects"
echo "You may edit allowedWebHosts in config.json before browser use."
echo "Next: Read README-START-HERE.md, then run connect-tunnel.command."
read -r -p "Press Enter to close..." _