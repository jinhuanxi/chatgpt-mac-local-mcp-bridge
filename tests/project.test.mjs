import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runProjectTask } from '../src/project.mjs';

test('project commands remain off by default', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-project-'));
  try {
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'echo not-run' } }));
    await assert.rejects(runProjectTask({ allowProjectCommands: false, allowedProjectTasks: ['test'] }, root, '.', 'test'), /disabled/);
    await assert.rejects(runProjectTask({ allowProjectCommands: true, allowedProjectTasks: ['test'] }, root, '.', 'install'), /not in allowedProjectTasks/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});