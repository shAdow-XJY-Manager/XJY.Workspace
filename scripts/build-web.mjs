#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 解析 .gitmodules 获取所有子模块
 */
export function parseGitmodules(workspaceRoot = root) {
  const gitmodulesPath = join(workspaceRoot, '.gitmodules');
  if (!existsSync(gitmodulesPath)) {
    throw new Error('.gitmodules file not found');
  }

  const content = readFileSync(gitmodulesPath, 'utf8');
  const submodules = [];
  const lines = content.split('\n');
  
  let currentSubmodule = null;
  
  for (const line of lines) {
    const submoduleMatch = line.match(/^\[submodule\s+"([^"]+)"\]/);
    if (submoduleMatch) {
      if (currentSubmodule) {
        submodules.push(currentSubmodule);
      }
      currentSubmodule = { name: submoduleMatch[1] };
      continue;
    }
    
    const pathMatch = line.match(/^\s*path\s*=\s*(.+)$/);
    if (pathMatch && currentSubmodule) {
      currentSubmodule.path = pathMatch[1].trim();
      continue;
    }
    
    const urlMatch = line.match(/^\s*url\s*=\s*(.+)$/);
    if (urlMatch && currentSubmodule) {
      currentSubmodule.url = urlMatch[1].trim();
    }
  }
  
  if (currentSubmodule) {
    submodules.push(currentSubmodule);
  }
  
  return submodules;
}

export function repositoryName(url) {
  const match = url.match(/(?:\/|:)([^/:]+?)(?:\.git)?\/?$/);
  if (!match) throw new Error(`Cannot extract repository name: ${url}`);
  return match[1];
}

export function detectTech(fullPath) {
  const pubspecPath = join(fullPath, 'pubspec.yaml');
  if (existsSync(pubspecPath)) {
    const pubspec = readFileSync(pubspecPath, 'utf8');
    if (/^\s*flutter:\s*\n\s+sdk:\s*flutter\s*$/m.test(pubspec)) {
      const metadata = existsSync(join(fullPath, '.metadata'))
        ? readFileSync(join(fullPath, '.metadata'), 'utf8') : '';
      const type = metadata.match(/^project_type:\s*["']?(\w+)/m)?.[1];
      const main = existsSync(join(fullPath, 'lib/main.dart'));
      if (type === 'package' || type === 'plugin' || (!type && !main)) {
        return { type: 'flutter-library', isWeb: false };
      }
      return { type: 'flutter', isWeb: main && existsSync(join(fullPath, 'web/index.html')) };
    }
    return { type: 'dart', isWeb: false };
  }
  if (['vue.config.js', 'vue.config.cjs'].some(f => existsSync(join(fullPath, f)))) {
    return { type: 'vue-cli', isWeb: true };
  }
  if (['vite.config.js', 'vite.config.ts', 'vite.config.mjs'].some(f => existsSync(join(fullPath, f)))) {
    return { type: 'vite', isWeb: true };
  }
  if (existsSync(join(fullPath, 'package.json'))) {
    const pkg = JSON.parse(readFileSync(join(fullPath, 'package.json'), 'utf8'));
    if (pkg.dependencies?.['react-scripts'] || pkg.devDependencies?.['react-scripts']) {
      return { type: 'cra', isWeb: true };
    }
  }
  return { type: 'unknown', isWeb: false };
}

function repositoryOwner(url) {
  return url.match(/[/:]([^/:]+)\/[^/]+\/?$/)?.[1]?.toLowerCase();
}

export function readCnames(repoRoot) {
  return ['docs/CNAME', 'CNAME', 'web/CNAME'].flatMap(source => {
    const path = join(repoRoot, source);
    const domain = existsSync(path) ? readFileSync(path, 'utf8').trim().toLowerCase().replace(/\.$/, '') : '';
    return domain ? [{ source, domain }] : [];
  });
}

export function discoverProjects(workspaceRoot = root) {
  const submodules = parseGitmodules(workspaceRoot);
  const packagePath = join(workspaceRoot, 'package.json');
  const groups = existsSync(packagePath) ? JSON.parse(readFileSync(packagePath, 'utf8')).flutterTargets || {} : {};
  const intents = new Map();
  for (const [intent, paths] of Object.entries(groups)) {
    if (!['web', 'native', 'examples'].includes(intent) || !Array.isArray(paths)) throw new Error(`Invalid Flutter target group: ${intent}`);
    for (const path of paths) {
      if (typeof path !== 'string' || intents.has(path)) throw new Error(`Invalid or duplicate Flutter target: ${path}`);
      intents.set(path, intent);
    }
  }
  const organizationDomains = new Map(submodules
    .filter(sm => repositoryName(sm.url).toLowerCase() === `${repositoryOwner(sm.url)}.github.io`)
    .map(sm => [repositoryOwner(sm.url), readCnames(join(workspaceRoot, sm.path))[0]?.domain]));
  const projects = [];
  for (const sm of submodules) {
    const repoRoot = join(workspaceRoot, sm.path);
    if (!existsSync(repoRoot)) continue;
    // ponytail: one-level nested apps/examples; deepen only if a real repository needs it.
    const candidates = ['', ...readdirSync(repoRoot, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.') && existsSync(join(repoRoot, e.name, 'pubspec.yaml')))
      .map(e => e.name)];
    for (const subdir of candidates) {
      const fullPath = join(repoRoot, subdir);
      const tech = detectTech(fullPath);
      if (tech.type === 'unknown') continue;
      const path = subdir ? `${sm.path}/${subdir}` : sm.path;
      projects.push({ ...tech, path, intent: intents.get(path) || 'unconfigured',
        fullPath, repoRoot, repoName: repositoryName(sm.url), subdir,
        owner: repositoryOwner(sm.url), organizationDomain: organizationDomains.get(repositoryOwner(sm.url)) });
    }
  }
  for (const path of intents.keys()) {
    if (!projects.some(p => p.path === path && p.type === 'flutter')) throw new Error(`Configured Flutter application not found: ${path}`);
  }
  return projects;
}

export function webBuildReason(project, options = {}) {
  if (project.type === 'flutter') {
    if (project.intent === 'native') return 'native application; Web scaffold does not authorize Web publication';
    if (!['web', 'native', 'examples'].includes(project.intent)) return 'no explicit Flutter target intent in package.json';
    if (project.intent === 'examples' && options.project !== project.path) return 'component example; requires an explicit --project';
    if (project.intent === 'examples' && options.updateDocs) return 'component example is for validation; docs publication is disabled';
  }
  if (!project.isWeb) return `${project.type}: no runnable Web target`;
  if (project.type === 'vue-cli') return 'Vue CLI: configure publicPath and build destination manually';
  return null;
}

export function baseHref(project, override, cnameDecision) {
  if (override) return override;
  if (project.repoName.toLowerCase() === `${project.owner}.github.io`) return '/';
  const cname = cnameDecision === undefined ? readCnames(project.repoRoot)[0]?.domain : cnameDecision;
  return cname && cname !== project.organizationDomain ? '/' : `/${project.repoName}/`;
}

export function cnameWarnings(project) {
  const cnames = readCnames(project.repoRoot);
  const selected = cnames[0];
  if (!selected) return [];
  const warnings = [];
  if (cnames.some(cname => cname.domain !== selected.domain)) {
    warnings.push(`CNAME conflict: using ${selected.source}=${selected.domain}; lower-priority ${cnames.slice(1).map(c => `${c.source}=${c.domain}`).join(', ')}; files unchanged.`);
  }
  if (project.repoName.toLowerCase() !== `${project.owner}.github.io` && selected.domain === project.organizationDomain) {
    warnings.push(`Duplicate organization CNAME ${selected.source}=${selected.domain}; using /${project.repoName}/ under the shared domain. Verify stale project CNAME/settings separately; files and remote settings unchanged.`);
  }
  return warnings;
}

export function buildCommand(project, output, override, cnameDecision) {
  const base = baseHref(project, override, cnameDecision);
  switch (project.type) {
    case 'flutter':
      return { command: 'flutter', args: ['build', 'web', '--release', '--base-href', base, '--output', output] };
    case 'vite':
      return { command: join(project.fullPath, 'node_modules/.bin/vite'), args: ['build', '--base', base, '--outDir', output] };
    case 'cra':
      return { command: 'npm', args: ['run', 'build'], env: { PUBLIC_URL: base, BUILD_PATH: output } };
    default: return null;
  }
}

function contains(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

function canonicalPath(path) {
  let existing = resolve(path);
  const tail = [];
  while (!existsSync(existing)) {
    tail.unshift(basename(existing));
    existing = dirname(existing);
  }
  return join(realpathSync(existing), ...tail);
}

export function checkOutputRoot(outputRoot, workspaceRoot, projects) {
  const output = canonicalPath(outputRoot);
  for (const repository of [workspaceRoot, ...projects.map(p => p.repoRoot)]) {
    const repo = realpathSync(repository);
    if (contains(repo, output) || contains(output, repo)) {
      throw new Error(`Output root must be outside repositories and their ancestors: ${outputRoot}`);
    }
  }
}

// Copy to a sibling first. Build/copy failure leaves the old docs intact; rename failure restores it.
export function updateDeployment(output, docs, cnameDecision) {
  if (!existsSync(join(output, 'index.html'))) throw new Error(`Missing built index.html: ${output}`);
  if (cnameDecision === undefined) throw new Error('Deployment requires an explicit CNAME decision; confirm remote Pages configuration first.');
  if (existsSync(docs) && (!lstatSync(docs).isDirectory() || lstatSync(docs).isSymbolicLink())) {
    throw new Error(`Deployment target must be a real directory: ${docs}`);
  }
  mkdirSync(dirname(docs), { recursive: true });
  const transaction = mkdtempSync(join(dirname(docs), '.deploy-'));
  const next = join(transaction, 'next');
  const backup = join(transaction, 'previous');
  let moved = false;
  try {
    cpSync(output, next, { recursive: true });
    for (const file of ['.nojekyll']) {
      const metadata = [join(docs, file), join(dirname(docs), file)].find(existsSync);
      if (metadata) cpSync(metadata, join(next, file));
    }
    rmSync(join(next, 'CNAME'), { force: true });
    if (cnameDecision !== null) writeFileSync(join(next, 'CNAME'), `${cnameDecision}\n`);
    if (existsSync(docs)) { renameSync(docs, backup); moved = true; }
    try { renameSync(next, docs); }
    catch (error) { if (moved) renameSync(backup, docs); throw error; }
  } finally {
    // A restore failure retains the backup for manual recovery.
    if (!moved || existsSync(docs)) rmSync(transaction, { recursive: true, force: true });
  }
}

export function executeBuild(project, options, run = spawnSync) {
  const reason = webBuildReason(project, options);
  if (reason) throw new Error(`${project.path}: ${reason}`);
  if (options.updateDocs && options.cname === undefined) throw new Error('Deployment requires an explicit CNAME decision.');
  const label = `${project.repoName}${project.subdir ? `-${project.subdir}` : ''}`;
  let output = join(options.outputRoot, label, 'web');
  if (!options.dryRun) {
    mkdirSync(options.outputRoot, { recursive: true });
    output = join(mkdtempSync(join(options.outputRoot, `${label}-`)), 'web');
  }
  const plan = buildCommand(project, output, options.baseHref, options.cname);
  console.log(`[${options.dryRun ? 'dry-run' : 'build'}] ${project.path}`);
  console.log(JSON.stringify({ cwd: project.fullPath, ...plan, output, updateDocs: Boolean(options.updateDocs), cnameDecision: options.cname }));
  if (options.dryRun) return true;
  const result = run(plan.command, plan.args, { cwd: project.fullPath, stdio: 'inherit',
    env: { ...process.env, ...plan.env }, shell: false });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) return false;
  if (!existsSync(join(output, 'index.html'))) throw new Error(`Build produced no index.html: ${output}`);
  if (project.type === 'flutter' && !existsSync(join(output, 'main.dart.js'))) {
    throw new Error(`Flutter build produced no main.dart.js: ${output}`);
  }
  if (options.updateDocs) updateDeployment(output, join(project.repoRoot, 'docs'), options.cname);
  return true;
}

export function parseArgs(args) {
  const options = { outputRoot: join(homedir(), '.cache/shadow-xjy-manager/web-builds') };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run': options.dryRun = true; break;
      case '--flutter-only': options.flutterOnly = true; break;
      case '--vue-only': options.vueOnly = true; break;
      case '--update-docs': options.updateDocs = true; break;
      case '--help': options.help = true; break;
      case '--no-cname':
        if (options.cname !== undefined) throw new Error('Choose only one CNAME decision.');
        options.cname = null; break;
      case '--output-root':
      case '--base-href':
      case '--cname':
      case '--project': {
        const key = args[i] === '--project' ? 'project' : args[i] === '--base-href' ? 'baseHref' : args[i] === '--cname' ? 'cname' : 'outputRoot';
        if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${args[i]} requires a value`);
        if (key === 'cname' && options.cname !== undefined) throw new Error('Choose only one CNAME decision.');
        options[key] = args[++i]; break;
      }
      case '--parallel': throw new Error('--parallel is unsupported; builds run serially to avoid Flutter SDK locks.');
      default: throw new Error(`Unknown argument: ${args[i]}`);
    }
  }
  if (options.flutterOnly && options.vueOnly) throw new Error('Choose only one technology filter.');
  if (options.updateDocs && !options.project) throw new Error('--update-docs requires one explicit --project path.');
  if (options.updateDocs && options.cname === undefined) throw new Error('--update-docs requires --cname DOMAIN or --no-cname after checking remote Pages settings.');
  if (options.cname !== undefined && !options.project) throw new Error('CNAME decision requires one --project.');
  if (typeof options.cname === 'string') {
    options.cname = options.cname.toLowerCase().replace(/\.$/, '');
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(options.cname)) throw new Error('--cname requires a DNS domain, without a URL scheme or path.');
  }
  if (options.baseHref && (!options.project || !/^\/(?:[A-Za-z0-9._~%-]+\/)*$/.test(options.baseHref))) {
    throw new Error('--base-href requires one --project and a root-relative path ending with / (for example / or /XJY.App/).');
  }
  options.outputRoot = resolve(options.outputRoot);
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: node scripts/build-web.mjs [--dry-run] [--flutter-only|--vue-only] [--project PATH] [--output-root EXTERNAL_PATH] [--base-href /PATH/] [--update-docs (--cname DOMAIN|--no-cname)]');
    return;
  }
  const allProjects = discoverProjects();
  checkOutputRoot(options.outputRoot, root, allProjects);
  if (options.project) {
    const selected = allProjects.find(p => p.path === options.project);
    if (!selected) throw new Error(`Unknown project: ${options.project}`);
    if ((options.flutterOnly && !selected.type.startsWith('flutter')) || (options.vueOnly && selected.type !== 'vue-cli')) {
      throw new Error(`Project does not match technology filter: ${options.project}`);
    }
  }
  let failed = 0, built = 0, skipped = 0;
  for (const project of allProjects) {
    if (options.project && project.path !== options.project) continue;
    if (options.flutterOnly && !project.type.startsWith('flutter')) continue;
    if (options.vueOnly && project.type !== 'vue-cli') continue;
    const reason = webBuildReason(project, options);
    if (reason || !buildCommand(project, 'preview', options.baseHref, options.cname)) {
      console.log(`[skip] ${project.path}: ${reason || 'unsupported build command'}`);
      skipped++;
      if (options.project || project.intent === 'web') failed++;
      continue;
    }
    for (const warning of cnameWarnings(project)) console.warn(`[warning] ${project.path}: ${warning}`);
    try { if (executeBuild(project, options)) built++; else failed++; }
    catch (error) { console.error(error.message); failed++; }
  }
  console.log(`Summary: ${options.dryRun ? 'planned' : 'built'}=${built} failed=${failed} skipped=${skipped}; serial execution`);
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
