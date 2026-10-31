<!-- Original 12-tool baseline guide. The current v0.2.1 has 17 tools; see main README. -->

# Mac Local MCP Bridge — 中文安装说明

本项目让 **ChatGPT 网页版**经 **OpenAI 官方 Secure MCP Tunnel**，在明确授权范围内调用 Mac 上的 MCP 工具：工作目录文件操作、独立 Playwright Chromium 浏览器操作、可选项目构建/测试命令。

> 不使用 Computer Use、不需要公开本地端口、不连接你当前 Chrome 的登录资料、不允许任意终端命令。**无法直接控制 Finder、Photos 等原生 Mac GUI 软件**（可在未来增加针对性适配器）。

## 0. 环境与权限

- macOS 14+（Playwright Chromium 的官方系统要求），Node.js 22+（https://nodejs.org/en/download/），互联网连接。
- 一个有权限创建 **ChatGPT 自定义 MCP 插件** 的 ChatGPT 工作区。工作区管理员可能需要开启/授权相关功能；不保证所有账号可用。
- OpenAI Platform 里有 `tunnel_id`；创建方有 **Tunnels Read + Manage**，运行方有 **Tunnels Read + Use** 权限。需要一个限制权限的 **runtime API key**；ChatGPT 工作区与 Platform 组织应正确关联。
- 官方 `tunnel-client`（https://github.com/openai/tunnel-client/releases/latest）。

官方依据：

- https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
- https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
- https://github.com/openai/tunnel-client/blob/master/docs/onboarding.md
- https://playwright.dev/docs/intro

## 1. 下载与首次安装

1. 下载 zip、解压到 Mac（建议 `~/Desktop/mac-local-mcp-bridge`）。
2. 在 Finder 中双击 `setup.command`，或在终端中输入：

   ```bash
   cd ~/Desktop/mac-local-mcp-bridge
   bash setup.command
   ```

3. 脚本会安装 npm 依赖、Playwright Chromium，并创建 `~/Desktop/AI-Projects`。依赖安装需要联网。
4. 首次自动创建 `config.json`。默认只允许在 `~/Desktop/AI-Projects` 下读写文本文件。
5. Mac 可能弹出安全提示。请确认运行的是你刚下载并自行检查过的脚本；不用关闭 Gatekeeper 或关闭系统安全机制。

如果你的 Mac 不是 macOS 14+，可以先继续使用文件工具，但 **Playwright 浏览器**可能无法安装；建议升级系统。

## 2. 修改授权范围（重要）

打开项目根目录的 `config.json`。例子：

```json
{
  "workspaceRoot": "~/Desktop/AI-Projects",
  "allowedWebHosts": ["example.com", "localhost", "127.0.0.1"],
  "browserHeadless": false,
  "allowProjectCommands": false,
  "allowedProjectTasks": ["test", "build", "lint"]
}
```

- **文件权限：** 所有可访问文件都位于 `workspaceRoot` 内。工具拒绝路径穿越、隐藏文件与软链接；不会提供删除工具。暂未提供操作系统级沙箱，拥有本地系统账户权限的其他进程不受限制。
- **浏览器权限：** 只允许访问 `allowedWebHosts` 中显式列出的域名（精确匹配；不支持通配符）。自动化浏览器是一个新的独立 Playwright Chromium，不是你已经登录的 Chrome。访问需要第三方 CDN 的页面时，可能要添加第三方域名；在了解风险后添加。
- **执行命令：** 默认为 `false`。若开启，`run_project_task` 能执行允许的 `npm run test/build/lint`，但项目的 npm 脚本可以执行任意程序，**并不受文件工作目录安全限制保护**。仅在你信任项目代码时使用。
- 写入文件默认为**不得覆盖**已有文件；覆写需指定 `overwrite=true`。不提供删除或读取任意系统文件的工具。

注意：文件工具检查属于应用层边界，不能对抗同一 Mac 账户下同时操纵目录结构的恶意本地进程；不要把它当成强安全隔离容器。

## 3. 本地检测（在连接 ChatGPT 之前）

```bash
cd ~/Desktop/mac-local-mcp-bridge
npm run check
```

可选：用官方 MCP Inspector 测试工具协议、列出工具并直接调用：

```bash
npx @modelcontextprotocol/inspector@latest node src/server.mjs
```

MCP 服务采用 **stdio**，不用手动监听 127.0.0.1 端口；不能直接访问 `http://localhost:xxxx/mcp`。

## 4. 创建 OpenAI Secure MCP Tunnel（需要你登录 Platform）

1. 登录 OpenAI Platform，在 Tunnel 设置里创建隧道，得到 `tunnel_id`，同时获得受限运行 API Key。**不要把 Key 发到聊天里。**
2. 下载并安装最新官方 `tunnel-client`，确保终端执行 `tunnel-client help quickstart` 有响应。
3. 确认目标 ChatGPT 工作区与 Platform 组织已正确关联，并具有所需 Tunnel 权限。
4. 在 Mac 双击 `connect-tunnel.command`（或 `bash connect-tunnel.command`）。
5. 按脚本提示粘贴 `tunnel_id`，在终端隐藏输入 Runtime API Key（只保留在当前进程环境变量中）。脚本会运行：

   ```bash
   tunnel-client init --sample sample_mcp_stdio_local --profile mac-local-mcp --tunnel-id <ID> --mcp-command 'node "/absolute/path/src/server.mjs"'
   tunnel-client doctor --profile mac-local-mcp --explain
   tunnel-client run --profile mac-local-mcp
   ```

6. 让终端窗口继续运行；停止时按 `Ctrl+C`。若 `doctor` 报错，应先修复而不是跳过。

**重要：** 上述 `init` 命令是依据 2026 年 10 月官方 CLI 文档整理。CLI 版本更新时，以 `tunnel-client help quickstart` 的当前输出为准。

## 5. 在 ChatGPT 网页版连接

1. 打开 ChatGPT → **Plugins（插件）** → **+** → **Add custom MCP server**。
2. 给它命名 `My Mac Bridge`，在 Connection 中选 **Tunnel**，选择你的隧道或填入 `tunnel_id`。
3. 根据你的工作区策略配置身份验证，阅读风险提示，选择 **Create as a plugin**。
4. 在新对话中通过 `@My Mac Bridge` 选择该插件。
5. 第一句安全测试：

   > 请调用 workspace_info，然后只列出我的 AI-Projects 文件夹，不要更改任何内容。

6. 第二句：

   > 请在 AI-Projects 中创建目录 demo，再创建文件 demo/hello.txt，内容是 Hello MCP，然后读回验证。

7. 浏览器测试：

   > 请使用 browser_open 打开 https://example.com，再使用 browser_inspect 读取网页标题。

如果没看到「Add custom MCP server」或「Tunnel」，通常是工作区权限、关联或功能开放范围问题；请核对官方文档和工作区管理员设置。

## 6. 功能清单

| 工具 | 功能 | 是否会修改状态 |
|---|---|---|
| workspace_info | 查看当前授权范围 | 否 |
| list_workspace | 列出文件和子目录 | 否 |
| read_workspace_file | 读取文本 | 否 |
| create_workspace_directory | 创建目录 | 是 |
| write_workspace_file | 创建/明确覆盖文本文件 | 是 |
| browser_open | 独立浏览器打开允许的网站 | 会影响浏览器会话 |
| browser_inspect | 阅读网页内容和链接 | 否 |
| browser_click | 点击 CSS 选择器 | 可能提交网页数据 |
| browser_fill | 输入文字 | 会改变网页表单 |
| browser_screenshot | 当前浏览器截图 | 只读，但可能包含隐私信息 |
| browser_close | 关闭自动化浏览器 | 是 |
| run_project_task | 可选运行 allowlisted npm 脚本 | 是，默认禁用 |

## 7. FAQ

**能操作我当前打开的 Chrome 吗？** 不行。本版 Playwright 启动独立、干净的 Chromium。既不复用你当前 Chrome 标签页，也不读取 Chrome 登录 Cookies。若你特别需要已有 Chrome 的交互能力，需另做经授权的浏览器扩展方案。

**能操作所有 Mac 软件吗？** 不行。没有 Computer Use 时，Finder、Photos 等 GUI 的通用点击操作不是本版功能。我们可以为你明确指定的软件开发 AppleScript、Shortcuts 或专用 API 工具，但每个工具都需要单独定义权限和安全规则。

**能直接让 ChatGPT 安装依赖、启动后台程序吗？** 目前只开放经过筛选的项目 npm 脚本，且默认关闭。安装/长期运行应用等动作需要后续单独添加受控工具，不应该直接暴露任意 shell。

**为什么不是 ngrok？** OpenAI 的 Secure MCP Tunnel 采用本地向外建立的连接，不用把 MCP 服务暴露到公共 HTTPS 地址。其 Platform API 权限和 ChatGPT 工作区权限需要另外配置。

**如何紧急断开？** 在 Mac 上停止 `connect-tunnel.command` 的运行（`Ctrl+C`）；如果仍有服务运行，在 Platform/ChatGPT 取消隧道或插件授权。

**请注意**：本文件夹是可以下载到你 Mac 本地安装的源代码。制作 ZIP 的聊天环境与 Mac 相互隔离，我们无法替你在 Mac 上执行安装、登录 Platform、创建 API Key、批准账户权限，也不能在本会话里宣称连接已经打通。