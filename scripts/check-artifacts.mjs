#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGitmodules } from './build-web.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const limit = 5 * 1024 * 1024;
const runtime = /(?:^|\/)(?:assets|fonts|images|static|public|docs|[^/]+\.xcassets)\//;
let failures = 0;
function git(path, args, input) {
  const result = spawnSync('git', ['-C', path, ...args], { encoding: 'utf8', input, shell: false });
  if (result.status !== 0 && !(args[0] === 'check-ignore' && result.status === 1)) throw new Error(result.stderr || `git failed: ${path}`);
  return result.stdout;
}
for (const path of [root, ...parseGitmodules().map(sm => join(root, sm.path))]) {
  if (!existsSync(join(path, '.git')) || realpathSync(git(path, ['rev-parse', '--show-toplevel']).trim()) !== realpathSync(path)) {
    console.error(`[artifact] Uninitialized or mismatched repository: ${path}`); failures++; continue;
  }
  // Only new staged/untracked files: historical tracked files remain an audit decision.
  const staged = git(path, ['diff', '--cached', '--name-only', '--diff-filter=A', '-z']).split('\0').filter(Boolean);
  const untracked = git(path, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  if (staged.length) {
    const ignored = git(path, ['check-ignore', '--no-index', '--stdin', '-z'], staged.join('\0') + '\0').split('\0').filter(Boolean);
    for (const file of ignored) { console.error(`[artifact] New staged file violates ignore rules: ${join(path, file)}`); failures++; }
  }
  for (const file of new Set([...staged, ...untracked])) {
    const fullPath = join(path, file);
    if (!existsSync(fullPath)) continue;
    const stat = lstatSync(fullPath);
    if (stat.isFile() && stat.size >= limit && !runtime.test(file)) {
      console.error(`[artifact] New non-runtime file >=5 MiB: ${fullPath} (${stat.size} bytes)`); failures++;
    }
  }
}
console.log(`[check-artifacts] ${failures ? `FAILED: ${failures} new artifact violation(s)` : 'PASS: new files respect process boundaries and the 5 MiB limit'}`);
if (failures) process.exitCode = 1;
