# Local development test project

Copy this directory to `~/AI-Projects/hello-dev-server`. After enabling project commands, ask ChatGPT to call:

1. `dev_server_start({"directory":"hello-dev-server"})`
2. `dev_server_status({"directory":"hello-dev-server"})`
3. `browser_open({"url":"http://127.0.0.1:5173"})`
4. `browser_inspect({})` — the page should say "Hello from local MCP!"
5. `browser_close({})`
6. `dev_server_stop({"directory":"hello-dev-server"})`

No third-party demo dependencies are needed. The MCP Bridge's dependencies must be installed first.
