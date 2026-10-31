import fs from 'node:fs/promises';
import path from 'node:path';

const norm = path.posix.normalize;

export function validateRelative(relative, { allowRoot = true } = {}) {
  if (typeof relative !== 'string' || relative.includes('\0')) throw new Error('Invalid path');
  if (relative === '.' && allowRoot) return '.';
  if (!relative || relative === '.' || path.isAbsolute(relative) || relative.includes('\\')) {
    throw new Error('Use a relative workspace path');
  }
  const parts = relative.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || p.startsWith('.'))) {
    throw new Error('Hidden paths and parent traversal are not permitted');
  }
  if (norm(relative) !== relative) throw new Error('Non-normalized path is not permitted');
  return relative;
}

export async function workspacePath(root, relative = '.', { mustExist = true, allowRoot = true } = {}) {
  const rel = validateRelative(relative, { allowRoot });
  const absolute = rel === '.' ? root : path.resolve(root, rel);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    throw new Error('Path must stay inside workspace');
  }
  const chain = rel === '.' ? [] : rel.split('/');
  let current = root;
  for (let i = 0; i < chain.length; i++) {
    current = path.join(current, chain[i]);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error('Symlinks are not allowed');
      if (i < chain.length - 1 && !stat.isDirectory()) throw new Error('Parent is not a directory');
    } catch (err) {
      if (err.code === 'ENOENT') {
        if (mustExist || i < chain.length - 1) throw new Error('Path does not exist');
        break;
      }
      throw err;
    }
  }
  return absolute;
}

export async function checkRoot(rawRoot) {
  const root = path.resolve(rawRoot);
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Workspace root must be a real directory');
  return root;
}

export async function projectPath(root, directory) {
  const folder = await workspacePath(root, directory, { allowRoot: false });
  const stat = await fs.stat(folder);
  if (!stat.isDirectory()) throw new Error('Project path must be a directory');
  return folder;
}
