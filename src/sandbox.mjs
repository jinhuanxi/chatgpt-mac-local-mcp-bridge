import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

const MAX_FILE_BYTES = 200 * 1024;
export function expandHome(value) {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}
export function workspaceRoot(config) {
  const requested = path.resolve(expandHome(config.workspaceRoot));
  if (!fsSync.existsSync(requested)) throw new Error(`Workspace directory does not exist: ${requested}. Run setup.command first.`);
  const root = fsSync.realpathSync(requested);
  if (!fsSync.statSync(root).isDirectory()) throw new Error('Workspace root is not a directory');
  return root;
}
export function inside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}
export function safePath(root, relative = '.', { allowRoot = false } = {}) {
  if (typeof relative !== 'string' || !relative.length || relative.length > 240 || relative.includes('\u0000')) throw new Error('Invalid path');
  if (relative.includes('\\') || path.isAbsolute(relative) || relative.startsWith('~')) throw new Error('Use relative paths within the workspace');
  const parts = relative.split('/');
  if (parts.some(part => part === '..' || (part.startsWith('.') && part !== '.'))) {
    throw new Error('Parent-directory traversal and hidden files/directories are blocked');
  }
  const absolute = path.resolve(root, relative);
  if (!inside(root, absolute) || (!allowRoot && absolute === root)) throw new Error('Path is outside workspace or refers to its root');
  // Reject symlinks on every existing path segment to avoid escaping the workspace.
  const rel = path.relative(root, absolute);
  let current = root;
  for (const segment of rel.split(path.sep)) {
    if (!segment) continue;
    current = path.join(current, segment);
    try {
      const st = fsSync.lstatSync(current);
      if (st.isSymbolicLink()) throw new Error('Symlinks are blocked in this workspace');
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return absolute;
}
export async function listFiles(root, relative = '.') {
  const dir = safePath(root, relative, { allowRoot: true });
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const safeEntries = entries.filter(e => !e.name.startsWith('.') && !e.isSymbolicLink());
  return safeEntries.slice(0, 120).map(e => ({ name: e.name, type: e.isDirectory() ? 'directory' : e.isFile() ? 'file' : 'other' }));
}
export async function readFile(root, relative) {
  const file = safePath(root, relative);
  const stat = await fs.stat(file);
  if (!stat.isFile()) throw new Error('Only regular files can be read');
  if (stat.size > MAX_FILE_BYTES) throw new Error('File exceeds 200 KiB limit');
  const buffer = await fs.readFile(file);
  if (buffer.includes(0)) throw new Error('Binary files cannot be read as text');
  return buffer.toString('utf8');
}
export async function writeFile(root, relative, content, overwrite = false) {
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) throw new Error('Text must be at most 200 KiB');
  const file = safePath(root, relative);
  const parent = path.dirname(file);
  const canonicalParent = await fs.realpath(parent);
  const canonicalRoot = await fs.realpath(root);
  if (!inside(canonicalRoot, canonicalParent)) throw new Error('Parent directory is outside workspace');
  // Fresh unique temp file and atomic rename; do not follow symlinks in the target.
  const temp = path.join(parent, `.mcp-tmp-${randomUUID()}`);
  let created = false;
  try {
    if (fsSync.existsSync(file) || await fs.lstat(file).then(() => true, e => e.code === 'ENOENT' ? false : Promise.reject(e))) {
      if (!overwrite) throw new Error('File already exists: set overwrite=true only after reviewing its contents');
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Can only overwrite a regular non-symlink file');
    }
    await fs.writeFile(temp, content, { flag: 'wx', mode: 0o600 });
    created = true;
    // Final check before replacement. Workspace is not protected against a concurrent hostile local process.
    safePath(root, relative);
    await fs.rename(temp, file);
    return { path: relative, bytes: Buffer.byteLength(content, 'utf8') };
  } finally {
    if (created) await fs.rm(temp, { force: true }).catch(() => {});
  }
}
export async function makeDir(root, relative) {
  const dir = safePath(root, relative);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  safePath(root, relative);
  return { path: relative };
}