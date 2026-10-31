# Security notes (read before enabling developer tools)

This is a self-hosted **reference implementation**, not a security-audited sandbox. OpenAI Secure MCP Tunnel provides private connectivity, **not** filesystem or command sandboxing.

- **File scope:** file tools reject hidden paths, parent traversal and pre-existing symlinks. TOCTOU races remain possible if an untrusted local process alters directories during operations.
- **Project commands:** disabled by default. If enabled, npm scripts and dependencies execute arbitrary code with the macOS user's privileges and CAN access files outside the workspace. Use only trusted projects. A dedicated macOS account or VM is recommended.
- **Credentials:** never commit API keys or personal tunnel profiles. The example LaunchAgent reads its runtime key from macOS Keychain. Child npm processes inherit a restricted set of environment variables, but this is not an OS sandbox.
- **Approval:** enable ChatGPT confirmations for file writes, package installation, server lifecycle and sensitive browser interactions. A tool description does not enforce approval.
- **Browser:** a fresh Chromium context is created. Its HTTP requests are filtered by host allowlist, but WebSockets, DNS, engine behavior and embedded resources mean this is **not** a comprehensive network security boundary. Never use the tool to enter private credentials by default.
- **Servers:** HOST=127.0.0.1 is requested but arbitrary npm dev scripts might ignore it. Check actual bound interface; never expose a development server unintentionally.
- **Publishing:** scan the entire Git history for API keys, tunnel IDs, local logs, personal addresses, tokens and paths. Once committed publicly, deleting a secret file does not erase it from history.
- **Testing:** syntax checks and limited path-policy tests are included. End-to-end deployment and security have NOT been independently audited.

Report vulnerabilities privately to the repository owner. Never publish credentials in issues.
