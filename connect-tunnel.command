#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"
echo "=== Connect Mac Bridge to ChatGPT via official Secure MCP Tunnel ==="
if [ ! -f config.json ] || [ ! -d node_modules ]; then
  echo "Run setup.command first."
  exit 1
fi
if ! command -v tunnel-client >/dev/null 2>&1; then
  echo "Official tunnel-client is not installed / not in PATH."
  echo "Download the latest macOS binary via Platform tunnel settings or:"
  echo "https://github.com/openai/tunnel-client/releases/latest"
  echo "Read: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels"
  echo "Then run connect-tunnel.command again."
  read -r -p "Press Enter to close..." _
  exit 1
fi
read -r -p "Paste tunnel_id from OpenAI Platform (e.g. tunnel_...): " TUNNEL_ID
if [[ ! "$TUNNEL_ID" =~ ^tunnel_[A-Za-z0-9_-]+$ ]]; then
  echo "Tunnel ID format does not look valid."
  exit 1
fi
echo "Enter your restricted runtime OpenAI Platform API key (hidden; not saved in files):"
read -r -s CONTROL_PLANE_API_KEY
echo ""
if [ -z "$CONTROL_PLANE_API_KEY" ]; then echo "Missing API key"; exit 1; fi
export CONTROL_PLANE_API_KEY
PROFILE="mac-local-mcp"
MCP_COMMAND="node \"$ROOT/src/server.mjs\""
echo "Configuring local stdio bridge profile..."
echo "The key will stay in this Terminal process environment and won't be written to config.json."
tunnel-client init --sample sample_mcp_stdio_local --profile "$PROFILE" --tunnel-id "$TUNNEL_ID" --mcp-command "$MCP_COMMAND"
tunnel-client doctor --profile "$PROFILE" --explain
echo ""
echo "Now open ChatGPT > Plugins > + > Add custom MCP server > Connection: Tunnel."
echo "Choose the matching tunnel or paste your tunnel_id, then create the plugin."
echo "Leave this Terminal window open. Press Ctrl+C to stop the tunnel."
tunnel-client run --profile "$PROFILE"