#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 解析 .gitmodules 获取所有子模块
 */
function parseGitmodules() {
  const gitmodulesPath = join(root, '.gitmodules');
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

/**
 * 从 GitHub URL 提取仓库名
 * 例如: https://github.com/shAdow-XJY-Manager/XJY.ENT.READ.novelRead.git → XJY.ENT.READ.novelRead
 */
function extractRepoName(url) {
  const match = url.match(/\/([^/]+)\.git$/);
  if (match) {
    return match[1];
  }
  // 如果没有 .git 后缀
  const match2 = url.match(/\/([^/]+)$/);
  return match2 ? match2[1] : null;
}

/**
 * 检测子模块的技术栈
 */
function detectTech(submodulePath) {
  const fullPath = join(root, submodulePath);
  
  if (!existsSync(fullPath)) {
    return { type: 'unknown', isWeb: false };
  }
  
  // Flutter
  if (existsSync(join(fullPath, 'pubspec.yaml'))) {
    const pubspec = readFileSync(join(fullPath, 'pubspec.yaml'), 'utf8');
    // 检查是否是 Flutter 项目而非纯 Dart 项目
    if (pubspec.includes('flutter:')) {
      return { type: 'flutter', isWeb: true, buildCmd: 'flutter' };
    }
  }
  
  // Vue CLI
  if (existsSync(join(fullPath, 'vue.config.js')) || existsSync(join(fullPath, 'vue.config.cjs'))) {
    return { type: 'vue-cli', isWeb: true, buildCmd: 'npm' };
  }
  
  // Vite
  if (existsSync(join(fullPath, 'vite.config.js')) || 
      existsSync(join(fullPath, 'vite.config.ts')) ||
      existsSync(join(fullPath, 'vite.config.mjs'))) {
    return { type: 'vite', isWeb: true, buildCmd: 'vite' };
  }
  
  // React (CRA)
  const pkgPath = join(fullPath, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg.dependencies?.['react-scripts']) {
      return { type: 'cra', isWeb: true, buildCmd: 'npm' };
    }
  }
  
  return { type: 'unknown', isWeb: false };
}

/**
 * 生成构建命令
 */
function generateBuildCommand(tech, repoName) {
  switch (tech.type) {
    case 'flutter':
      return `flutter build web --no-web-resources-cdn --release --base-href /${repoName}/`;
    
    case 'vue-cli':
      // Vue CLI 需要在构建前修改 publicPath，这里返回提示
      return `# 需要修改 vue.config.js 中的 publicPath: '/${repoName}/' 然后运行 npm run build`;
    
    case 'vite':
      return `vite build --base=/${repoName}/`;
    
    case 'cra':
      return `PUBLIC_URL=/${repoName} npm run build`;
    
    default:
      return null;
  }
}

/**
 * 执行构建
 */
function executeBuild(submodulePath, buildCmd, dryRun) {
  const fullPath = join(root, submodulePath);
  
  if (dryRun) {
    console.log(`[dry-run] cd ${submodulePath} && ${buildCmd}`);
    return { success: true, dryRun: true };
  }
  
  console.log(`\n==> Building ${submodulePath}`);
  console.log(`    Command: ${buildCmd}`);
  
  const result = spawnSync(buildCmd, {
    cwd: fullPath,
    stdio: 'inherit',
    shell: true,
  });
  
  return { success: result.status === 0 };
}

/**
 * 主逻辑
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const flutterOnly = args.includes('--flutter-only');
  const vueOnly = args.includes('--vue-only');
  
  console.log('[build-web] Scanning web projects in submodules...\n');
  
  const submodules = parseGitmodules();
  const webProjects = [];
  
  for (const sm of submodules) {
    const tech = detectTech(sm.path);
    
    if (!tech.isWeb) continue;
    
    // 过滤器
    if (flutterOnly && tech.type !== 'flutter') continue;
    if (vueOnly && tech.type !== 'vue-cli') continue;
    
    const repoName = extractRepoName(sm.url);
    if (!repoName) {
      console.warn(`⚠️  Cannot extract repo name from: ${sm.url}`);
      continue;
    }
    
    const buildCmd = generateBuildCommand(tech, repoName);
    if (!buildCmd) continue;
    
    webProjects.push({
      path: sm.path,
      tech: tech.type,
      repoName,
      buildCmd,
    });
  }
  
  if (webProjects.length === 0) {
    console.log('No web projects found.');
    return;
  }
  
  console.log(`Found ${webProjects.length} web projects:\n`);
  
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
  };
  
  for (const project of webProjects) {
    console.log(`📦 ${project.path}`);
    console.log(`   Tech: ${project.tech}`);
    console.log(`   Repo: ${project.repoName}`);
    console.log(`   Command: ${project.buildCmd}`);
    
    if (project.tech === 'vue-cli') {
      console.log(`   ⚠️  Vue CLI projects require manual publicPath modification`);
      console.log(`   ⚠️  Edit vue.config.js to set publicPath: '/${project.repoName}/'`);
      results.skipped++;
      continue;
    }
    
    const result = executeBuild(project.path, project.buildCmd, dryRun);
    
    if (result.dryRun) {
      console.log(`   ✓ Dry-run complete`);
    } else if (result.success) {
      console.log(`   ✅ Build successful`);
      results.success++;
    } else {
      console.log(`   ❌ Build failed`);
      results.failed++;
    }
  }
  
  console.log('\n' + '─'.repeat(80));
  console.log(`\nBuild Summary:`);
  console.log(`  Total: ${webProjects.length} projects`);
  if (!dryRun) {
    console.log(`  ✅ Success: ${results.success}`);
    console.log(`  ❌ Failed: ${results.failed}`);
    console.log(`  ⏭️  Skipped: ${results.skipped}`);
  } else {
    console.log(`  (Dry-run mode - no actual builds performed)`);
  }
  
  if (results.failed > 0) {
    process.exit(1);
  }
}

main();
