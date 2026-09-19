#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 解析 .gitmodules 文件，提取所有子模块路径
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
 * 从 package.json 提取 workspaceGroups 定义
 */
function getWorkspaceGroups() {
  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) {
    throw new Error('package.json not found');
  }
  
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return pkg.workspaceGroups || {};
}

/**
 * 主验证逻辑
 */
function main() {
  console.log('[check-workspace] Validating submodule consistency...\n');
  
  const submodules = parseGitmodules();
  const workspaceGroups = getWorkspaceGroups();
  
  // 从 workspaceGroups 构建期望的子模块路径列表
  const expectedPaths = new Set();
  for (const [group, modules] of Object.entries(workspaceGroups)) {
    for (const [localPath] of Object.entries(modules)) {
      // 特殊处理 pages 分组（直接在根目录下，路径格式是 pages/xxx）
      const fullPath = group === 'pages' ? `pages/${localPath}` : `workspaces/${group}/${localPath}`;
      expectedPaths.add(fullPath);
    }
  }
  
  // 从 .gitmodules 提取实际路径
  const actualPaths = new Set(submodules.map(sm => sm.path));
  
  // 检查是否一致
  const missingInGitmodules = [...expectedPaths].filter(p => !actualPaths.has(p));
  const extraInGitmodules = [...actualPaths].filter(p => !expectedPaths.has(p));
  
  let hasErrors = false;
  
  if (missingInGitmodules.length > 0) {
    console.error('❌ Missing in .gitmodules but defined in package.json:');
    missingInGitmodules.forEach(p => console.error(`   - ${p}`));
    hasErrors = true;
  }
  
  if (extraInGitmodules.length > 0) {
    console.error('❌ Extra in .gitmodules but not in package.json workspaceGroups:');
    extraInGitmodules.forEach(p => console.error(`   - ${p}`));
    hasErrors = true;
  }
  
  // 验证每个子模块目录是否存在
  console.log('[check-workspace] Checking submodule directories...\n');
  const missingDirs = [];
  for (const sm of submodules) {
    const dirPath = join(root, sm.path);
    if (!existsSync(dirPath)) {
      missingDirs.push(sm.path);
    }
  }
  
  if (missingDirs.length > 0) {
    console.error('❌ Submodule directories not initialized:');
    missingDirs.forEach(p => console.error(`   - ${p}`));
    console.error('\nRun: git submodule update --init --recursive');
    hasErrors = true;
  }
  
  if (hasErrors) {
    process.exit(1);
  }
  
  console.log(`✅ All ${submodules.length} submodules are properly configured and initialized.`);
  console.log(`✅ package.json workspaceGroups matches .gitmodules (${expectedPaths.size} entries).`);
}

main();
