# iOS Log Viewer Web

这是一个用于查看 iOS 应用日志的 Web 界面，通过 WebSocket 实时接收和显示 iOS 应用的日志信息。

配合iOS Backend Server使用: [Realtime Log iOS BE](https://github.com/SerenitySpace/RealtimeLogVieweriOSBE)

默认WS端口8080,如果项目中BE修改了默认端口,需要手动修改WebBundle中的端口或重新打包该项目产物

## 功能特点

- 📱 实时日志显示
- 🔍 日志内容搜索
- 🏷️ 日志级别筛选（Info/Warning/Error）
- 📋 日志复制功能
- 🔄 自动重连机制
- 📢 新消息提示
- 🕒 本地时区时间显示

## 技术栈

- Vue 3
- WebSocket
- SCSS

## 项目结构

```
web/
├── src/
│   ├── App.vue          # 主应用组件
└── vite.config.js       # Vite 配置
```

## 主要功能说明

### 1. 日志显示
- 实时显示 iOS 应用发送的日志
- 支持按时间戳、日志级别和内容显示
- 自动滚动到最新日志（可选）

### 2. 搜索功能
- 支持实时搜索日志内容
- 搜索时自动高亮匹配文本
- 自动滚动到第一个匹配项

### 3. 日志级别筛选
- 支持按日志级别（Info/Warning/Error）筛选
- 可多选或取消选择
- 与搜索功能协同工作

### 4. 复制功能
- 点击单条日志可复制完整内容
- 复制成功显示提示信息
- 复制失败提供错误提示

### 5. 连接管理
- 自动重连机制（最多10次尝试）
- 连接状态显示
- 手动重连按钮

### 6. 新消息提示
- 当不在底部时显示新消息气泡
- 显示新消息数量
- 点击可快速滚动到底部



## 开发环境

- Node.js >= 16
- npm 或 yarn

## 安装依赖

```bash
npm install
# 或
yarn
```

## 开发服务器

```bash
npm run dev
# 或
yarn dev
```

## 构建

```bash
npm run build
# 或
yarn build
```



## 贡献

欢迎提交 Issue 和 Pull Request 来改进项目。

## 许可证

MIT License 