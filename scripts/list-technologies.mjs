#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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
 * 检测子模块的技术栈
 */
function detectTechnologies(submodulePath) {
  const fullPath = join(root, submodulePath);
  const techs = [];
  
  if (!existsSync(fullPath)) {
    return ['not-initialized'];
  }
  
  try {
    // Flutter
    if (existsSync(join(fullPath, 'pubspec.yaml'))) {
      const pubspec = readFileSync(join(fullPath, 'pubspec.yaml'), 'utf8');
      if (pubspec.includes('flutter:')) {
        techs.push('Flutter');
      } else {
        techs.push('Dart');
      }
    }
    
    // Vue
    if (existsSync(join(fullPath, 'vue.config.js')) || existsSync(join(fullPath, 'vue.config.cjs'))) {
      techs.push('Vue');
    }
    
    // React
    const pkgPath = join(fullPath, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (pkg.dependencies?.react || pkg.devDependencies?.react) {
        techs.push('React');
      }
      if (pkg.dependencies?.['react-scripts']) {
        techs.push('CRA');
      }
      if (pkg.dependencies?.next || pkg.devDependencies?.next) {
        techs.push('Next.js');
      }
    }
    
    // Vite
    if (existsSync(join(fullPath, 'vite.config.js')) || 
        existsSync(join(fullPath, 'vite.config.ts')) ||
        existsSync(join(fullPath, 'vite.config.mjs'))) {
      techs.push('Vite');
    }
    
    // Astro
    if (existsSync(join(fullPath, 'astro.config.mjs')) || 
        existsSync(join(fullPath, 'astro.config.js'))) {
      techs.push('Astro');
    }
    
    // Tauri
    if (existsSync(join(fullPath, 'src-tauri'))) {
      techs.push('Tauri');
    }
    
    // Spring Boot / Maven
    if (existsSync(join(fullPath, 'pom.xml'))) {
      const pom = readFileSync(join(fullPath, 'pom.xml'), 'utf8');
      if (pom.includes('spring-boot')) {
        techs.push('Spring Boot');
      } else {
        techs.push('Maven');
      }
    }
    
    // Gradle
    if (existsSync(join(fullPath, 'build.gradle')) || existsSync(join(fullPath, 'build.gradle.kts'))) {
      techs.push('Gradle');
    }
    
    // Python
    if (existsSync(join(fullPath, 'requirements.txt')) || existsSync(join(fullPath, 'setup.py'))) {
      techs.push('Python');
    }
    
    // Flask
    const pythonFiles = readdirSync(fullPath).filter(f => f.endsWith('.py'));
    for (const file of pythonFiles.slice(0, 5)) { // 检查前5个Python文件
      const content = readFileSync(join(fullPath, file), 'utf8');
      if (content.includes('from flask import') || content.includes('import flask')) {
        techs.push('Flask');
        break;
      }
    }
    
    // QT
    if (existsSync(join(fullPath, 'CMakeLists.txt'))) {
      const cmake = readFileSync(join(fullPath, 'CMakeLists.txt'), 'utf8');
      if (cmake.includes('Qt5') || cmake.includes('Qt6')) {
        techs.push('Qt');
      } else {
        techs.push('CMake');
      }
    }
    
    // Godot
    if (existsSync(join(fullPath, 'project.godot'))) {
      techs.push('Godot');
    }
    
    // Webpack (standalone)
    if (existsSync(join(fullPath, 'webpack.config.js')) && techs.length === 0) {
      techs.push('Webpack');
    }
    
    // 如果没有检测到任何已知技术栈
    if (techs.length === 0) {
      // 尝试从文件扩展名推断
      const files = readdirSync(fullPath);
      if (files.some(f => f.endsWith('.html'))) techs.push('HTML');
      if (files.some(f => f.endsWith('.js'))) techs.push('JavaScript');
      if (files.some(f => f.endsWith('.ts'))) techs.push('TypeScript');
      if (files.some(f => f.endsWith('.go'))) techs.push('Go');
      if (files.some(f => f.endsWith('.rs'))) techs.push('Rust');
    }
    
    return techs.length > 0 ? techs : ['Unknown'];
  } catch (error) {
    return ['Error'];
  }
}

/**
 * 主逻辑
 */
function main() {
  const args = process.argv.slice(2);
  const showStats = args.includes('--stats');
  
  console.log('[list-technologies] Scanning submodule technologies...\n');
  
  const submodules = parseGitmodules();
  const results = [];
  
  for (const sm of submodules) {
    const techs = detectTechnologies(sm.path);
    results.push({
      path: sm.path,
      name: sm.name,
      techs,
    });
  }
  
  if (showStats) {
    // 统计模式
    const techCount = {};
    for (const result of results) {
      for (const tech of result.techs) {
        techCount[tech] = (techCount[tech] || 0) + 1;
      }
    }
    
    console.log('Technology Statistics:\n');
    const sorted = Object.entries(techCount).sort((a, b) => b[1] - a[1]);
    for (const [tech, count] of sorted) {
      console.log(`  ${tech.padEnd(20)} ${count} projects`);
    }
    
    console.log(`\nTotal: ${submodules.length} submodules`);
  } else {
    // 列表模式
    const grouped = {};
    for (const result of results) {
      const groupMatch = result.path.match(/^workspaces\/([^/]+)/);
      const group = groupMatch ? groupMatch[1] : 'other';
      
      if (!grouped[group]) {
        grouped[group] = [];
      }
      
      grouped[group].push(result);
    }
    
    for (const [group, items] of Object.entries(grouped).sort()) {
      console.log(`\n## ${group.toUpperCase()}`);
      console.log('─'.repeat(80));
      
      for (const item of items.sort((a, b) => a.path.localeCompare(b.path))) {
        const techList = item.techs.join(', ');
        console.log(`${item.path.padEnd(50)} ${techList}`);
      }
    }
    
    console.log(`\nTotal: ${submodules.length} submodules`);
    console.log('\nRun with --stats to see technology distribution');
  }
}

main();
