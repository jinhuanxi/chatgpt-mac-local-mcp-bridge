#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo "=== Local unit checks ==="
npm run check
echo ""
echo "To inspect MCP tools interactively, in Terminal run:"
echo "  npx @modelcontextprotocol/inspector node src/server.mjs"
read -r -p "Press Enter to close..." _