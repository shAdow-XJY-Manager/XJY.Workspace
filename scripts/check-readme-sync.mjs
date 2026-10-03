#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGitmodules } from './build-web.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const submodules = parseGitmodules();
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const rows = [...readme.matchAll(/^\| \[([^\]]+)\]\(([^)]+)\/\) \| \[[^\]]+\]\(([^)]+)\) \|$/gm)];
const expected = new Map(submodules.map(sm => [sm.path, sm.url.replace(/\.git$/, '')]));
const documented = new Set();
let failed = false;
for (const [, path, link, url] of rows) {
  if (documented.has(path) || path !== link || expected.get(path) !== url) {
    console.error(`[check-readme] Duplicate or mismatched navigation entry: ${path}`); failed = true;
  }
  documented.add(path);
}
for (const path of expected.keys()) {
  if (!documented.has(path)) { console.error(`[check-readme] Missing navigation entry: ${path}`); failed = true; }
}
const count = Number(readme.match(/\*\*总计[：:]\s*(\d+)\s*个子模块\*\*/)?.[1]);
if (count !== submodules.length || rows.length !== submodules.length) {
  console.error(`[check-readme] Count mismatch: marker=${count}, rows=${rows.length}, gitmodules=${submodules.length}`); failed = true;
}
if (failed) process.exitCode = 1;
else console.log(`[check-readme] PASS: all ${submodules.length} paths, local links, remote URLs and total count match .gitmodules.`);
