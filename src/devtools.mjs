import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { safePath } from './sandbox.mjs';

const MAX_OUTPUT = 14000;
const running = new Map();
const supportedTasks = new Set(['test', 'build', 'lint', 'typecheck']);
const allowedPackages = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:@[a-zA-Z0-9.^~*+._-]+)?$/;
function requireEnabled(config) {
  if (config.allowProjectCommands !== true) throw new Error('Development commands are disabled in config.json');
}
async function projectDir(root, relative) {
  if (!relative || relative === '.') throw new Error('Use a named project subdirectory');
  const dir = safePath(root, relative);
  if (!(await fs.stat(dir)).isDirectory()) throw new Error('Not a project directory');
  return dir;
}
async function packageJson(root, relative) {
  const file = safePath(root, path.posix.join(relative, 'package.json'));
  const pkg = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!pkg || typeof pkg !== 'object') throw new Error('Invalid package.json');
  return pkg;
}
function cleanEnv() {
  const e = { PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, CI: '1', NO_COLOR: '1' };
  for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy']) if (process.env[key]) e[key] = process.env[key];
  return e;
}
// POSIX process groups ensure npm's children (e.g. Vite) are also terminated.
function killTree(child, signal = 'SIGTERM') {
  if (!child?.pid) return;
  try { process.kill(-child.pid, signal); }
  catch (e) { if (e.code !== 'ESRCH') { try { child.kill(signal); } catch {} } }
}
function spawnNpm(dir, args, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', args, { cwd: dir, shell: false, env: cleanEnv(), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let output = ''; let timedOut = false;
    const receive = b => { output = (output + b.toString('utf8')).slice(-MAX_OUTPUT); };
    child.stdout.on('data', receive); child.stderr.on('data', receive);
    const timer = setTimeout(() => { timedOut = true; killTree(child); setTimeout(() => killTree(child, 'SIGKILL'), 1500).unref(); }, timeoutMs);
    child.once('error', e => { clearTimeout(timer); reject(e); });
    child.once('close', code => { clearTimeout(timer); resolve({ exitCode: code, timedOut, output }); });
  });
}
export async function npmInstall(config, root, directory, packages = []) {
  requireEnabled(config);
  const dir = await projectDir(root, directory);
  await packageJson(root, directory);
  if (!Array.isArray(packages) || packages.length > 20 || !packages.every(x => typeof x === 'string' && allowedPackages.test(x))) throw new Error('Invalid package names');
  // npm dependencies can run install scripts. Disable them for this operation.
  const args = packages.length ? ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--', ...packages] : ['install', '--ignore-scripts', '--no-audit', '--no-fund'];
  return { directory, operation: 'npm install --ignore-scripts', packages, ...await spawnNpm(dir, args, 120000) };
}
export async function npmTask(config, root, directory, task) {
  requireEnabled(config);
  if (!supportedTasks.has(task) || !Array.isArray(config.allowedProjectTasks) || !config.allowedProjectTasks.includes(task)) throw new Error('Task not allowlisted');
  const dir = await projectDir(root, directory);
  const pkg = await packageJson(root, directory);
  if (!Object.hasOwn(pkg.scripts || {}, task)) throw new Error(`Missing npm script: ${task}`);
  return { directory, task, ...await spawnNpm(dir, ['run', task], task === 'build' ? 120000 : 60000) };
}
export async function devServerStart(config, root, directory) {
  requireEnabled(config);
  const dir = await projectDir(root, directory);
  if (running.has(dir)) throw new Error('Server already running for this project');
  const pkg = await packageJson(root, directory);
  if (!Object.hasOwn(pkg.scripts || {}, 'dev')) throw new Error('package.json requires a dev script');
  // The npm script may ignore --host. This is not a network sandbox.
  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1'], { cwd: dir, shell: false, env: cleanEnv(), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const record = { child, output: '', startedAt: new Date().toISOString(), directory };
  const append = b => { record.output = (record.output + b.toString('utf8')).slice(-MAX_OUTPUT); };
  child.stdout.on('data', append); child.stderr.on('data', append);
  child.once('error', e => { append(Buffer.from(e.message)); running.delete(dir); });
  child.once('close', code => { record.exitCode = code; running.delete(dir); });
  running.set(dir, record);
  await new Promise(resolve => setTimeout(resolve, 2000));
  return { directory, running: running.has(dir), pid: child.pid, recentOutput: record.output.slice(-5000) };
}
export async function devServerStatus(root, directory) {
  const dir = await projectDir(root, directory);
  const rec = running.get(dir);
  return rec ? { running: true, pid: rec.child.pid, startedAt: rec.startedAt, recentOutput: rec.output.slice(-8000) } : { running: false };
}
export async function devServerStop(config, root, directory) {
  requireEnabled(config);
  const dir = await projectDir(root, directory);
  const rec = running.get(dir);
  if (!rec) return { running: false, message: 'No managed server' };
  killTree(rec.child);
  running.delete(dir);
  return { stopped: true, directory };
}
export function stopAllServers() { for (const rec of running.values()) killTree(rec.child); running.clear(); }