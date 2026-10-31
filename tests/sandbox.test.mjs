import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { safePath, listFiles, readFile, writeFile, makeDir } from '../src/sandbox.mjs';

test('sandbox: read, write, overwrite control, traversal, symlink', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-sandbox-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-outside-'));
  try {
    await makeDir(root, 'lesson');
    await writeFile(root, 'lesson/hello.txt', 'hello');
    assert.equal(await readFile(root, 'lesson/hello.txt'), 'hello');
    assert.equal((await listFiles(root, 'lesson'))[0].name, 'hello.txt');
    await assert.rejects(writeFile(root, 'lesson/hello.txt', 'bad'), /already exists/);
    await writeFile(root, 'lesson/hello.txt', 'updated', true);
    assert.equal(await readFile(root, 'lesson/hello.txt'), 'updated');
    assert.throws(() => safePath(root, '../secret'), /traversal/);
    assert.throws(() => safePath(root, '/etc/passwd'), /relative/);
    assert.throws(() => safePath(root, '.env'), /hidden/);
    await fs.symlink(outside, path.join(root, 'badlink'));
    assert.throws(() => safePath(root, 'badlink/test.txt'), /Symlinks/);
    await assert.rejects(readFile(root, 'badlink/anything'), /Symlinks/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});