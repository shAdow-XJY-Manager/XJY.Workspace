# Flutter Web 项目 Base Href 修复报告

生成时间: 2026-09-20 00:48

## 问题描述

在之前的构建中，所有 Flutter Web 项目的 `--base-href` 参数使用了项目名而非仓库名，导致部署到 GitHub Pages 后 URL 不正确。

### 错误示例
```
实际: https://shadowplusing.cn/novelRead/
正确: https://shadowplusing.cn/XJY.ENT.READ.novelRead/
```

### 问题根因
手动构建时使用了项目名（如 `novelRead`）作为 base href，而不是从 `.gitmodules` 中提取的仓库名（如 `XJY.ENT.READ.novelRead`）。

## 修复方案

### 1. 识别正确的仓库名

从 `.gitmodules` 文件中提取仓库名：

```bash
# .gitmodules 中的 URL
[submodule "workspaces/ent/read/novelRead"]
    path = workspaces/ent/read/novelRead
    url = https://github.com/shAdow-XJY-Manager/XJY.ENT.READ.novelRead.git

# 提取仓库名: XJY.ENT.READ.novelRead
```

### 2. 使用正确的 base href 重新构建

```bash
flutter build web --no-web-resources-cdn --release \
  --base-href /XJY.ENT.READ.novelRead/ \
  --output=docs/
```

### 3. 脚本支持

`scripts/build-web.mjs` 已经正确实现了从 GitHub URL 提取仓库名的逻辑：

```javascript
function extractRepoName(url) {
  const match = url.match(/\/([^/]+)\.git$/);
  if (match) {
    return match[1];  // 例如: XJY.ENT.READ.novelRead
  }
}
```

## 修复结果

### Base Href 验证

| 项目 | 仓库名 | Base Href | 状态 |
|------|--------|-----------|------|
| musicListen | XJY.ENT.MUSI.musicListen | `/XJY.ENT.MUSI.musicListen/` | ✅ |
| comicRead | XJY.ENT.READ.comicRead | `/XJY.ENT.READ.comicRead/` | ✅ |
| novelRead | XJY.ENT.READ.novelRead | `/XJY.ENT.READ.novelRead/` | ✅ |
| gameCenter | XJY.GAME.COMP.gameCenter | `/XJY.GAME.COMP.gameCenter/` | ✅ |
| world_flutter | XJY.GAME.COMP.world_flutter | `/XJY.GAME.COMP.world_flutter/` | ✅ |
| findDifferencesGame | XJY.GAME.MINI.findDifferencesGame | `/XJY.GAME.MINI.findDifferencesGame/` | ✅ |
| parkourGame | XJY.GAME.MINI.parkourGame | `/XJY.GAME.MINI.parkourGame/` | ✅ |
| rockPaperScissors | XJY.GAME.MINI.rockPaperScissors | `/XJY.GAME.MINI.rockPaperScissors/` | ✅ |
| snakeGame | XJY.GAME.MINI.snakeGame | `/XJY.GAME.MINI.snakeGame/` | ✅ |
| ticTacToe | XJY.GAME.MINI.ticTacToe | `/XJY.GAME.MINI.ticTacToe/` | ✅ |
| pvz_flutter | XJY.GAME.PVZ.pvz_flutter | `/XJY.GAME.PVZ.pvz_flutter/` | ✅ |
| customSearchPage | XJY.UTIL.WEB.customSearchPage | `/XJY.UTIL.WEB.customSearchPage/` | ✅ |
| websiteTools | XJY.UTIL.WEB.websiteTools | `/XJY.UTIL.WEB.websiteTools/` | ✅ |

**总计**: 13 个项目全部修复 ✅

## 修复步骤

### 1. 重新构建所有项目

```bash
flutter build web --no-web-resources-cdn --release \
  --base-href /<仓库名>/ \
  --output=docs/
```

### 2. 提交构建产物

每个子模块都更新了 `docs/` 文件夹的构建产物。

### 3. 更新子模块引用

主仓库更新了所有 13 个子模块的引用。

### 4. 更新 README 链接

修复了 README 文件中的网站链接，从旧格式更新为正确的仓库名格式：

| 项目 | 旧链接 | 新链接 |
|------|--------|--------|
| novelRead | `novel_read/` | `XJY.ENT.READ.novelRead/` |
| world_flutter | (错误的 parkourGame 链接) | `XJY.GAME.COMP.world_flutter/` |
| rockPaperScissors | `rock_paper_scissors/` | `XJY.GAME.MINI.rockPaperScissors/` |
| snakeGame | `snake_game/` | `XJY.GAME.MINI.snakeGame/` |
| ticTacToe | `tic_tac_toe/` | `XJY.GAME.MINI.ticTacToe/` |
| pvz_flutter | (无链接) | `XJY.GAME.PVZ.pvz_flutter/` |
| customSearchPage | `custom_search_page/` | `XJY.UTIL.WEB.customSearchPage/` |
| websiteTools | `shadow_tools/` | `XJY.UTIL.WEB.websiteTools/` |

## Git 提交记录

### 子模块提交

| 子模块 | Commit Hash | 提交信息 |
|--------|-------------|----------|
| musicListen | dee18b3 | build: 更新构建产物（使用正确的 base href 仓库名） |
| comicRead | c22e85f | build: 更新构建产物（使用正确的 base href 仓库名） |
| novelRead | 0aacf9b | build: 更新构建产物（使用正确的 base href 仓库名） |
| gameCenter | ea1c39c | build: 更新构建产物（使用正确的 base href 仓库名） |
| world_flutter | 9fbb529 | docs: 更新网站链接（使用正确的仓库名） |
| findDifferencesGame | bda4f6c | build: 更新构建产物（使用正确的 base href 仓库名） |
| parkourGame | 1323dab | build: 更新构建产物（使用正确的 base href 仓库名） |
| rockPaperScissors | 0b02734 | docs: 更新网站链接（使用正确的仓库名） |
| snakeGame | d5493ec | docs: 更新网站链接（使用正确的仓库名） |
| ticTacToe | d7d2d07 | docs: 更新网站链接（使用正确的仓库名） |
| pvz_flutter | f972868 | docs: 更新网站链接（使用正确的仓库名） |
| customSearchPage | a49ccaa | docs: 更新网站链接（使用正确的仓库名） |
| websiteTools | 9b2dc30 | docs: 更新网站链接（使用正确的仓库名） |

### 主仓库提交

| Commit Hash | 提交信息 |
|-------------|----------|
| 47ba016 | chore: 更新所有 Flutter Web 子模块（使用正确的 base href） |
| aa35ea8 | chore: 更新子模块（README 链接修复） |

## 预期部署结果

所有项目现在可以通过以下格式的 URL 访问：

```
https://<username>.github.io/XJY.ENT.READ.novelRead/
https://<username>.github.io/XJY.GAME.COMP.gameCenter/
...
```

或使用自定义域名：

```
https://shadowplusing.cn/XJY.ENT.READ.novelRead/
https://shadowplusing.cn/XJY.GAME.COMP.gameCenter/
...
```

## 经验总结

### 1. 自动化构建流程

`scripts/build-web.mjs` 脚本已经实现了正确的 base href 生成逻辑，后续构建应使用该脚本而非手动构建命令。

### 2. URL 命名一致性

GitHub 仓库名是项目在组织中的唯一标识符，应始终使用仓库名作为 base href，而不是项目内部的目录名或显示名称。

### 3. README 维护

README 中的网站链接应与 base href 保持一致，确保用户点击后能正确访问。

---

**报告生成**: Claude Code  
**最后更新**: 2026-09-20 00:48  
**验证状态**: ✅ 所有 13 个项目已修复
