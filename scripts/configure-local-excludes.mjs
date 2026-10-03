#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGitmodules } from './build-web.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.some(a => a !== '--apply')) throw new Error('Usage: node scripts/configure-local-excludes.mjs [--apply] (default: preview)');
const marker = /# manager-process-artifacts:start[\s\S]*?# manager-process-artifacts:end\n?/;
const block = readFileSync(join(root, '.gitignore'), 'utf8').match(marker)?.[0];
if (!block) throw new Error('Missing process-artifact block in root .gitignore');
function git(path, ...args) {
  const result = spawnSync('git', ['-C', path, ...args], { encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || `git failed in ${path}`);
  return result.stdout.trim();
}
const targets = new Set();
// Validate every checkout and its actual common git directory before any write.
for (const path of [root, ...parseGitmodules().map(sm => join(root, sm.path))]) {
  if (!existsSync(join(path, '.git'))) throw new Error(`Uninitialized checkout: ${path}`);
  if (realpathSync(git(path, 'rev-parse', '--show-toplevel')) !== realpathSync(path)) throw new Error(`Git owner mismatch: ${path}`);
  const commonDir = realpathSync(git(path, 'rev-parse', '--path-format=absolute', '--git-common-dir'));
  const target = git(path, 'rev-parse', '--path-format=absolute', '--git-path', 'info/exclude');
  if (resolve(target) !== join(commonDir, 'info/exclude')) throw new Error(`Unexpected exclude target: ${target}`);
  targets.add(target);
}
for (const target of targets) {
  const before = existsSync(target) ? readFileSync(target, 'utf8') : '';
  const after = marker.test(before) ? before.replace(marker, block) : `${before}${before.endsWith('\n') || !before ? '' : '\n'}\n${block}`;
  if (args.includes('--apply') && after !== before) {
    mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, after);
  }
  console.log(`[${args.includes('--apply') ? 'apply' : 'preview'}] ${target}${after === before ? ' (unchanged)' : ''}`);
}
console.log(`Checked ${targets.size} actual Git exclude files. Rules affect untracked files; tracked history is preserved.`);
