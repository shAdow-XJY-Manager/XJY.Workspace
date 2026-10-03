#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseHref, buildCommand, cnameWarnings, checkOutputRoot, detectTech, discoverProjects, executeBuild, parseArgs, readCnames, repositoryName, updateDeployment, webBuildReason } from './build-web.mjs';

const base = process.env.MANAGER_TEST_TMP || tmpdir();
mkdirSync(base, { recursive: true });
const fixture = mkdtempSync(join(base, 'manager-build-test-'));
const root = join(fixture, 'workspace');
const outputRoot = join(fixture, 'external output;$(never)');
function file(path, content = '') { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, content); }
function flutter(path, type, web = true) {
  file(join(path, 'pubspec.yaml'), 'name: fixture\ndependencies:\n  flutter:\n    sdk: flutter\n');
  if (type) file(join(path, '.metadata'), `project_type: ${type}\n`);
  if (type !== 'package') file(join(path, 'lib/main.dart'));
  if (web) file(join(path, 'web/index.html'));
}
try {
  const app = join(root, 'app');
  const library = join(root, 'library');
  const nested = join(root, 'campus/campusprice_flutter');
  flutter(app, 'app'); flutter(library, 'package'); flutter(join(library, 'example'), 'app');
  const tv = 'workspaces/ent/video/tv';
  const trade = 'workspaces/sys/trade/schoolSecondhandApp_flutter';
  flutter(nested, 'app'); flutter(join(root, 'native'), 'app', false);
  flutter(join(root, tv), 'app'); flutter(join(root, trade), 'app');
  const targets = { web: ['app'], native: ['native', 'campus/campusprice_flutter', tv, trade], examples: ['library/example'] };
  file(join(root, 'package.json'), JSON.stringify({ flutterTargets: targets }));
  file(join(root, '.gitmodules'), ['app', 'library', 'campus', 'native', tv, trade].map(p => `[submodule "${p}"]\n path = ${p}\n url = https://github.com/org/${p.split('/').at(-1)}.git\n`).join(''));
  const projects = discoverProjects(root);
  assert.equal(projects.length, 7);
  assert.equal(projects.filter(p => p.isWeb).length, 5);
  assert.deepEqual(projects.filter(p => !webBuildReason(p)).map(p => p.path), ['app']);
  assert.equal(detectTech(library).type, 'flutter-library');
  assert.equal(detectTech(join(root, 'native')).isWeb, false);
  assert.ok(projects.some(p => p.path === 'campus/campusprice_flutter'));
  assert.ok(projects.some(p => p.path === 'library/example'));
  for (const path of ['campus/campusprice_flutter', tv, trade]) {
    const native = projects.find(p => p.path === path);
    assert.equal(native.isWeb, true, 'native fixture intentionally retains Web scaffold');
    assert.match(webBuildReason(native, { project: path }), /native application/);
    assert.throws(() => executeBuild(native, { project: path, outputRoot, dryRun: true }, () => { throw Error('native build spawned'); }), /native application/);
  }
  const example = projects.find(p => p.path === 'library/example');
  assert.match(webBuildReason(example), /explicit --project/);
  assert.equal(webBuildReason(example, { project: example.path }), null);
  assert.match(webBuildReason(example, { project: example.path, updateDocs: true, cname: 'custom.example' }), /publication is disabled/);
  assert.match(webBuildReason({ ...projects[0], intent: 'unconfigured' }), /no explicit/);
  assert.equal(repositoryName('git@github.com:org/XJY.App.git'), 'XJY.App');
  assert.equal(repositoryName('https://github.com/org/XJY.App'), 'XJY.App');
  const project = { ...projects.find(p => p.path === 'app'), repoName: 'XJY.App' };
  assert.equal(baseHref(project), '/XJY.App/');
  assert.equal(baseHref({ ...project, repoName: 'ORG.github.io' }), '/');
  const docs = join(app, 'docs');
  file(join(docs, 'index.html'), 'old deployment');
  file(join(docs, 'CNAME'), 'custom.example\n');
  file(join(docs, '.nojekyll'));
  assert.equal(baseHref(project), '/');
  // Reproduce the actual Manager layout: portal domain repeated in seven project repositories.
  const portal = join(root, 'pages/shadow-xjy-manager.github.io');
  flutter(portal, 'app');
  file(join(portal, 'docs/CNAME'), 'shadowplusing.cn\n');
  file(join(portal, 'CNAME'), 'portal-root-old.example\n');
  file(join(portal, 'web/CNAME'), 'shadowplusing.website\n');
  const sharedRepos = ['XJY.ENT.MUSI.musicListen', 'XJY.ENT.READ.comicRead', 'XJY.ENT.READ.novelRead',
    'XJY.GAME.COMP.gameCenter', 'XJY.GAME.COMP.world_flutter', 'XJY.GAME.MINI.findDifferencesGame', 'XJY.GAME.MINI.parkourGame'];
  let modules = readFileSync(join(root, '.gitmodules'), 'utf8');
  for (const name of ['shadow-xjy-manager.github.io', ...sharedRepos, 'XJY.Independent']) {
    const path = name.endsWith('.github.io') ? 'pages/shadow-xjy-manager.github.io' : `shared/${name}`;
    const fullPath = join(root, path);
    if (name !== 'shadow-xjy-manager.github.io') {
      flutter(fullPath, 'app');
      // novelRead has only web/CNAME, matching the observed checkout.
      const source = name === 'XJY.ENT.READ.novelRead' ? 'web/CNAME' : 'docs/CNAME';
      file(join(fullPath, source), name === 'XJY.Independent' ? 'independent.example\n' : 'SHADOWPLUSING.CN.\n');
    }
    targets.web.push(path);
    modules += `[submodule "${path}"]\n path = ${path}\n url = https://github.com/shAdow-XJY-Manager/${name}.git\n`;
  }
  file(join(root, '.gitmodules'), modules);
  file(join(root, 'package.json'), JSON.stringify({ flutterTargets: targets }));
  const domainProjects = discoverProjects(root);
  const organization = domainProjects.find(p => p.repoName === 'shadow-xjy-manager.github.io');
  assert.equal(organization.organizationDomain, 'shadowplusing.cn');
  assert.equal(baseHref(organization), '/');
  assert.deepEqual(readCnames(portal).map(c => c.source), ['docs/CNAME', 'CNAME', 'web/CNAME']);
  assert.ok(cnameWarnings(organization).some(w => w.includes('conflict') && w.includes('web/CNAME=shadowplusing.website')));
  for (const name of sharedRepos) {
    const shared = domainProjects.find(p => p.repoName === name);
    assert.equal(baseHref(shared), `/${name}/`, `${name} inherits the portal domain at its repository path`);
    assert.ok(cnameWarnings(shared).some(w => w.includes('Duplicate organization CNAME')));
    const args = buildCommand(shared, 'external').args;
    assert.equal(args[args.indexOf('--base-href') + 1], `/${name}/`);
  }
  assert.equal(baseHref(domainProjects.find(p => p.repoName === 'XJY.Independent')), '/');
  assert.equal(baseHref(organization, '/confirmed-prefix/'), '/confirmed-prefix/');
  assert.equal(parseArgs(['--project', 'app', '--base-href', '/confirmed-prefix/']).baseHref, '/confirmed-prefix/');
  assert.throws(() => parseArgs(['--base-href', '/']), /requires one/);
  assert.throws(() => parseArgs(['--project', 'app', '--base-href', 'https://bad.example/']), /root-relative/);
  assert.throws(() => parseArgs(['--project', 'app', '--base-href', '/missing-slash']), /ending/);
  const command = buildCommand(project, join(outputRoot, 'space;$(never)'));
  assert.equal(command.command, 'flutter');
  assert.equal(command.args.at(-1), join(outputRoot, 'space;$(never)'));
  assert.equal(command.args[command.args.indexOf('--base-href') + 1], '/');
  checkOutputRoot(outputRoot, root, projects);
  assert.throws(() => checkOutputRoot(join(root, 'docs'), root, projects), /outside repositories/);
  assert.throws(() => checkOutputRoot(fixture, root, projects), /outside repositories/);
  symlinkSync(root, join(fixture, 'alias'));
  assert.throws(() => checkOutputRoot(join(fixture, 'alias/output'), root, projects), /outside repositories/);
  assert.throws(() => parseArgs(['--parallel']), /serially/);
  assert.throws(() => parseArgs(['--update-docs']), /explicit/);
  assert.throws(() => parseArgs(['--project', 'app', '--update-docs']), /requires --cname/);
  assert.throws(() => parseArgs(['--project', 'app', '--cname', 'https://bad.example/']), /DNS domain/);
  assert.throws(() => parseArgs(['--project', 'app', '--cname', 'custom.example', '--no-cname']), /one CNAME/);
  assert.equal(baseHref(project, undefined, null), '/XJY.App/');
  assert.equal(baseHref(project, undefined, 'independent.example'), '/');
  assert.throws(() => parseArgs(['--output-root']), /value/);
  assert.throws(() => parseArgs(['--wat']), /Unknown/);
  assert.throws(() => parseArgs(['--flutter-only', '--vue-only']), /one technology/);
  assert.equal(executeBuild(project, { outputRoot, dryRun: true, updateDocs: true, cname: 'custom.example' }, () => { throw Error('dry-run spawned'); }), true);
  assert.equal(existsSync(outputRoot), false);
  assert.equal(executeBuild(project, { outputRoot, updateDocs: true, cname: 'custom.example' }, (cmd, args, opts) => {
    assert.equal(cmd, 'flutter'); assert.equal(opts.shell, false); assert.ok(Array.isArray(args));
    file(join(args.at(-1), 'partial'), 'failed build'); return { status: 1 };
  }), false);
  assert.equal(readFileSync(join(docs, 'index.html'), 'utf8'), 'old deployment');
  assert.throws(() => executeBuild(project, { outputRoot, updateDocs: true, cname: 'custom.example' }, () => ({ status: 0 })), /no index/);
  assert.equal(readFileSync(join(docs, 'index.html'), 'utf8'), 'old deployment');
  assert.throws(() => executeBuild(project, { outputRoot, updateDocs: true, cname: 'custom.example' }, (_cmd, args) => {
    file(join(args.at(-1), 'index.html'), 'incomplete deployment'); return { status: 0 };
  }), /no main.dart.js/);
  assert.equal(readFileSync(join(docs, 'index.html'), 'utf8'), 'old deployment');
  const fakeSuccess = (_cmd, args) => {
    file(join(args.at(-1), 'index.html'), 'new deployment');
    file(join(args.at(-1), 'main.dart.js'), 'compiled fixture');
    file(join(args.at(-1), 'CNAME'), 'stale-generated.example'); return { status: 0 };
  };
  executeBuild(project, { outputRoot }, fakeSuccess);
  assert.equal(readFileSync(join(docs, 'index.html'), 'utf8'), 'old deployment');
  executeBuild(project, { outputRoot, updateDocs: true, cname: 'custom.example' }, fakeSuccess);
  assert.equal(readFileSync(join(docs, 'index.html'), 'utf8'), 'new deployment');
  assert.equal(readFileSync(join(docs, 'CNAME'), 'utf8'), 'custom.example\n');
  assert.ok(existsSync(join(docs, '.nojekyll')));
  assert.ok(!readdirSync(app).some(f => f.startsWith('.deploy-')));
  rmSync(join(docs, 'CNAME'));
  file(join(app, 'CNAME'), 'root-domain.example\n');
  executeBuild(project, { outputRoot, updateDocs: true, cname: 'custom.example' }, fakeSuccess);
  assert.equal(readFileSync(join(docs, 'CNAME'), 'utf8'), 'custom.example\n', 'explicit decision wins over old root CNAME');
  executeBuild(project, { outputRoot, updateDocs: true, cname: null }, fakeSuccess);
  assert.equal(existsSync(join(docs, 'CNAME')), false, 'explicit no-cname removes generated CNAME');
  assert.throws(() => updateDeployment(join(fixture, 'missing'), docs), /Missing built/);
  assert.equal(readFileSync(join(docs, 'index.html'), 'utf8'), 'new deployment');
  const policyRoot = join(fixture, 'artifact-policy');
  mkdirSync(join(policyRoot, 'scripts'), { recursive: true });
  for (const name of ['build-web.mjs', 'check-artifacts.mjs']) {
    cpSync(new URL(name, import.meta.url), join(policyRoot, 'scripts', name));
  }
  cpSync(new URL('../.gitignore', import.meta.url), join(policyRoot, '.gitignore'));
  file(join(policyRoot, '.gitmodules'));
  assert.equal(spawnSync('git', ['init', '--quiet', policyRoot]).status, 0);
  const paths = ['design/concept.md', '.reports/audit.md', 'BUILD.md', 'report.pdf', 'assets/runtime.zip', 'static/runtime.zip', 'docs/deployment.zip', 'assets/.reports/audit.md'];
  const ignored = spawnSync('git', ['-C', policyRoot, 'check-ignore', '--no-index', '--stdin', '-z'], { input: paths.join('\0') + '\0', encoding: 'utf8' });
  assert.deepEqual(ignored.stdout.split('\0').filter(Boolean), ['design/concept.md', '.reports/audit.md', 'BUILD.md', 'report.pdf', 'assets/.reports/audit.md']);
  file(join(policyRoot, 'large.bin'), Buffer.alloc(5 * 1024 * 1024));
  const gate = () => spawnSync(process.execPath, [join(policyRoot, 'scripts/check-artifacts.mjs')], { encoding: 'utf8' });
  assert.equal(gate().status, 1, 'new non-runtime large file must fail');
  mkdirSync(join(policyRoot, 'assets'));
  renameSync(join(policyRoot, 'large.bin'), join(policyRoot, 'assets/large.bin'));
  assert.equal(gate().status, 0, 'runtime large file must pass');
  // Check the production intent list itself: scaffold presence cannot add native applications to the batch.
  const configured = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).flutterTargets;
  const production = discoverProjects(fileURLToPath(new URL('..', import.meta.url)));
  const expectedWeb = ['pages/shadow-xjy-manager.github.io', 'workspaces/ent/read/novelRead',
    'workspaces/ent/read/comicRead', 'workspaces/ent/musi/musicListen', 'workspaces/game/comp/gameCenter',
    'workspaces/game/comp/world_flutter', 'workspaces/game/mini/findDifferencesGame', 'workspaces/game/mini/flipChess_flutter',
    'workspaces/game/mini/parkourGame', 'workspaces/game/mini/rockPaperScissors', 'workspaces/game/mini/snakeGame',
    'workspaces/game/mini/ticTacToe', 'workspaces/game/pvz/pvz_flutter', 'workspaces/util/web/websiteTools',
    'workspaces/util/web/customSearchPage'];
  assert.deepEqual([...configured.web].sort(), [...expectedWeb].sort());
  assert.equal(configured.native.length, 8);
  assert.equal(configured.examples.length, 3);
  assert.deepEqual(production.filter(p => p.type === 'flutter' && !webBuildReason(p)).map(p => p.path).sort(), [...expectedWeb].sort());
  assert.ok(production.filter(p => p.intent === 'native').every(p => /native application/.test(webBuildReason(p))));
  console.log('PASS: 15 Web products, native scaffold boundaries, manual examples, discovery, shared/independent domains and CNAME precedence, base paths, argument safety, output isolation, dry-run, failure preservation, explicit deployment, process boundaries and large-file gate');
} finally { rmSync(fixture, { recursive: true, force: true }); }
