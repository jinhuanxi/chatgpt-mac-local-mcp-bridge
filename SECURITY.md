# Security model and known limitations

- Explicit opt-in: ChatGPT workspace plugin permissions + Platform tunnel permissions + outbound `tunnel-client` + local config.
- Transport: stdio. No HTTP port is opened by this MCP server. Official `tunnel-client` handles external connectivity.
- Local files: workspace-root path checks; no absolute paths, hidden paths, symlink resolution or delete tool; 200 KiB max file read/write. These are app-layer checks, not an OS sandbox and not race-proof against a malicious concurrent local process.
- URL navigation: explicit host allowlist, exact host match, HTTP(S) only; intercept outgoing browser requests and block out-of-allowlist destinations. Browser runs in an isolated Playwright Chromium, not user's existing Chrome profile.
- Browser pages are untrusted. Their content should never be treated as authoritative instructions; verify any action with external effects before clicking.
- No arbitrary shell tool. Optional `npm run test|build|lint` scripts **can do anything permitted to the local user account**, even outside the workspace; this capability is disabled by default and must only be enabled for trusted projects.
- No key saved in project config. `CONTROL_PLANE_API_KEY` is read via hidden terminal prompt; inherited by local tunnel processes, and could be visible to appropriately privileged local tooling. Prefer restricted key and revoke when done.
- Tested: built-in Node static checks, workspace sandbox unit tests and URL allowlist unit tests in the artifact creation environment. Full integration with npm packages, Chromium and the live OpenAI tunnel must be verified on the user's Mac.