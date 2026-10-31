#!/bin/zsh
# Started by the per-user macOS LaunchAgent. Does not print or persist secrets.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export CONTROL_PLANE_API_KEY="$(/usr/bin/security find-generic-password -a "$(/usr/bin/id -un)" -s 'mac-local-mcp-runtime' -w)"
export MCP_WORKSPACE_ROOT="${MCP_WORKSPACE_ROOT:-$HOME/AI-Projects}"
export MCP_ALLOW_PROJECT_COMMANDS="${MCP_ALLOW_PROJECT_COMMANDS:-false}"
# Optional: set HTTPS_PROXY in LaunchAgent EnvironmentVariables if your network requires it.
exec "$(command -v tunnel-client)" run --profile "${MCP_TUNNEL_PROFILE:-mac-local-mcp}"
