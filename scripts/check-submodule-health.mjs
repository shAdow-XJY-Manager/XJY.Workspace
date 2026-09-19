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
 * 获取子模块的 git 状态
 */
function getSubmoduleStatus(submodulePath) {
  const fullPath = join(root, submodulePath);
  
  if (!existsSync(fullPath)) {
    return { initialized: false };
  }
  
  if (!existsSync(join(fullPath, '.git'))) {
    return { initialized: false };
  }
  
  try {
    // 检查是否有未提交的更改
    const statusResult = spawnSync('git', ['-C', fullPath, 'status', '--porcelain'], { encoding: 'utf8' });
    const hasUncommitted = statusResult.status === 0 && statusResult.stdout.trim().length > 0;
    
    // 检查是否有未推送的提交
    const branchResult = spawnSync('git', ['-C', fullPath, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' });
    const branch = branchResult.status === 0 ? branchResult.stdout.trim() : 'unknown';
    
    const revListResult = spawnSync(
      'git', 
      ['-C', fullPath, 'rev-list', '--left-right', '--count', `origin/${branch}...HEAD`],
      { encoding: 'utf8' }
    );
    
    let unpushed = 0;
    if (revListResult.status === 0) {
      const [, aheadStr] = revListResult.stdout.trim().split(/\s+/);
      unpushed = parseInt(aheadStr, 10) || 0;
    }
    
    return {
      initialized: true,
      hasUncommitted,
      unpushed,
      branch,
    };
  } catch (error) {
    return { initialized: true, error: error.message };
  }
}

/**
 * 主逻辑
 */
function main() {
  console.log('[check-submodule-health] Checking submodule health...\n');
  
  const submodules = parseGitmodules();
  
  const issues = {
    notInitialized: [],
    uncommitted: [],
    unpushed: [],
  };
  
  for (const sm of submodules) {
    const status = getSubmoduleStatus(sm.path);
    
    if (!status.initialized) {
      issues.notInitialized.push(sm.path);
      continue;
    }
    
    if (status.error) {
      console.warn(`⚠️  ${sm.path}: ${status.error}`);
      continue;
    }
    
    if (status.hasUncommitted) {
      issues.uncommitted.push(sm.path);
    }
    
    if (status.unpushed > 0) {
      issues.unpushed.push({ path: sm.path, count: status.unpushed });
    }
  }
  
  let hasIssues = false;
  
  if (issues.notInitialized.length > 0) {
    console.log('⚠️  Not initialized:');
    issues.notInitialized.forEach(p => console.log(`   - ${p}`));
    console.log(`\n   Run: git submodule update --init --recursive\n`);
    hasIssues = true;
  }
  
  if (issues.uncommitted.length > 0) {
    console.log('🔶 Uncommitted changes:');
    issues.uncommitted.forEach(p => console.log(`   - ${p}`));
    console.log();
    hasIssues = true;
  }
  
  if (issues.unpushed.length > 0) {
    console.log('↑ Unpushed commits:');
    issues.unpushed.forEach(item => console.log(`   - ${item.path} (${item.count} commits ahead)`));
    console.log(`\n   Run: pnpm push:dry-run (to preview) or pnpm push:submodules\n`);
    hasIssues = true;
  }
  
  if (!hasIssues) {
    console.log('✅ All submodules are healthy!');
    console.log(`   - ${submodules.length} submodules initialized`);
    console.log(`   - No uncommitted changes`);
    console.log(`   - No unpushed commits`);
  }
  
  process.exit(hasIssues ? 1 : 0);
}

main();
