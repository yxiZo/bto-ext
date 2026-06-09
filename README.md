# BT0 Extension

WXT + React + shadcn/ui Chrome extension — Mukaku 影视资源助手。

## 功能

- 在 `web5.mukaku.com/mv/:id` 详情页打开侧边栏，展示影片元信息
- 自动获取磁力链接（API 优先，DOM 后备），一键复制
- 按清晰度分组展示种子资源

## 文档

| 文档 | 说明 |
|------|------|
| [`docs/site-analysis.md`](docs/site-analysis.md) | 目标站点技术分析（API、DOM、鉴权） |
| [`docs/mukaku-sidepanel-mvp.md`](docs/mukaku-sidepanel-mvp.md) | MVP 功能说明 & 数据边界 |
| [`docs/roadmap.md`](docs/roadmap.md) | 版本开发计划 v0.1 → v1.0 |

## 开发

```bash
npm install
npm test
npm run compile
npm run dev          # 开发模式，热更新
```

在 Chrome `chrome://extensions` 加载 `.output/chrome-mv3-dev` 目录。

## 构建

```bash
npm run build        # 生产构建 → .output/chrome-mv3
```
