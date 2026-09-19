#!/usr/bin/env node
import { execSync, spawnSync } from 'node:child_process';
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
    return { status: 'not-initialized', message: 'Not initialized' };
  }
  
  if (!existsSync(join(fullPath, '.git'))) {
    return { status: 'not-initialized', message: 'Not a git repository' };
  }
  
  try {
    // 获取当前分支
    const branchResult = spawnSync('git', ['-C', fullPath, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' });
    const branch = branchResult.status === 0 ? branchResult.stdout.trim() : 'unknown';
    
    // 检查是否有未提交的更改
    const statusResult = spawnSync('git', ['-C', fullPath, 'status', '--porcelain'], { encoding: 'utf8' });
    const hasChanges = statusResult.status === 0 && statusResult.stdout.trim().length > 0;
    
    // 检查是否 ahead/behind
    const remoteBranch = `origin/${branch}`;
    const revListResult = spawnSync(
      'git', 
      ['-C', fullPath, 'rev-list', '--left-right', '--count', `${remoteBranch}...HEAD`],
      { encoding: 'utf8' }
    );
    
    let ahead = 0;
    let behind = 0;
    if (revListResult.status === 0) {
      const [behindStr, aheadStr] = revListResult.stdout.trim().split(/\s+/);
      behind = parseInt(behindStr, 10) || 0;
      ahead = parseInt(aheadStr, 10) || 0;
    }
    
    return {
      status: 'ok',
      branch,
      hasChanges,
      ahead,
      behind,
      message: hasChanges ? 'Uncommitted changes' : ahead > 0 ? `${ahead} commits ahead` : behind > 0 ? `${behind} commits behind` : 'Clean'
    };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

/**
 * 格式化状态输出
 */
function formatStatus(status) {
  if (status.status === 'not-initialized') {
    return '⚠️  NOT INITIALIZED';
  }
  
  if (status.status === 'error') {
    return `❌ ERROR: ${status.message}`;
  }
  
  const parts = [`[${status.branch}]`];
  
  if (status.hasChanges) {
    parts.push('🔶 UNCOMMITTED');
  }
  
  if (status.ahead > 0) {
    parts.push(`↑${status.ahead}`);
  }
  
  if (status.behind > 0) {
    parts.push(`↓${status.behind}`);
  }
  
  if (!status.hasChanges && status.ahead === 0 && status.behind === 0) {
    parts.push('✅ CLEAN');
  }
  
  return parts.join(' ');
}

/**
 * 主逻辑
 */
function main() {
  console.log('[submodule-status] Checking status of all submodules...\n');
  
  const submodules = parseGitmodules();
  
  const statusByGroup = {};
  
  for (const sm of submodules) {
    const status = getSubmoduleStatus(sm.path);
    const groupMatch = sm.path.match(/^workspaces\/([^/]+)/);
    const group = groupMatch ? groupMatch[1] : 'other';
    
    if (!statusByGroup[group]) {
      statusByGroup[group] = [];
    }
    
    statusByGroup[group].push({
      path: sm.path,
      name: sm.name,
      status,
    });
  }
  
  // 按组打印
  for (const [group, items] of Object.entries(statusByGroup).sort()) {
    console.log(`\n## ${group.toUpperCase()} (${items.length} submodules)`);
    console.log('─'.repeat(80));
    
    for (const item of items.sort((a, b) => a.path.localeCompare(b.path))) {
      const formattedStatus = formatStatus(item.status);
      console.log(`${item.path.padEnd(50)} ${formattedStatus}`);
    }
  }
  
  // 统计
  const total = submodules.length;
  const notInitialized = submodules.filter(sm => {
    const status = getSubmoduleStatus(sm.path);
    return status.status === 'not-initialized';
  }).length;
  
  const withChanges = submodules.filter(sm => {
    const status = getSubmoduleStatus(sm.path);
    return status.status === 'ok' && status.hasChanges;
  }).length;
  
  const ahead = submodules.filter(sm => {
    const status = getSubmoduleStatus(sm.path);
    return status.status === 'ok' && status.ahead > 0;
  }).length;
  
  console.log('\n' + '─'.repeat(80));
  console.log(`\nTotal: ${total} submodules`);
  if (notInitialized > 0) console.log(`⚠️  Not initialized: ${notInitialized}`);
  if (withChanges > 0) console.log(`🔶 With uncommitted changes: ${withChanges}`);
  if (ahead > 0) console.log(`↑ Ahead of origin: ${ahead}`);
  
  if (notInitialized === 0 && withChanges === 0 && ahead === 0) {
    console.log('✅ All submodules are clean and up to date!');
  }
}

main();
