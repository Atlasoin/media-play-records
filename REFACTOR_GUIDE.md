# CI Monitor TypeScript + React 重构指南

## 概述

本指南将帮助您将现有的 JavaScript 浏览器扩展重构为 TypeScript + React 架构。

## 重构优势

### 1. **类型安全**
- TypeScript 提供编译时类型检查
- 减少运行时错误
- 更好的 IDE 支持和自动补全

### 2. **组件化开发**
- React 组件化架构
- 更好的代码复用和维护
- 状态管理更清晰

### 3. **现代化工具链**
- Webpack 构建系统
- 热重载开发体验
- 代码分割和优化

## 项目结构

```
ci-monitor/
├── src/                    # 源代码目录
│   ├── components/         # React 组件
│   │   ├── Popup/         # 弹窗组件
│   │   ├── History/       # 历史页面组件
│   │   ├── Calendar/      # 日历组件
│   │   ├── Goals/         # 目标设置组件
│   │   └── common/        # 通用组件
│   ├── services/          # 服务层
│   │   ├── database.ts    # 数据库服务
│   │   ├── videoMonitor.ts # 视频监控服务
│   │   └── achievement.ts # 达标计算服务
│   ├── types/             # TypeScript 类型定义
│   │   ├── database.ts    # 数据库相关类型
│   │   ├── video.ts       # 视频相关类型
│   │   └── goals.ts       # 目标相关类型
│   ├── utils/             # 工具函数
│   │   ├── time.ts        # 时间处理
│   │   ├── storage.ts     # 存储工具
│   │   └── constants.ts   # 常量定义
│   ├── background/        # 后台脚本
│   │   └── service-worker.ts
│   ├── content/           # 内容脚本
│   │   └── video-monitor.ts
│   └── popup/             # 弹窗页面
│       ├── Popup.tsx
│       └── index.tsx
├── public/                # 静态资源
│   ├── manifest.json
│   ├── icons/
│   └── index.html
├── dist/                  # 构建输出
├── package.json
├── tsconfig.json
├── webpack.config.js
└── README.md
```

## 迁移步骤

### 第一步：环境准备

1. **安装依赖**
```bash
npm install
```

2. **验证配置**
```bash
npm run type-check
```

### 第二步：类型定义迁移

1. **数据库类型** (`src/types/database.ts`)
   - 定义 `PlaybackRecord` 接口
   - 定义 `Goal` 和 `DailyGoal` 接口
   - 定义 `Language` 类型

2. **视频监控类型** (`src/types/video.ts`)
   - 定义 `VideoInfo` 接口
   - 定义 `VideoMonitorState` 接口

### 第三步：服务层迁移

1. **数据库服务** (`src/services/database.ts`)
   - 将 `db.js` 迁移为 TypeScript 类
   - 实现 `DatabaseService` 接口
   - 添加类型安全的错误处理

2. **工具函数** (`src/utils/`)
   - 迁移时间处理函数
   - 迁移常量定义
   - 添加类型注解

### 第四步：React 组件迁移

1. **弹窗组件** (`src/components/Popup/`)
   - 将 `popup.js` 迁移为 React 组件
   - 使用 React Hooks 管理状态
   - 添加 TypeScript 类型

2. **历史页面组件** (`src/components/History/`)
   - 将 `history.js` 迁移为 React 组件
   - 拆分为多个子组件
   - 实现响应式设计

### 第五步：后台脚本迁移

1. **Service Worker** (`src/background/service-worker.ts`)
   - 将 `background.js` 迁移为 TypeScript
   - 添加类型安全的消息处理

2. **内容脚本** (`src/content/video-monitor.ts`)
   - 将 `content.js` 迁移为 TypeScript
   - 添加类型安全的 DOM 操作

## 开发命令

```bash
# 开发模式（监听文件变化）
npm run dev

# 生产构建
npm run build

# 类型检查
npm run type-check

# 代码检查
npm run lint

# 清理构建文件
npm run clean
```

## 构建和部署

1. **开发阶段**
   ```bash
   npm run dev
   ```
   在 Chrome 扩展管理页面加载 `dist` 目录

2. **生产部署**
   ```bash
   npm run build
   ```
   将 `dist` 目录打包为扩展

## 注意事项

### 1. **Chrome API 类型**
- 安装 `@types/chrome` 包
- 在 `tsconfig.json` 中配置类型引用

### 2. **模块化导入**
- 使用 ES6 模块语法
- 配置 Webpack 别名 `@` 指向 `src` 目录

### 3. **状态管理**
- 使用 React Hooks 管理组件状态
- 考虑使用 Context API 或 Redux 管理全局状态

### 4. **样式处理**
- 使用 CSS Modules 或 Styled Components
- 保持与现有 CSS 的兼容性

## 迁移检查清单

- [ ] 安装所有必要的依赖
- [ ] 配置 TypeScript 和 Webpack
- [ ] 迁移类型定义
- [ ] 迁移数据库服务
- [ ] 迁移工具函数
- [ ] 创建 React 组件
- [ ] 迁移后台脚本
- [ ] 迁移内容脚本
- [ ] 测试所有功能
- [ ] 优化构建配置
- [ ] 更新文档

## 下一步

完成基础重构后，可以考虑：

1. **状态管理优化**
   - 引入 Redux Toolkit 或 Zustand
   - 实现更复杂的状态管理

2. **UI 组件库**
   - 引入 Material-UI 或 Ant Design
   - 提升用户界面体验

3. **测试框架**
   - 添加 Jest 和 React Testing Library
   - 编写单元测试和集成测试

4. **性能优化**
   - 实现代码分割
   - 优化包大小
   - 添加缓存策略

## 支持

如果在重构过程中遇到问题，请：

1. 检查 TypeScript 错误信息
2. 查看 Webpack 构建日志
3. 参考 React 和 TypeScript 官方文档
4. 在项目 Issues 中提出问题 