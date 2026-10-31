import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { safePath } from './sandbox.mjs';

export async function runProjectTask(config, root, folder, task) {
  if (config.allowProjectCommands !== true) throw new Error('Project commands disabled. Review the risks, then set allowProjectCommands=true in config.json');
  if (!config.allowedProjectTasks.includes(task)) throw new Error('This task is not in allowedProjectTasks');
  if (!folder || folder === '.') throw new Error('Use a named project subdirectory');
  const dir = safePath(root, folder);
  const pkgFile = safePath(root, path.posix.join(folder, 'package.json'));
  const pkg = JSON.parse(await fs.readFile(pkgFile, 'utf8'));
  if (!Object.prototype.hasOwnProperty.call(pkg.scripts || {}, task)) throw new Error(`No ${task} script in package.json`);
  // npm scripts execute developer-authored code and can access files outside the sandbox.
  // They are intentionally opt-in; this function cannot sandbox arbitrary shell programs.
  return await new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', task], { cwd: dir, shell: false, env: { PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, CI: '1', NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const cap = data => { output = (output + data.toString('utf8')).slice(-12000); };
    child.stdout.on('data', cap); child.stderr.on('data', cap);
    child.on('error', reject);
    const timer = setTimeout(() => { child.kill('SIGTERM'); }, 25000);
    child.on('close', code => { clearTimeout(timer); resolve({ task, directory: path.relative(root, dir) || '.', exitCode: code, output }); });
  });
}