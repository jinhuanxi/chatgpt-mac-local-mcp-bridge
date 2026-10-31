# ChatGPT Web ↔ Mac Local MCP Bridge

**A working-source, self-hosted macOS MCP bridge for using ChatGPT Web with an explicitly authorized local workspace.**

This repository is now based on the **original v0.2.1 Bridge that the maintainer successfully connected to ChatGPT**, rather than the earlier independent example. It contains the 17-tool implementation and the original developer-mode upgrade bundle.

> **Open-source release notes:** Personal `config.json`, API keys, Tunnel IDs, macOS Keychain data, installed `node_modules`, local logs and backups were excluded. The published `src/project.mjs` also includes a small security hardening change: it no longer forwards the Tunnel's complete environment to child npm tasks, and it requires a named project subfolder. This public release has **not yet been tested end-to-end on a clean Mac**. This is a community project, not an official OpenAI app.

## Architecture

```text
ChatGPT web (custom MCP plugin)
   ↓
OpenAI Secure MCP Tunnel (private outbound connection)
   ↓
tunnel-client on your Mac
   ↓
node src/server.mjs (stdio MCP server)
   ↓
Your chosen workspace (default: ~/Desktop/AI-Projects)
   ├─ read / write approved files
   ├─ independent Playwright Chromium browser
   └─ optional npm tasks and managed development servers
```

This does **not** take over your existing signed-in Chrome session or your Mac's native GUI.

## All 17 tools

| Group | Tools |
|---|---|
| File workspace (5) | `workspace_info`, `list_workspace`, `read_workspace_file`, `create_workspace_directory`, `write_workspace_file` |
| Isolated Playwright (6) | `browser_open`, `browser_inspect`, `browser_click`, `browser_fill`, `browser_screenshot`, `browser_close` |
| Developer tools (6) | `run_project_task`, `dev_npm_install`, `dev_npm_task`, `dev_server_start`, `dev_server_status`, `dev_server_stop` |

**Development commands are disabled by default**. npm scripts execute code with your actual macOS account permissions. These tools are not an operating-system sandbox.

## 1. Requirements

- macOS (Playwright Chromium support depends on your macOS version)
- Node.js **22+**, npm and internet connectivity
- [OpenAI tunnel-client](https://github.com/openai/tunnel-client)
- An OpenAI Platform Tunnel and a **restricted runtime key** (Tunnels Read + Use)
- A ChatGPT workspace authorized to use custom MCP plugins

Useful docs: [OpenAI Secure MCP Tunnels](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels).

## 2. Install

```bash
git clone https://github.com/jinhuanxi/chatgpt-mac-local-mcp-bridge.git
cd chatgpt-mac-local-mcp-bridge
bash setup.command
```

The setup script creates `config.json` from `config.example.json`, creates `~/Desktop/AI-Projects`, installs npm dependencies and a standalone Playwright Chromium, and runs checks. To rerun verification:

```bash
npm run check
```

If the `setup.command` script prompts you to press Enter, do so after checking the output.

Before connecting ChatGPT, review the newly generated **local-only** `config.json`. For example:

```json
{
  "workspaceRoot": "~/Desktop/AI-Projects",
  "allowedWebHosts": ["example.com", "localhost", "127.0.0.1"],
  "browserHeadless": false,
  "allowProjectCommands": false,
  "allowedProjectTasks": ["test", "build", "lint", "typecheck"]
}
```

Your actual `config.json` must stay private and is ignored by Git. Do not give the bridge access to your entire home directory.

## 3. Establish an OpenAI Secure MCP Tunnel

1. In [OpenAI Platform](https://platform.openai.com/settings/organization/tunnels), create a Tunnel.
2. Create a **least-privilege runtime API key** with Tunnel Read + Use. Do not paste the key into ChatGPT, GitHub, or source files.
3. Install the official `tunnel-client` following [upstream instructions](https://github.com/openai/tunnel-client).
4. In the newly cloned repository run:

```bash
bash connect-tunnel.command
```

The script asks for the Tunnel ID, reads the API key without echoing it, initializes a `mac-local-mcp` profile targeting `src/server.mjs`, runs a diagnosis, and starts the Tunnel. Keep the terminal open while using this manual setup. If the upstream CLI changes, follow the updated official documentation rather than bypassing `doctor` errors.

## 4. Connect ChatGPT Web

In ChatGPT → **Plugins**, add a custom MCP server using **Tunnel**, select the corresponding Tunnel, review requested permissions, and publish/enable it as required by your workspace.

Try:

```text
Use Mac Local MCP's workspace_info to show the authorized workspace.
Do not create or modify any file.
```

Then test a safe write in a fresh demo folder. **An online indicator alone is not proof:** confirm ChatGPT actually calls the tool successfully.

After upgrading tools, open the plugin's **Tools → Refresh**, enable the newly discovered tools and save changes. ChatGPT may retain an earlier tool snapshot until you refresh.

## 5. Enable npm development tools only if needed

In your private `config.json`, set `allowProjectCommands` to `true` only after reviewing the risks. Then restart the local server or Tunnel client so the settings reload.

- `dev_npm_install` installs packages with npm lifecycle scripts disabled; installed dependencies can still be risky.
- `dev_npm_task` runs only `test`, `build`, `lint`, or `typecheck` that is present in `allowedProjectTasks` and the project's `package.json`.
- `run_project_task` runs `test`, `build`, or `lint`.
- `dev_server_start` attempts to restrict binding to `127.0.0.1`, but a project script can ignore the host argument.
- Project commands operate on named subdirectories of the workspace, not the workspace root.

**Keep user approval enabled** for file writes, package installation, browser actions with external effects and process management. An npm script can access files outside the workspace, even with the restricted task list.

## 6. Developer-mode upgrade from an older 12-tool installation

The [upgrade/](upgrade/) directory includes the **original v0.2.1 upgrade sources**, and the upgrade script has been adapted to avoid a hard-coded path in someone else's Downloads directory.

**Do not run the upgrade script on a fresh clone:** this repository already contains all 17 tools. If you have a separate older 12-tool installation, first read [upgrade/README.md](upgrade/README.md), stop the Tunnel, back up the old directory and run the upgrade with an **explicit target path**, e.g.:

```bash
bash upgrade/upgrade.command "/absolute/path/to/your/old/mac-local-mcp-bridge"
```

Refresh the ChatGPT plugin's Tools list after restarting your local Tunnel.

## 7. Auto-start when you sign in to your Mac

The published project includes the working **application-level Bridge** and a manual Tunnel connection script. It does **not** upload the maintainer's personal macOS LaunchAgent, runtime key or Tunnel profile. To auto-start on your Mac, set up a **per-user launchd LaunchAgent** that launches the existing Tunnel profile, reading your runtime key securely (e.g. from macOS Keychain). If your network uses a local proxy, the background service needs that proxy's environment and may need retry logic until the proxy becomes available.

Do not create a second live Tunnel client against the same connection without checking your existing background service.

## Safety and testing

- Workspace file tools block absolute paths, traversal, hidden paths and symlinks; checks are application-level only and **not race-proof**.
- Browser automation opens a separate Chromium instance and restricts allowed HTTP(S) hostnames; it does not use your Chrome cookies.
- npm tasks run as your user and are **not sandboxed**.
- Do not commit or share `config.json`, API keys, Tunnel profile YAML, `node_modules`, backup files or logs.
- **Verified on the owner's Mac:** 3 original unit tests passed (0 failures); ChatGPT was able to discover all 17 tool names and invoke an added tool.
- **Not independently verified:** clean-machine installation of the sanitized public version, full Playwright/npm lifecycle flow, login-time autostart, and comprehensive security review.

See [SECURITY.md](SECURITY.md) and the [original Chinese installation guide](docs/README-START-HERE.md) (written for the 12-tool baseline).

## License

[MIT](LICENSE). This project is independent and is not affiliated with or endorsed by OpenAI.
