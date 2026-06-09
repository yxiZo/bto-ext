# 目标站点分析：web5.mukaku.com

> 最后更新：2026-06-09 | 基于 jshook 实机探查

## 1. 站点概述

| 属性 | 值 |
|------|-----|
| URL | `https://web5.mukaku.com` |
| 品牌 | BuTai0（影视资源聚合站） |
| 框架 | Vue 3 + Pinia + Vue Router（SPA，客户端渲染） |
| UI 库 | Arco Design（字节跳动出品） |
| HTTP 客户端 | Axios（含请求/响应拦截器） |
| 工具库 | lodash、dayjs、crypto-js、echarts、zrender |
| 渲染方式 | **纯 CSR**（非 SSR），HTML 壳 + JS bundle 渲染全部内容 |
| 鉴权 | 基于 URL 参数 `app_id` + `identity`，无 Bearer token |

## 2. 路由结构

| 路由 | 类型 | 说明 |
|------|------|------|
| `/` | 首页 | 影片推荐列表 |
| `/mv/:id` | 详情页 | 影视详情，主要功能页面 |
| `/movie/:r.html` | 列表页 | 电影分类列表 |
| `/tvseries/:r.html` | 列表页 | 剧集分类列表 |
| `/search?sb=keyword` | 搜索页 | 搜索 |
| `/tr/:id.html` | 专题页 | 专题/合集 |
| `/notice/:id.html` | 公告 | 站点公告 |

## 3. API 端点

Base URL: `/prod/api/v1/`，所有请求自动附加 `app_id=83768d9ad4&identity=23734adac0301bccdcb107c4aa21f96c`

### 3.1 getVideoList — 影片列表

```
GET /prod/api/v1/getVideoList?sc=1&app_id=...&identity=...
```

**响应** `data.data[]`：

| 字段 | 类型 | 示例 |
|------|------|------|
| `id` | number | `23554` |
| `idcode` | string | `"3792799"` |
| `title` | string | `"岁月神偷"` |
| `otitle` | string | `"歲月神偷"` |
| `doub_score` | string | `"8.7"` |
| `IMDB_score` | string | `"7.4"` |
| `years` | string | `"2010"` |
| `class` | string | `"剧情,家庭"` |
| `image` | string | CDN 图片 URL |
| `director` | string | `"罗启锐"` |
| `performer` | string | 逗号分隔演员 |
| `definition` | string | `"1080P蓝光,其他,WEB-1080P"` |
| `abstract` | string | 剧情简介（含 `\r` 和 `&#8226;`） |

### 3.2 getVideoDetail — 影片详情 ⭐ 核心 API

```
GET /prod/api/v1/getVideoDetail?id={mediaId}&app_id=...&identity=...
```

**响应结构**：

```jsonc
{
  "success": true,
  "data": {
    // 基础信息：id, idcode, title, otitle, image, doub_score, IMDB_score,
    //            years, release, class, production_area, language, long_time,
    //            director, edit (编剧), performer, abstract, definition,
    //            is_show_seed, show_number, znum (种子总数)

    // 种子资源 — 按清晰度分组
    "ecca": {
      "1080P蓝光": [
        {
          "zname": "岁月神偷[...].BluRay.1080p.DTS.x264-DreamHD",  // 资源名
          "new": 1,                                                  // 1=新
          "id": 809677,                                              // 种子ID
          "zsize": "10.9 GB",                                        // 大小
          "zqxd": "1080P蓝光",                                       // 清晰度
          "zlink": "magnet:?xt=urn:btih:03939E4017...",              // 🔑 磁力链接
          "down": "/prod/api/v1/down?...&lx=1&id=...",              // 下载代理
          "ezt": "2026-04-26",                                       // 添加日期
          "definition_group": "1080P蓝光"                            // 清晰度组
        }
      ],
      "WEB-1080P": [ /* ... */ ],
      "其他": [ /* ... */ ]
    },

    // 所有种子的扁平列表（结构同上）
    "all_seeds": [ /* 同上结构的扁平数组 */ ]
  }
}
```

**Key insight**：`all_seeds` 和 `ecca` 中的 `zlink` 字段直接包含完整磁力链接，无需额外请求。

### 3.3 其他 API

| 端点 | 用途 |
|------|------|
| `routesAll` | 全站路由配置 |
| `userNoticeList?visitorToken=...` | 用户公告 |
| `getWpDictList?code=wpan_type` | 网盘类型字典 |
| `down?lx=1&id=...` | 种子下载代理 |

## 4. DOM 结构（详情页）

### 4.1 影视信息区 `.media-details-area`

```
.media-details-area
  .poster img                          → 海报
  .info
    h1                                  → 片名
    .original-title                     → 原名
    .year                               → 年份
    p                                   → 又名 / 上映日期 / 片长 / 集数 / 地区 / 语言 / 类型
  .cast-info-group:nth-of-type(1)       → 导演
  .cast-info-group:nth-of-type(2)       → 编剧
  .cast-info-group:nth-of-type(3)       → 演员
  .summary p                            → 简介
  .tag-list .tag-item                   → 标签
  .rating-link.douban                   → 豆瓣评分
  .rating-link.imdb                     → IMDb 评分
```

### 4.2 资源区 `.resource-nav-wrapper`

```
.resource-nav-wrapper
  .nav-item                             → 资源分类标签 ("种子资源 (11)", "1080P蓝光 (7)", ...)
```

### 4.3 资源卡片 `.resource-item-card-modern`

```
.resource-item-card-modern
  .resource-item-title a                → 资源名称
  .meta-tag                             → 清晰度/新/日期标签
  .action-buttons
    a[href^="magnet:"]                  → 🔑 磁力链接（DOM 后备方案）
    a[href*="/down?"]                   → 种子下载
```

## 5. Axios 拦截器分析

从 `index-ddfbcb39.js` bundle 中提取的拦截器逻辑：

```javascript
// 请求拦截器：自动注入 app_id 和 identity
e.params.app_id = "83768d9ad4";
e.params.identity = "23734adac0301bccdcb107c4aa21f96c";

// 可选：注入 access_token（来自 localStorage）
const token = localStorage.get("token");
if (token) e.params.access_token = token;

// 响应拦截器
// 成功：返回 response.data
// 失败：eject(response ?? null)
```

**结论**：`app_id` / `identity` 是稳定的硬编码值，站点更新 bundle 时可能变化，但变化频率低。可直接用于 content script 的 fetch 请求。

## 6. 扩展采集策略

### 主方案：API fetch

```
content script fetch
  → GET /prod/api/v1/getVideoDetail?id={mediaId}&app_id=...&identity=...
  → 解析 response.data.all_seeds[].zlink
  → 按 quality 分组（response.data.ecca 已分组，可直接使用）
```

**优势**：数据完整、结构清晰、包含 metadata（大小、日期、新标签）
**风险**：站点更换 app_id/identity 或修改 API 路径

### 后备方案：DOM 提取

```
content script querySelectorAll
  → .resource-item-card-modern a[href^="magnet:"]
  → 提取 href 属性和相邻文本
```

**优势**：不依赖 API 结构，永不过期
**劣势**：页面未渲染完成时无数据，metadata 提取较粗糙

### 降级策略

```
API fetch → 成功且有数据 → 使用 API 数据
         → 失败或空数据 → DOM 提取
         → DOM 也无数据 → 显示"未读取到磁力链接"
```

## 7. 已知限制

1. **网盘资源**：当前 API (`getVideoDetail`) 仅返回种子数据，网盘资源需单独 API 或点击"网盘资源" tab 触发
2. **反爬**：站点使用 crypto-js，可能未来升级反爬策略
3. **CORS**：content script 运行于页面 origin，同源 fetch 无 CORS 问题
4. **访客 token**：localStorage 中的 `visitorToken` 可能用于频率限制，但当前 API 不强制要求
