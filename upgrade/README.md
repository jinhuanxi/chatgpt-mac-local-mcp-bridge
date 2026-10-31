> **Legacy upgrade only.** A fresh clone of this repository already has 17 tools; do NOT run this script on it. To upgrade a separate old 12-tool install use `bash upgrade/upgrade.command /ABSOLUTE/PATH/TO/OLD/mac-local-mcp-bridge`.

# Mac Local MCP 开发者模式升级 v0.2

## 功能
新增 5 个工具：`dev_npm_install`（安装依赖，禁用 npm install 生命周期脚本）、`dev_npm_task`（执行 allowlist 内的 npm 脚本）、`dev_server_start`、`dev_server_status`、`dev_server_stop`。
原有 12 个 MCP 工具保持不变；新版预计共 17 个。

## 升级（先备份、先停止隧道）
1. 在运行 tunnel-client 的终端按 Control+C 停止隧道，等待退出。
2. 解压本升级包到 `本仓库 upgrade/ 目录`。
3. 新开 Mac 终端：

```bash
cd 本仓库 upgrade/ 目录
bash upgrade.command
```

脚本默认目标为本仓库根目录；只有升级另一个旧版本时才传入旧版完整路径。如果你的旧版位置不同，请传入其完整目录路径，例如 `bash upgrade.command "$HOME/Documents/mac-local-mcp-bridge"`。
脚本备份原 `server.mjs` 和 `package.json` 至旧项目的 `.upgrade-backups/`，不会复制、更改或输出 `config.json`、API Key、隧道 Profile。

4. 验证 `UPGRADE SUCCESSFUL`，检查脚本自动执行的测试没有错误。
5. 在旧项目的 `config.json` 把 `"allowProjectCommands": false` 改为 `true`；将 `"allowedProjectTasks"` 改为 ` ["test", "build", "lint", "typecheck"]`。推荐用文本编辑器修改且保留其他原值。不要粘贴 API Key 到 `config.json`。
6. 回到原目录，用原 profile 启动：`tunnel-client run --profile mac-local-mcp`。如果 profile 需要 runtime 密钥，按原来安全方式在当前终端导入；不要在聊天中分享。
7. ChatGPT 插件的工具清单可能需要刷新/重新同步；确认新增 5 个工具，重审工具授权。新的写入、运行类工具请设置成调用前询问。

## 安全边界
- 命令工具**不是 OS 级沙箱**；npm 脚本甚至依赖中的构建代码，都可能执行任意代码。
- `dev_npm_install` 使用 `--ignore-scripts`，只允许格式验证通过的包名；仍需信任软件源及依赖包。
- `dev_npm_task` 不接受任意 Shell 字符串，只接收预先配置的 script 名称，但 **package.json 的 script 内容可执行任意命令**。
- `dev_server_start` 试图用 `127.0.0.1` 限定服务监听，但实际监听行为由项目脚本决定。只运行可信项目，不要依赖此参数进行系统隔离。
- 没有添加 `rm`、`sudo`、`curl | sh`、任意 shell 执行工具。
- 长时进程只在 MCP server 存活期间受管理，服务终止后可能留下孙进程；如需强制隔离，未来建议使用容器/VM。
- 修改 `allowProjectCommands` 前，先检查 ChatGPT 的 MCP 审批选项以及所有工具可见范围。

## 首次测试指令
“请用 Mac Local MCP 的 dev_server_status 检查 `demo` 项目的服务状态；不要启动、安装或修改任何东西。”

接着可以创建一个简单 Vite 项目，人工检查文件并批准 `npm install`，然后启动本地开发服务器。

## v0.2.1 复查修正（请以此升级包为准）
- 修复停止开发服务器时可能残留 npm 子进程的问题：在 macOS 上使用独立进程组并向进程组发送停止信号。
- 升级执行期间若代码检查或测试失败，自动恢复原 server.mjs、package.json 和 devtools.mjs（如原先存在）。
- `dev_npm_task` 仅允许 test/build/lint/typecheck，长期运行的 dev 交给 `dev_server_start`。
- 要求明确的项目子目录及 package.json，避免在工作区根目录误操作。
- 重新运行升级脚本和原有 3 项自动化测试，全部通过；还额外验证了命令默认关闭和非法任务拒绝。没有在用户 Mac 上做端到端运行测试。
- 当前没有添加任意 Shell 执行入口。npm scripts 即使受限仍具有代码执行能力。只有在检查项目 package.json 后才启用命令权限。

安装后测试命令：
```bash
cd 旧版安装目录（需以参数明确传入）
npm run check
```

如果升级失败，把终端最后的错误输出发给助手，不要继续修改 config.json 或重启隧道。