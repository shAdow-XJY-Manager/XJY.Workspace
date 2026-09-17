# XJY.Workspace 超级仓库

这是 shAdow-XJY-Manager 组织的超级仓库，统一管理所有子项目。所有子项目按命名前缀分类，以 git submodule 形式组织。

## 📁 仓库拓扑

### COM - 社区与服务
```
workspaces/com/org/
├── Community          # XJY.COM.ORG.Community
└── Workers            # XJY.COM.ORG.Workers
```

### ENT - 娱乐产品
```
workspaces/ent/
├── musi/
│   └── musicListen     # XJY.ENT.MUSI.musicListen
├── video/
│   └── tv              # XJY.ENT.VIDEO.tv
└── read/
    ├── comicRead       # XJY.ENT.READ.comicRead
    └── novelRead       # XJY.ENT.READ.novelRead
```

### GAME - 游戏集合
```
workspaces/game/
├── comp/
│   ├── gameCenter              # XJY.GAME.COMP.gameCenter
│   ├── world_flutter           # XJY.GAME.COMP.world_flutter
│   └── world_vue               # XJY.GAME.COMP.world_vue
├── mario/
│   └── superMario_QT           # XJY.GAME.MARIO.superMario_QT
├── mini/
│   ├── findDifferencesGame     # XJY.GAME.MINI.findDifferencesGame
│   ├── flipChess_flutter       # XJY.GAME.MINI.flipChess_flutter
│   ├── parkourGame             # XJY.GAME.MINI.parkourGame
│   ├── rockPaperScissors       # XJY.GAME.MINI.rockPaperScissors
│   ├── snakeGame               # XJY.GAME.MINI.snakeGame
│   └── ticTacToe               # XJY.GAME.MINI.ticTacToe
└── pvz/
    └── pvz_flutter             # XJY.GAME.PVZ.pvz_flutter
```

### LEARN - 学习与练习项目
```
workspaces/learn/
├── be/
│   ├── backendService                  # XJY.LEARN.BE.backendService
│   ├── sqlAPI                          # XJY.LEARN.BE.sqlAPI
│   └── sqlAPI2                         # XJY.LEARN.BE.sqlAPI2
├── fe/
│   ├── componentPassMessage_vue        # XJY.LEARN.FE.componentPassMessage_vue
│   ├── filePass                        # XJY.LEARN.FE.filePass
│   ├── filePass2                       # XJY.LEARN.FE.filePass2
│   ├── jsCoding                        # XJY.LEARN.FE.jsCoding
│   ├── passData                        # XJY.LEARN.FE.passData
│   ├── routerTrain_vue                 # XJY.LEARN.FE.routerTrain_vue
│   └── webpack                         # XJY.LEARN.FE.webpack
└── misc/
    ├── learnDodgeTheCreeps_GoDot       # XJY.LEARN.learnDodgeTheCreeps_GoDot
    └── xcodeProject                    # XJY.LEARN.xcodeProject
```

### SYS - 系统与平台项目
```
workspaces/sys/
├── campus/
│   └── campusPrice                         # XJY.SYS.campusPrice
├── crea/
│   ├── readingReader                       # XJY.SYS.CREA.readingReader
│   └── writingWriter                       # XJY.SYS.CREA.writingWriter
├── second/
│   └── secondHandHouse_flask               # XJY.SYS.secondHandHouse_flask
└── trade/
    ├── schoolSecondhandApp_flutter         # XJY.SYS.TRADE.schoolSecondhandApp_flutter
    └── schoolSecondhandApp_springBoot      # XJY.SYS.TRADE.schoolSecondhandApp_springBoot
```

### UTIL - 工具与组件
```
workspaces/util/
├── core/
│   ├── blurGlass           # XJY.UTIL.blurGlass
│   ├── clickTextField      # XJY.UTIL.clickTextField
│   └── listTwoLevel        # XJY.UTIL.listTwoLevel
├── font/
│   ├── fontRegenerated     # XJY.UTIL.FONT.fontRegenerated
│   ├── fontToolExe         # XJY.UTIL.FONT.fontToolExe
│   └── subFontPackage      # XJY.UTIL.FONT.subFontPackage
└── web/
    ├── browserExtensions   # XJY.UTIL.WEB.browserExtensions
    ├── customSearchPage    # XJY.UTIL.WEB.customSearchPage
    ├── fakeBrowser         # XJY.UTIL.WEB.fakeBrowser
    └── websiteTools        # XJY.UTIL.WEB.websiteTools
```

### PAGES - 组织主页
```
pages/
└── shadow-xjy-manager.github.io    # 组织 GitHub Pages
```

**总计：46 个子模块**

## 🚀 快速开始

### 克隆仓库（包含所有子模块）

```bash
# 克隆超级仓库及所有子模块
git clone --recursive https://github.com/shAdow-XJY-Manager/XJY.Workspace.git

# 或者先克隆主仓库，再初始化子模块
git clone https://github.com/shAdow-XJY-Manager/XJY.Workspace.git
cd XJY.Workspace
git submodule update --init --recursive
```

### 更新所有子模块到最新版本

```bash
# 拉取所有子模块的最新更改
git submodule update --remote --merge

# 或者逐个更新
git submodule foreach 'git pull origin main'
```

## 📝 子模块工作流

### 在子模块中进行开发

```bash
# 进入子模块目录
cd workspaces/game/mini/snakeGame

# 正常的 git 工作流
git checkout -b feature/new-feature
# ... 进行修改 ...
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature

# 返回超级仓库
cd ../../../../

# 超级仓库会检测到子模块的 commit 变化
git status
# 输出: modified:   workspaces/game/mini/snakeGame (new commits)

# 提交子模块指针的更新
git add workspaces/game/mini/snakeGame
git commit -m "chore: update snakeGame submodule"
git push
```

### 拉取子模块的更新

```bash
# 如果其他人更新了子模块
git pull

# 更新子模块到新的 commit
git submodule update --init --recursive
```

## ➕ 新增仓库流程

1. **在 GitHub 组织下创建新仓库**（按命名规范，如 `XJY.GAME.MINI.newGame`）

2. **在本地添加子模块**
   ```bash
   # 根据前缀确定路径
   git submodule add https://github.com/shAdow-XJY-Manager/XJY.GAME.MINI.newGame.git \
       workspaces/game/mini/newGame
   
   git commit -m "chore: add newGame submodule"
   git push
   ```

## ➖ 删除仓库流程

```bash
# 1. 从 .gitmodules 和 .git/config 中移除
git submodule deinit -f workspaces/game/mini/oldGame

# 2. 从 git 索引中移除
git rm -f workspaces/game/mini/oldGame

# 3. 删除 .git/modules 中的缓存
rm -rf .git/modules/workspaces/game/mini/oldGame

# 4. 提交更改
git commit -m "chore: remove oldGame submodule"
git push
```

## ⚠️ 未纳入管理的项目

以下项目暂未纳入超级仓管理：

- **Xjy.sys.crea.mapCreator** - 本地 Godot 项目，尚未托管到 GitHub

  如需纳入管理，请先在 GitHub 创建对应仓库并推送代码，然后执行：
  ```bash
  git submodule add https://github.com/shAdow-XJY-Manager/Xjy.sys.crea.mapCreator.git \
      workspaces/sys/crea/mapCreator
  ```

## 📋 命名规范

所有项目遵循以下命名规范：

```
XJY.<类别>.<子类别?>.<项目名>
```

- **类别**：COM, ENT, GAME, LEARN, SYS, UTIL
- **子类别**（可选）：ORG, MUSI, READ, COMP, MARIO, MINI, PVZ, BE, FE, CREA, TRADE, FONT, WEB 等
- **项目名**：驼峰或下划线命名

在超级仓库中的路径映射：
```
XJY.GAME.MINI.snakeGame → workspaces/game/mini/snakeGame/
```

## 🔧 常见问题

### Q: 子模块显示 "modified" 但没有改动？
A: 可能是换行符或文件权限问题。在子模块目录运行 `git diff` 查看具体差异。

### Q: 如何同时拉取多个子模块的更新？
A: 使用 `git submodule update --remote --merge` 或 `git submodule foreach 'git pull origin main'`

### Q: 克隆后子模块目录是空的？
A: 运行 `git submodule update --init --recursive`

## 📄 许可证

各子项目遵循各自的许可证，请参考各子模块的 LICENSE 文件。

## 🤝 贡献

欢迎贡献！请在对应的子模块仓库中提交 Pull Request。

---

**维护者**: shAdow-XJY-Manager  
**最后更新**: 2026-09-17
