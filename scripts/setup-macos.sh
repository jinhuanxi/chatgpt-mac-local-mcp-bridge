#!/bin/zsh
set -euo pipefail
REPO="${0:A:h:h}"
command -v node >/dev/null || { echo 'Install Node.js 20+ first.' >&2; exit 1; }
command -v npm >/dev/null || { echo 'npm is required.' >&2; exit 1; }
mkdir -p "$HOME/AI-Projects"
cd "$REPO"
npm install --ignore-scripts --no-audit --no-fund
npm test
printf '\nCore MCP packages installed. To use browser tools, also run:\n  npm run browser:install\n'
printf '\nNext configure Secure MCP Tunnel as described in README.md.\n'
