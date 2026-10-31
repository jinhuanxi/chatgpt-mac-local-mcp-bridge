import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { checkRoot, workspacePath, projectPath } from './path-policy.mjs';

const root = await checkRoot(process.env.MCP_WORKSPACE_ROOT || path.join(os.homedir(), 'AI-Projects'));
const allowCommands = process.env.MCP_ALLOW_PROJECT_COMMANDS === 'true';
const hosts = (process.env.MCP_ALLOWED_WEB_HOSTS || 'localhost,127.0.0.1,example.com').split(',').map(x => x.trim().toLowerCase());
const mcp = new McpServer({ name: 'chatgpt-mac-local-mcp-bridge', version: '0.1.0' });
const managed = new Map();
let browser, page;
const ok = data => ({ content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] });
const register = (name, description, fields, fn) => mcp.registerTool(name, {
  description, inputSchema: z.object(fields)
}, async args => {
  try { return await fn(args); }
  catch (error) { return { isError: true, content: [{ type: 'text', text: String(error.message || error) }] }; }
});
const requireCommands = () => { if (!allowCommands) throw new Error('Project commands disabled'); };
const childEnv = () => {
  const env = {};
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'TERM']) if (process.env[key]) env[key] = process.env[key];
  return { ...env, CI: '1', HOST: '127.0.0.1', BROWSER: 'none' };
};
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const scripts = async cwd => (JSON.parse(await fs.readFile(path.join(cwd, 'package.json'), 'utf8'))).scripts || {};
const safePackage = s => /^(@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)(@[~^<>*=a-z0-9._-]+)?$/i.test(s);
const task = (cwd, args, ms = 120000) => new Promise((resolve, reject) => {
  const child = spawn(npm, args, { cwd, env: childEnv(), shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  const append = x => { log = (log + x.toString()).slice(-12000); };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  const timer = setTimeout(() => child.kill('SIGTERM'), ms);
  child.on('error', e => { clearTimeout(timer); reject(e); });
  child.on('close', (code, signal) => { clearTimeout(timer); resolve({ exitCode: code, signal, output: log }); });
});
const validUrl = raw => {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !hosts.includes(url.hostname.toLowerCase())) {
    throw new Error('URL is outside the browser host allowlist');
  }
  return url;
};
const current = () => { if (!page || page.isClosed()) throw new Error('Open a browser first'); return page; };
const status = folder => {
  const rec = managed.get(folder);
  return rec ? { running: rec.child.exitCode === null && rec.child.signalCode === null, pid: rec.child.pid, output: rec.log.slice(-6000) } : { running: false };
};
const stop = folder => {
  const rec = managed.get(folder);
  if (!rec) return { running: false };
  try {
    if (process.platform === 'win32') rec.child.kill('SIGTERM');
    else process.kill(-rec.child.pid, 'SIGTERM');
  } catch (e) { if (e.code !== 'ESRCH') throw e; }
  managed.delete(folder);
  return { stopped: true };
};

register('workspace_info', 'Show authorized workspace root and enabled capabilities', {}, async () => ok({ root, browserHosts: hosts, allowProjectCommands: allowCommands }));
register('list_workspace', 'List non-hidden directory entries in workspace', { directory: z.string().default('.') }, async ({ directory }) => {
  const folder = await workspacePath(root, directory);
  return ok((await fs.readdir(folder, { withFileTypes: true })).filter(e => !e.name.startsWith('.') && !e.isSymbolicLink()).map(e => ({ name: e.name, type: e.isDirectory() ? 'directory' : 'file' })));
});
register('read_workspace_file', 'Read UTF-8 file, up to 200 KiB', { path: z.string() }, async ({ path: rel }) => {
  const p = await workspacePath(root, rel, { allowRoot: false });
  const stat = await fs.stat(p);
  if (!stat.isFile() || stat.size > 204800) throw new Error('File is unavailable or too large');
  return ok(await fs.readFile(p, 'utf8'));
});
register('create_workspace_directory', 'Create one workspace directory', { path: z.string() }, async ({ path: rel }) => {
  const p = await workspacePath(root, rel, { mustExist: false, allowRoot: false });
  await fs.mkdir(p);
  return ok({ created: rel });
});
register('write_workspace_file', 'Create a workspace UTF-8 file; explicit overwrite required', { path: z.string(), content: z.string(), overwrite: z.boolean().default(false) }, async ({ path: rel, content, overwrite }) => {
  if (Buffer.byteLength(content) > 204800) throw new Error('File exceeds 200 KiB');
  const p = await workspacePath(root, rel, { mustExist: false, allowRoot: false });
  await fs.writeFile(p, content, { encoding: 'utf8', flag: overwrite ? 'w' : 'wx', mode: 0o600 });
  return ok({ written: rel, overwrite });
});
register('browser_open', 'Open allowlisted URL in isolated Playwright Chromium', { url: z.string().url() }, async ({ url }) => {
  validUrl(url);
  if (browser) await browser.close();
  browser = await chromium.launch({ headless: true, env: childEnv() });
  const context = await browser.newContext({ acceptDownloads: false, serviceWorkers: 'block' });
  await context.route('**/*', async route => {
    try { validUrl(route.request().url()); await route.continue(); }
    catch { await route.abort('blockedbyclient'); }
  });
  page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  return ok({ title: await page.title(), url: page.url() });
});
register('browser_inspect', 'Read page title, text and up to 25 links', {}, async () => {
  const p = current();
  return ok({ title: await p.title(), url: p.url(), text: (await p.locator('body').innerText()).slice(0, 12000), links: await p.locator('a[href]').evaluateAll(nodes => nodes.slice(0, 25).map(n => ({ text: n.textContent?.trim().slice(0, 100), href: n.href }))) });
});
register('browser_click', 'Click CSS selector; confirm consequential actions with user', { selector: z.string().min(1).max(200) }, async ({ selector }) => {
  await current().locator(selector).first().click({ timeout: 10000 });
  return ok({ clicked: selector });
});
register('browser_fill', 'Fill page element; never enter secrets by default', { selector: z.string().min(1).max(200), value: z.string().max(5000) }, async ({ selector, value }) => {
  await current().locator(selector).first().fill(value, { timeout: 10000 });
  return ok({ filled: selector });
});
register('browser_screenshot', 'Capture current browser viewport (may contain private data)', {}, async () => ({
  content: [{ type: 'image', data: (await current().screenshot({ type: 'png' })).toString('base64'), mimeType: 'image/png' }]
}));
register('browser_close', 'Close isolated browser', {}, async () => {
  if (browser) await browser.close(); browser = undefined; page = undefined;
  return ok({ closed: true });
});
register('run_project_task', 'Run allowlisted npm test, build or lint; not sandboxed', { directory: z.string(), task: z.enum(['test', 'build', 'lint']) }, async ({ directory, task: name }) => {
  requireCommands(); const cwd = await projectPath(root, directory);
  if (!(await scripts(cwd))[name]) throw new Error('npm script missing');
  return ok(await task(cwd, ['run', name]));
});
register('dev_npm_install', 'Install registry packages without lifecycle scripts; requires approval', { directory: z.string(), packages: z.array(z.string()).max(20).default([]) }, async ({ directory, packages }) => {
  requireCommands(); const cwd = await projectPath(root, directory);
  if (!packages.every(safePackage)) throw new Error('Invalid package name');
  return ok(await task(cwd, ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-progress', ...packages], 180000));
});
register('dev_npm_task', 'Run allowlisted npm task; requires approval', { directory: z.string(), task: z.enum(['test', 'build', 'lint', 'typecheck']) }, async ({ directory, task: name }) => {
  requireCommands(); const cwd = await projectPath(root, directory);
  if (!(await scripts(cwd))[name]) throw new Error('npm script missing');
  return ok(await task(cwd, ['run', name]));
});
register('dev_server_start', 'Start managed npm dev server; requires approval', { directory: z.string() }, async ({ directory }) => {
  requireCommands(); const cwd = await projectPath(root, directory);
  const dev = (await scripts(cwd)).dev;
  if (!dev || /0\.0\.0\.0/.test(dev)) throw new Error('Missing dev script or potentially public bind');
  if (status(cwd).running) return ok(status(cwd));
  const child = spawn(npm, ['run', 'dev'], { cwd, env: childEnv(), shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  const rec = { child, log: '' };
  const add = chunk => { rec.log = (rec.log + chunk.toString()).slice(-12000); };
  child.stdout.on('data', add); child.stderr.on('data', add);
  child.on('error', e => { rec.log += e.message; });
  managed.set(cwd, rec);
  return ok({ started: true, pid: child.pid, note: 'Verify actual server binds to 127.0.0.1; npm scripts are not sandboxed' });
});
register('dev_server_status', 'Check managed dev server status', { directory: z.string() }, async ({ directory }) => ok(status(await projectPath(root, directory))));
register('dev_server_stop', 'Stop managed dev server', { directory: z.string() }, async ({ directory }) => {
  requireCommands(); return ok(stop(await projectPath(root, directory)));
});
process.on('SIGTERM', () => {
  for (const cwd of managed.keys()) { try { stop(cwd); } catch {} }
  if (browser) browser.close().catch(() => {});
});
await mcp.connect(new StdioServerTransport());
console.error('chatgpt-mac-local-mcp-bridge ready');
