# ChatGPT Web ↔ Mac Local MCP Bridge

**A self-hosted 17-tool reference bridge for connecting ChatGPT Web to an authorized Mac workspace through OpenAI Secure MCP Tunnel.**

> **Experimental reference implementation.** This repository was written as an independent public example, **not copied from the owner's private Mac bridge**. Basic JavaScript syntax and path-policy tests were run during preparation. The published package has **not** passed a full npm-install / Playwright / ChatGPT end-to-end test. Treat the code as a learning starting point and review it before enabling any write/command tool. This is **not an official OpenAI product**.

## How it works

```text
ChatGPT web → Custom MCP plugin → Secure MCP Tunnel
  → tunnel-client on your Mac → stdio Node.js MCP server
  → isolated ~/AI-Projects workspace
```

The tunnel handles the outbound connection, **not** file/command permissions. This repository defines those tools.

## Tools (17)

| Group | Names |
| --- | --- |
| Workspace | `workspace_info`, `list_workspace`, `read_workspace_file`, `create_workspace_directory`, `write_workspace_file` |
| Browser | `browser_open`, `browser_inspect`, `browser_click`, `browser_fill`, `browser_screenshot`, `browser_close` |
| Developer | `run_project_task`, `dev_npm_install`, `dev_npm_task`, `dev_server_start`, `dev_server_status`, `dev_server_stop` |

Files are restricted to the configured workspace by application-level checks; this is **not an operating-system sandbox**. Developer commands are **disabled by default**. Playwright runs a fresh Chromium instance and **does not use your logged-in personal Chrome profile**.

## Requirements

- macOS, Node.js 20+, npm
- OpenAI [tunnel-client](https://github.com/openai/tunnel-client), a Tunnel ID and a restricted runtime API key
- ChatGPT workspace permissions to install and use a custom Tunnel-backed MCP plugin

## Setup

```bash
git clone https://github.com/jinhuanxi/chatgpt-mac-local-mcp-bridge.git
cd chatgpt-mac-local-mcp-bridge
zsh scripts/setup-macos.sh
npm run check
npm test
npm run browser:install    # needed for browser tools only
```

On first use the project root defaults to `~/AI-Projects`. Optionally set `MCP_WORKSPACE_ROOT` to a separate dedicated directory.

### Create the tunnel

1. Create a Tunnel in [OpenAI Platform](https://platform.openai.com/settings/organization/tunnels).
2. Create a **least-privilege runtime key** with Tunnels Read + Use. Do not commit it.
3. Install `tunnel-client` by following its [upstream instructions](https://github.com/openai/tunnel-client). On macOS with Homebrew, the command is typically `brew install openai/tools/tunnel-client`.
4. Configure a local stdio profile pointing to **the absolute path of this repository**:

```zsh
read -s 'CONTROL_PLANE_API_KEY?Runtime API key: '
echo
export CONTROL_PLANE_API_KEY
tunnel-client init --sample sample_mcp_stdio_local \
  --profile mac-local-mcp \
  --tunnel-id 'tunnel_YOUR_ID' \
  --mcp-command 'node /ABSOLUTE/PATH/chatgpt-mac-local-mcp-bridge/src/server.mjs'
tunnel-client doctor --profile mac-local-mcp --explain
tunnel-client run --profile mac-local-mcp
```

Do not post the runtime key, its environment variable contents, or a real Tunnel ID in a public issue.

### Connect in ChatGPT Web

In a workspace that permits custom MCP plugins, add a custom MCP server with **Tunnel** as connection method, select the created Tunnel, review the tools/permissions, then publish or install it as required.

Try calling `workspace_info`, then `list_workspace`. **A green connection indicator alone does not prove that tool calls work.** If you change the server and add tools, open the plugin's Tools dialog and **Refresh**, then save/publish the updated tools.

### Enabling developer commands (optional, riskier)

```bash
MCP_ALLOW_PROJECT_COMMANDS=true tunnel-client run --profile mac-local-mcp
```

You must run this with the desired environment **in the terminal that launches the client**. npm scripts can run arbitrary project code with your user permissions, so use only trusted projects and require approval in the ChatGPT plugin settings. A project directory must be a named subdirectory such as `hello-dev-server`, never `.`.

Try the local-only sample in [examples/hello-dev-server](examples/hello-dev-server). Copy the example directory to `~/AI-Projects/hello-dev-server`; after approval and enabling commands, call `dev_server_start`, `dev_server_status`, `browser_open(http://127.0.0.1:5173)`, `browser_inspect`, `browser_close`, and `dev_server_stop`.

## Start automatically when logging in

The optional scripts use macOS **Keychain** + a per-user **launchd LaunchAgent**. Read [SECURITY.md](SECURITY.md) first and **do not install a second LaunchAgent using the same Tunnel ID as an existing live service**.

Create a Generic Password in Keychain Access:

- Service: `mac-local-mcp-runtime`
- Account: your macOS short user name
- Password: your **complete** Runtime API Key

Make sure `mac-local-mcp` is an existing tunnel-client profile. Then:

```zsh
zsh scripts/install-launch-agent.sh
launchctl print "gui/$(id -u)/io.github.chatgpt-mac-local-mcp-bridge"
```

The launch agent starts at user login and uses KeepAlive to try restarting after process exit. If you need an HTTPS proxy, provide it to the LaunchAgent; GUI login sessions often do not inherit interactive terminal environment variables.

To uninstall *this example's* LaunchAgent without touching your workspace, key or tunnel:

```zsh
zsh scripts/uninstall-launch-agent.sh
```

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `MCP_WORKSPACE_ROOT` | `~/AI-Projects` | Authorized project root |
| `MCP_ALLOWED_WEB_HOSTS` | `localhost,127.0.0.1,example.com` | Comma-separated browser host allowlist |
| `MCP_ALLOW_PROJECT_COMMANDS` | `false` | Enable npm and managed dev-server tools |
| `MCP_TUNNEL_PROFILE` | `mac-local-mcp` | Used by startup script |

The `CONTROL_PLANE_API_KEY` variable is for **tunnel-client**; the LaunchAgent script retrieves the key from the macOS Keychain instead of storing it in source control.

## Safety and troubleshooting

- Keep this repository and its workspace separate from personal home files, browser profiles, API keys and SSH keys.
- npm scripts, `npm install`, dev servers and browser clicks have consequential side effects. Enable ChatGPT confirmations.
- Application path checks are not an OS sandbox. A malicious npm script can still access other files your macOS user can access.
- If `tunnel-client doctor` says the API key environment variable is missing, the current terminal probably has not exported it; this does **not** itself prove the Keychain-backed background service is broken.
- If tools are missing from ChatGPT after an upgrade, **Refresh** the custom plugin's tool inventory.
- If `browser_open` cannot launch Chromium, run `npm run browser:install`.
- If the tunnel is healthy but calls fail, verify ChatGPT actually invokes `workspace_info` instead of only checking the UI status.

See [SECURITY.md](SECURITY.md) for important limitations.

## 中文说明

这是一个**独立的开源参考版本**，不是从个人 Mac 上直接导出的原始程序。它让 ChatGPT 网页版通过 OpenAI Secure MCP Tunnel 调用受限目录中的文件工具、Playwright 和 npm 开发工具。**需要有权创建自定义 MCP 插件的 ChatGPT 工作区**。本项目已进行部分静态检查及路径测试，尚未完成全部端到端实测，不建议直接用于存放敏感资料的主账号。

## License

[MIT](LICENSE). Independent community reference implementation; **not affiliated with or endorsed by OpenAI**.

Useful links: [Secure MCP Tunnel guide](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels), [tunnel-client](https://github.com/openai/tunnel-client), [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk).
