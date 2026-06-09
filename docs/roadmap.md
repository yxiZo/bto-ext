# BT0 Extension — 版本开发计划

> 当前版本：v0.2.0 | 目标：Mukaku → 云盘的完整影视资源管线

---

## 版本路线图总览

```
                        ┌──── 核心价值线 ────┐
v0.1.0 ✅  MVP 侧边栏
v0.2.0 ✅  磁力链接 & 复制
v0.3.0 ⬜  数据采集鲁棒性             ← 地基
v0.4.0 ⬜  智能版本推荐 + 115 一键推送  ← 🎯 核心差异化
v0.5.0 ⬜  UI/UX 升级
                        ├──── 扩展线 ────────┤
v0.6.0 ⬜  历史 & 收藏
v0.7.0 ⬜  列表页 & 搜索页
v0.8.0 ⬜  多盘支持
v0.9.0 ⬜  测试体系
v0.10.0 ⬜ 架构优化
v1.0.0 ⬜  自动化 & 订阅
```

---

## v0.1.0 ✅ 已完成

**影视详情侧边栏 MVP**

- [x] 侧边栏基础框架（WXT + React + shadcn/ui）
- [x] Content script DOM 采集详情页元信息
- [x] 影片信息展示（标题、海报、评分、演职员、简介、标签）
- [x] 资源概览（种子/网盘数量 + 分类计数）
- [x] 路由识别（detail / listing / search / other）
- [x] 基础错误处理 & 加载骨架屏
- [x] unit test（路由判断、常量导出）

---

## v0.2.0 ✅ 已完成 — 磁力链接 & 资源详情

**目标**：展示详情页的磁力链接并提供快速复制能力

- [x] **API 数据源** — content script 直接 fetch `getVideoDetail` 获取结构化种子数据
- [x] **DOM 后备** — API 不可用时从 DOM 提取磁力链接 (`a[href^="magnet:"]`)
- [x] **按清晰度分组展示** — 1080P蓝光 / 4K蓝光 / WEB-1080P 等分组
- [x] **一键复制磁力** — 每个种子附带复制按钮 + 复制成功动画反馈
- [x] **资源 metadata** — 展示大小、添加日期、新标签
- [x] **站点分析文档** — `docs/site-analysis.md`

---

## v0.3.0 — 数据采集鲁棒性 🛡️

**目标**：让 content script 在任何边界情况下都能正常工作

- [ ] **MutationObserver 等待策略** — 替代当前 2.5s 硬超时轮询，精确等待 DOM 出现
- [ ] **选择器容错链** — 关键选择器提供 3 级 fallback（如 `.media-details-area h1 → .detail-header h1 → h1`）
- [ ] **SPA 路由变化检测** — 监听 `pushState` / `replaceState` / `popstate`，页面内导航时自动重新采集
- [ ] **快照 schema 校验** — 使用 zod 或手写 validator，标记缺失字段
- [ ] **API 响应缓存** — 30s TTL 缓存，同一影片不重复请求
- [ ] **超时 & 重试** — API fetch 3s 超时 + 1 次重试，失败后自动降级 DOM

---

## v0.4.0 — 智能版本推荐 + 115 一键推送 🎯

**目标**：详情页挑版本不用动脑 + 一键推到 115 离线下载。这是核心差异化功能。

### 4.1 智能版本推荐

- [ ] **清晰度组内最优标记** — 每个清晰度分组内，算法自动标出推荐版本
- [ ] **推荐规则**（可覆盖）：
  - 多音轨 > 单音轨
  - 含字幕 > 无字幕标记
  - 文件大小适中（不是最大也不是最小，避免 remux 或过度压缩）
  - 日期较新（同组内优先新种）
- [ ] **推荐标记 UI** — 推荐版本卡片绿色高亮 + 「推荐」badge
- [ ] **推荐理由 tooltip** — hover 显示为什么推荐（如"国粤双音轨 · 简繁字幕 · 10.9GB"）

### 4.2 115 一键推送

- [ ] **115 API 预研**（jshook）— 逆向 115.com 离线下载 API
  - 鉴权方式（Cookie 字段、过期策略）
  - 提交离线任务 endpoint
  - 返回格式 & 错误码
- [ ] **115 账号状态检测** — 侧边栏显示「115 已连接」或「未登录 115」
- [ ] **一键推送按钮** — 每个磁力卡片右侧「推送到 115」按钮
  - 点击 → 调用 115 API → 2s 变绿勾 ✓
  - 已推送过的显示「已推送」灰态
- [ ] **推送反馈** — Toast：成功 / 失败（含原因） / 任务重复
- [ ] **推送历史** — `chrome.storage.local` 记录，同 magnet hash 不重复推送

### 交互稿

```
┌─────────────────────────────┐
│ BT0 详情助手          115 ✓ │  ← 115 连接状态
├─────────────────────────────┤
│ 🎬 岁月神偷                 │
│ 豆瓣 8.7  IMDb 7.4         │
├─────────────────────────────┤
│ 🧲 磁力链接           (11) │
│                             │
│ ┌ 1080P蓝光 ─── 7 个资源 ─┐│
│ │                          ││
│ │ ⭐推荐 岁月神偷[...]mkv ││  ← 绿色高亮 + 推荐 badge
│ │ 国粤双音轨 · 简繁字幕    ││  ← 推荐理由
│ │ 10.9 GB · 2026-04-26    ││
│ │    [📋复制] [☁️推送115] ││  ← 操作按钮
│ │                          ││
│ │ 岁月神偷[...]SSDSSE     ││  ← 普通样式
│ │ 6.21 GB · 2026-04-03    ││
│ │    [📋复制] [☁️推送115] ││
│ └──────────────────────────┘│
└─────────────────────────────┘
```

---

## v0.5.0 — UI/UX 升级 🎨

- [ ] **深色模式切换** — Toggle + 持久化到 `chrome.storage.local`
- [ ] **Toast 通知系统** — 统一的消息反馈（复制/推送/错误）
- [ ] **骨架屏优化** — 按真实布局定制
- [ ] **Tab 切换动画** — CSS transition 平滑过渡
- [ ] **设置面板** — 深色模式、115 绑定状态、数据管理

---

## v0.6.0 — 浏览历史 & 收藏 ⭐

- [ ] **浏览历史** — `chrome.storage.local` 存储最近 100 条
- [ ] **收藏夹** — 收藏/取消收藏按钮 + 独立列表 tab
- [ ] **收藏备注** — 自定义标签和备注
- [ ] **数据导出** — JSON 格式，支持跨设备迁移

---

## v0.7.0 — 列表页 & 搜索页增强 📋

- [ ] **列表页** — 侧边栏展示影片卡片 + 评分 + 资源数
- [ ] **搜索增强** — 搜索结果摘要、搜索建议
- [ ] **快速跳转** — 点击卡片跳转详情页

---

## 云盘集成

> 115 一键推送的核心功能已在 v0.4.0 中实现。以下为扩展阶段。

### v0.8.0 — 多盘支持 🗂️

**目标**：CloudAdapter 抽象 + 其他网盘接入

- [ ] **CloudAdapter 接口** — 标准化云盘适配器

  ```typescript
  interface CloudAdapter {
    readonly id: string;
    readonly name: string;
    readonly icon: string;
    readonly hostPermissions: string[];

    /** 检查是否已登录 */
    checkLoginStatus(): Promise<{ loggedIn: boolean; username?: string }>;

    /** 获取存储空间信息 */
    getSpaceInfo(): Promise<{ total: number; used: number } | null>;

    /** 提交离线下载任务 */
    submitOfflineTask(magnet: string, fileName?: string): Promise<OfflineTaskResult>;

    /** 查询任务状态 */
    getTaskStatus(taskId: string): Promise<OfflineTaskStatus>;
  }
  ```

- [ ] **新适配器**（按优先级）：百度网盘 → 阿里云盘 → 夸克网盘
- [ ] **推送历史去重** — 同 magnet hash 不重复推送

  ```typescript
  // chrome.storage.local key: "bt0_push_history"
  interface PushRecord {
    magnetHash: string;  // SHA1 → dedup key
    cloudId: string;     // "115" | "baidu"
    taskId: string;
    status: 'pending' | 'downloading' | 'completed' | 'failed';
    pushedAt: string;
  }
  ```

---

## v0.9.0 — 测试体系 🧪

- [ ] **单元测试** — `lib/mukaku.ts`、云盘适配器、utils
- [ ] **组件测试** — React Testing Library 覆盖所有视图状态
- [ ] **集成测试** — content script ↔ sidepanel ↔ background 消息链路
- [ ] **E2E 测试** — Playwright + Chrome Extension 真实流程

---

## v0.10.0 — 架构优化 ⚡

- [ ] **TypeScript strict mode**
- [ ] **站点适配器模式** — 抽象 `SiteAdapter`，支持更多资源站
- [ ] **CI/CD** — GitHub Actions: lint → typecheck → test → build → release
- [ ] **Firefox 兼容验证**
- [ ] **CHANGELOG.md**

---

## v1.0.0 — 智能推荐 & 自动化 🤖

- [ ] **AI 摘要** — LLM 对剧情简介做摘要（缓存结果）
- [ ] **相似推荐** — 基于标签/类型/评分的本地推荐
- [ ] **资源订阅** — 关注某影片，新种子出现时自动推送到云盘
- [ ] **自动化规则** — 自定义规则：「4K + >8分 → 自动推送到 115」
- [ ] **RSS 通知** — 订阅列表更新时发送桌面通知

---

## 建议执行顺序

```
                    ┌─ 快速交付路径 ────────────┐
v0.3.0 鲁棒性 ──→ v0.4.0 智能推荐 + 115推送 ──→ 🎉 核心闭环完成
                    │
                    └─ 完整路径 ──────────────────────→
v0.3.0 → v0.4.0 → v0.5.0 → v0.6.0 → v0.7.0 → v0.8.0 → v0.9.0 → v0.10.0 → v1.0.0
```

**最优先**：
```
v0.3.0 (地基) → v0.4.0 (核心差异化)
                    ↑
         详情页智能挑版本 + 一键推115
```
