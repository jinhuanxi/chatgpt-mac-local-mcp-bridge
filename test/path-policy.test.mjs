import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { checkRoot, validateRelative, workspacePath, projectPath } from '../src/path-policy.mjs';

test('path policy denies traversal, absolute and hidden paths', () => {
  for (const p of ['../secret', '/tmp/x', '.env', 'foo/.ssh', 'foo//bar', 'a/../b', 'a\\b', '']) {
    assert.throws(() => validateRelative(p));
  }
  assert.equal(validateRelative('.'), '.');
  assert.equal(validateRelative('proj/src/index.js'), 'proj/src/index.js');
});

test('path policy denies symlinks and missing parents', async (t) => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-bridge-test-'));
  t.after(async () => fs.rm(tmp, { recursive: true, force: true }));
  const root = await checkRoot(path.join(tmp, 'work'));
  await fs.mkdir(path.join(root, 'project'));
  await fs.symlink(tmp, path.join(root, 'out'));
  await assert.rejects(() => workspacePath(root, 'out'));
  await assert.rejects(() => workspacePath(root, 'out/secret'));
  await assert.rejects(() => workspacePath(root, 'missing/file', { mustExist: false }));
  assert.equal(await projectPath(root, 'project'), path.join(root, 'project'));
  assert.equal(await workspacePath(root, 'project/new.txt', { mustExist: false }), path.join(root, 'project/new.txt'));
});
