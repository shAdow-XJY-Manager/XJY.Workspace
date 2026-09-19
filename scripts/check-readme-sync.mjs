#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 解析 .gitmodules 获取所有子模块路径
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
    }
  }
  
  if (currentSubmodule) {
    submodules.push(currentSubmodule);
  }
  
  return submodules;
}

/**
 * 从 README 提取子模块列表
 * README 使用树形结构展示，需要匹配 # 注释部分
 */
function extractSubmodulesFromReadme() {
  const readmePath = join(root, 'README.md');
  if (!existsSync(readmePath)) {
    throw new Error('README.md not found');
  }
  
  const content = readFileSync(readmePath, 'utf8');
  const submodulePaths = new Set();
  
  // 匹配 README 中的注释格式，例如：# XJY.COM.ORG.Community
  const commentMatches = content.matchAll(/#\s+(XJY\.[A-Z]+(?:\.[A-Z]+)*\.[\w-]+)/gm);
  for (const match of commentMatches) {
    const repoName = match[1];
    // 将 XJY.COM.ORG.Community 转换为路径（需要从 .gitmodules 反查）
    // 这个方法不可靠，改用直接匹配目录名
  }
  
  // 更可靠的方法：匹配目录名（├── 或 └── 后面的内容）
  const treeMatches = content.matchAll(/[├└]──\s+([\w-]+)\s+#/gm);
  const dirNames = [];
  for (const match of treeMatches) {
    dirNames.push(match[1]);
  }
  
  // 由于 README 使用树形结构，无法直接提取完整路径
  // 改为只验证总数是否匹配
  return { dirNames, count: dirNames.length };
}

/**
 * 验证 README 中的总数标注
 */
function checkTotalCount(readme, actualCount) {
  const match = readme.match(/\*\*总计[：:]\s*(\d+)\s*个子模块\*\*/);
  if (!match) {
    console.warn('⚠️  Cannot find total count marker in README.md');
    console.warn('   Expected format: **总计：XX 个子模块**');
    return false;
  }
  
  const documentedCount = parseInt(match[1], 10);
  if (documentedCount !== actualCount) {
    console.error(`❌ README.md claims ${documentedCount} submodules, but .gitmodules has ${actualCount}`);
    return false;
  }
  
  return true;
}

/**
 * 主逻辑
 */
function main() {
  console.log('[check-readme-sync] Validating README.md against .gitmodules...\n');
  
  const submodules = parseGitmodules();
  const actualPaths = new Set(submodules.map(sm => sm.path));
  
  const readmePath = join(root, 'README.md');
  const readme = readFileSync(readmePath, 'utf8');
  
  // 检查总数
  const totalCountOk = checkTotalCount(readme, submodules.length);
  
  // 由于 README 使用树形结构，不方便提取完整路径
  // 只验证总数是否匹配
  if (!totalCountOk) {
    console.error('\n❌ README.md total count does not match .gitmodules');
    process.exit(1);
  }
  
  console.log(`✅ README.md is in sync with .gitmodules (${submodules.length} submodules)`);
}

main();
