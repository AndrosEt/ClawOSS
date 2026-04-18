# ClawOSS Dashboard 开发文档

> Dashboard 是 ClawOSS 的实时监控面板，基于 Next.js 15 + shadcn/ui + Turso/libSQL 构建，部署在 Vercel。

---

## 目录

1. [技术栈](#1-技术栈)
2. [数据库 Schema](#2-数据库-schema)
3. [API 路由清单](#3-api-路由清单)
4. [数据接入流程](#4-数据接入流程)
5. [页面结构](#5-页面结构)
6. [本地开发](#6-本地开发)
7. [Vercel 部署](#7-vercel-部署)
8. [数据保留策略](#8-数据保留策略)
9. [扩展指南](#9-扩展指南)

---

## 1. 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 框架 | Next.js 16 (App Router) | React Server Components + API Routes |
| UI 组件 | shadcn/ui + Base UI | 无样式可定制组件 |
| 样式 | Tailwind CSS v4 | 工具类样式 |
| 图表 | Recharts | 折线图、柱状图、饼图 |
| 数据库 ORM | Drizzle ORM | TypeScript-first SQL ORM |
| 数据库 | Turso (libSQL) | SQLite 兼容，边缘部署 |
| 本地 DB | `dashboard/local.db` | SQLite 本地文件（开发用） |
| GitHub API | @octokit/rest | PR/仓库数据拉取 |
| 数据获取 | SWR | 客户端轮询 + 缓存 |
| 主题 | next-themes | 深色/浅色模式切换 |
| 部署 | Vercel | Serverless Functions + Edge |

---

## 2. 数据库 Schema

数据库共 11 张表（`dashboard/lib/schema.ts`）：

### 核心数据表

#### `heartbeats` — Agent 心跳

| 列 | 类型 | 说明 |
|----|------|------|
| id | TEXT PK | nanoid |
| timestamp | INTEGER | Unix 时间戳 |
| status | TEXT | `alive` / `degraded` / `offline` |
| current_task | TEXT | 当前任务描述 |
| uptime_seconds | INTEGER | 运行时长 |
| metadata | JSON | 附加信息（session 数量等）|

**保留策略：** 7 天

#### `pull_requests` — PR 账本

| 列 | 类型 | 说明 |
|----|------|------|
| id | TEXT PK | nanoid |
| github_id | INTEGER | GitHub PR ID |
| repo | TEXT | `owner/repo` |
| number | INTEGER | PR 编号 |
| title | TEXT | PR 标题 |
| status | TEXT | `open` / `merged` / `closed` |
| quality_score | REAL | 质量评分 (0-100) |
| pr_type | TEXT | `bug_fix` / `docs` / `typo` / `test` / `feature` / `other` |
| merge_probability | INTEGER | P(merge) 预测值 (0-100) |
| additions / deletions / files_changed | INTEGER | 变更量统计 |
| html_url | TEXT | GitHub PR 链接 |

**保留策略：** 永久（有界增长）

#### `conversation_messages` — 对话消息

| 列 | 类型 | 说明 |
|----|------|------|
| session_id | TEXT | OpenClaw session key |
| role | TEXT | `user` / `assistant` / `tool_call` / `tool_result` / `thinking` |
| content | TEXT | 消息内容 |
| tool_name | TEXT | 工具名称（tool_call 时）|
| duration_ms | INTEGER | 执行耗时 |
| token_count | INTEGER | Token 数 |

**索引：** `(session_id, timestamp DESC)` / `timestamp DESC`
**保留策略：** 7 天

#### `metrics_tokens` — Token 用量与成本

| 列 | 类型 | 说明 |
|----|------|------|
| channel | TEXT | 来源频道 |
| provider | TEXT | 模型提供商 |
| model | TEXT | 模型 ID |
| input_tokens | INTEGER | 输入 token 数 |
| output_tokens | INTEGER | 输出 token 数 |
| cost_usd | REAL | 费用（美元）|
| run_duration_ms | INTEGER | 本次运行总耗时 |
| context_tokens | INTEGER | 上下文使用量 |

**保留策略：** 30 天

#### `subagent_runs` — Subagent 运行记录

| 列 | 类型 | 说明 |
|----|------|------|
| session_id | TEXT | Subagent session key |
| repo | TEXT | 目标仓库 |
| type | TEXT | `implementation` / `followup` |
| outcome | TEXT | `success` / `failure` / `abandoned` / `in_progress` |
| failure_reason | TEXT | 失败原因 |
| pr_number | INTEGER | 创建的 PR 编号 |

**索引：** `repo` / `started_at DESC`

#### `autonomy_snapshots` — 自主性评分快照

| 列 | 类型 | 说明 |
|----|------|------|
| score | INTEGER | 综合自主性评分 |
| total_prs / merged_prs | INTEGER | PR 统计 |
| duplicate_count | INTEGER | 重复提交次数 |
| oversized_count | INTEGER | 超大 PR 次数 |
| wasted_count | INTEGER | 无效工作次数 |
| prompt_gaps | INTEGER | Prompt 缺陷次数 |

### 辅助数据表

| 表名 | 说明 |
|------|------|
| `pr_reviews` | PR Review 记录（reviewer/state/body）|
| `quality_scores` | 7 维度质量评分（scope/code/test/security/anti_slop/git/pr_template）|
| `agent_logs` | 结构化审计日志（debug/info/warn/error）|
| `command_audit` | 命令执行审计（action/session_key/source）|
| `agent_state` | Agent 状态快照（work_queue/pipeline_state/active_repos）|
| `settings` | KV 配置存储 |

---

## 3. API 路由清单

### Ingest API（Agent → Dashboard，写入）

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/ingest/heartbeat` | POST | Agent 心跳上报（status/uptime/repos）|
| `/api/ingest/metrics` | POST | Token 用量与成本上报 |
| `/api/ingest/conversation` | POST | 对话消息上报（sessionId/role/content）|
| `/api/ingest/state` | POST | Agent 状态上报（workQueue/pipelineState）|
| `/api/ingest/logs` | POST | 结构化日志上报 |

**鉴权：** 所有 ingest 路由需要 `Authorization: Bearer {CLAW_API_KEY}` 请求头。

### Metrics API（Dashboard 读取，查询）

| 路由 | 说明 |
|------|------|
| `/api/metrics/overview` | 总览：PR 数量、合并率、成本、活跃 session |
| `/api/metrics/velocity` | 速度：每日提交/合并趋势 |
| `/api/metrics/throughput` | 吞吐：subagent 处理量、成功率 |
| `/api/metrics/cost` | 成本：输入/输出 token、美元费用、趋势 |
| `/api/metrics/quality` | 质量评分分布 |
| `/api/metrics/health` | 健康状态：心跳频率、响应延迟 |
| `/api/metrics/repo-health` | 各仓库健康指标 |
| `/api/metrics/portfolio-health` | 整体组合健康评估 |
| `/api/metrics/pr-types` | PR 类型分布（bug_fix/docs/typo/test）|
| `/api/metrics/merge-probability` | P(merge) 分布 |
| `/api/metrics/response-times` | 审查响应时间分析 |
| `/api/metrics/followups` | Follow-up 追踪 |
| `/api/metrics/stale-prs` | 停滞 PR 分析 |
| `/api/metrics/repos` | 仓库维度统计 |
| `/api/metrics/alerts` | 告警列表 |
| `/api/metrics/action-items` | 待处理行动项 |
| `/api/metrics/autonomy` | 自主性评分历史 |
| `/api/metrics/subagent-health` | Subagent 运行健康 |
| `/api/metrics/post-merge` | 合并后分析 |
| `/api/metrics/directives` | 向 Agent 返回指令（avoidRepos/reposWithOpenPRs）|

### GitHub API（数据同步）

| 路由 | 说明 |
|------|------|
| `/api/github/sync` | 从 GitHub 拉取 @BillionClaw 的所有 PR 并入库 |

**Vercel Cron：** 每 2 分钟自动触发一次 `/api/github/sync`（`vercel.json` 配置）。

### Agent API

| 路由 | 说明 |
|------|------|
| `/api/agent/health-check` | Agent 检查此接口，返回 directives/avoidRepos/reposWithOpenPRs |

---

## 4. 数据接入流程

```
OpenClaw Agent 运行时
    │
    ├─ dashboard-reporter hook (TypeScript)
    │   ├─ 每次 user_message → POST /api/ingest/conversation
    │   ├─ 每次 after_tool_call → 累计 token，检测 sessions_spawn
    │   └─ agent_end → POST /api/ingest/metrics + /heartbeat + /state + /logs
    │
    ├─ audit-logger hook (TypeScript)
    │   └─ command:new / after_tool_call / agent_end → POST /api/ingest/logs
    │
    └─ dashboard-sync.sh (后台进程)
        ├─ 每 10s 读 ~/.openclaw/agents/clawoss/sessions/*.jsonl
        ├─ 解析 content blocks (text/thinking/toolCall/tool_result)
        └─ POST /api/ingest/conversation (每条新消息)

launchd (每 60s)
    └─ pr-ledger-sync.sh
        ├─ gh search prs --author BillionClaw
        └─ 更新 workspace/memory/pr-ledger.md

Vercel Cron (每 2 分钟)
    └─ GET /api/github/sync
        └─ 拉取 GitHub PR 数据，写入 pull_requests 表
```

---

## 5. 页面结构

| 页面路径 | 对应组件目录 | 功能 |
|----------|-------------|------|
| `/` | `components/overview/` | 总览：状态、PR 统计、成本、活跃 session |
| `/live` | `components/live/` | 实时对话流（Orchestrator + 各 Subagent 标签页）|
| `/prs` | `components/prs/` | PR 流水线：状态过滤、仓库分组、合并率 |
| `/logs` | `components/logs/` | 审计日志：级别过滤、时间范围 |
| `/health` | `components/health/` | 健康状态：心跳图、告警、行动项 |
| `/repos` | — | 仓库维度统计 |
| `/quality` | `components/quality/` | 质量评分分布与趋势 |

**布局组件：** `components/layout/` — 侧边栏导航 + 全局 header

---

## 6. 本地开发

### 环境准备

```bash
cd dashboard
cp ../.env.example .env.local
# 编辑 .env.local，至少填入：
# CLAW_API_KEY=your-secret（用于 ingest API 鉴权）
# TURSO_DATABASE_URL + TURSO_AUTH_TOKEN（可选，不填则用本地 SQLite）
```

### 启动开发服务器

```bash
cd dashboard
npm install
npm run dev
# 访问 http://localhost:3000
```

本地不设 `TURSO_DATABASE_URL` 时，自动使用 `dashboard/local.db`（SQLite 文件）。

### 数据库操作

```bash
# 查看本地数据库
npx drizzle-kit studio

# 生成迁移文件（修改 schema.ts 后）
npx drizzle-kit generate

# 应用迁移
npx drizzle-kit migrate
```

**注意：** 数据库 Schema 在 `db.ts` 的 `initSchema()` 中用 `CREATE TABLE IF NOT EXISTS` 自动初始化，无需手动迁移即可本地运行。新增列通过 `migrations` 数组兼容旧数据库。

### 模拟 Agent 数据上报

```bash
# 发送测试心跳
curl -X POST http://localhost:3000/api/ingest/heartbeat \
  -H "Authorization: Bearer your-secret" \
  -H "Content-Type: application/json" \
  -d '{"status":"alive","uptimeSeconds":3600,"activeRepos":["owner/repo"]}'

# 发送测试 Token 指标
curl -X POST http://localhost:3000/api/ingest/metrics \
  -H "Authorization: Bearer your-secret" \
  -H "Content-Type: application/json" \
  -d '{"inputTokens":1000,"outputTokens":500,"costUsd":0.002,"model":"minimax/MiniMax-M2.7"}'
```

---

## 7. Vercel 部署

### 环境变量（Vercel 项目设置）

| 变量 | 是否必填 | 说明 |
|------|---------|------|
| `TURSO_DATABASE_URL` | **必填** | Turso 数据库 URL（`libsql://...`）|
| `TURSO_AUTH_TOKEN` | **必填** | Turso 鉴权 token |
| `CLAW_API_KEY` | **必填** | Agent 上报的鉴权 secret |
| `GITHUB_TOKEN` | 可选 | 用于 `/api/github/sync` 拉取 PR 数据 |

**不设 TURSO_DATABASE_URL 时** 会降级到 `/tmp/clawoss.db`（临时文件，冷启动丢失），仅限测试。

### 部署流程

```bash
# 连接 Vercel 项目
vercel link

# 部署到 Preview
vercel

# 部署到 Production
vercel --prod
```

`.github/workflows/deploy-dashboard.yml` 中配置了 CI/CD（推送到 `main` 时自动部署）。

### Cron 任务

`vercel.json` 配置了每 2 分钟触发 `/api/github/sync`，自动从 GitHub 拉取最新 PR 状态。

---

## 8. 数据保留策略

`dashboard/lib/db.ts` 中的 `pruneOldData()` 函数，在每次心跳 ingest 时以约 1/100 概率触发清理：

| 表 | 保留时长 |
|----|---------|
| `heartbeats` | 7 天 |
| `conversation_messages` | 7 天 |
| `agent_logs` | 14 天 |
| `command_audit` | 14 天 |
| `metrics_tokens` | 30 天 |
| 其余表（pull_requests 等）| 永久（有界增长）|

---

## 9. 扩展指南

### 添加新指标 API

1. 在 `dashboard/app/api/metrics/` 下新建目录（如 `my-metric/route.ts`）
2. 实现 `GET` 处理函数，使用 `ensureDb()` 查询数据库
3. 在对应页面组件中用 SWR 获取：`useSWR('/api/metrics/my-metric', fetcher)`

### 添加新数据表

1. 在 `dashboard/lib/schema.ts` 添加表定义
2. 在 `dashboard/lib/db.ts` 的 `initSchema()` 中添加 `CREATE TABLE IF NOT EXISTS`
3. 如需迁移现有数据库，在 `migrations` 数组中添加 `ALTER TABLE` 语句

### 添加新页面

1. 在 `dashboard/app/` 下创建新目录（如 `mypage/page.tsx`）
2. 在 `dashboard/components/layout/` 的侧边栏导航中添加链接
3. 新建 `dashboard/components/mypage/` 放置组件

### 新增 Ingest 接口

1. 在 `dashboard/app/api/ingest/` 下新建 `route.ts`
2. 在 `workspace/hooks/dashboard-reporter/handler.ts` 中调用新接口
3. 确保 Agent 端使用 `CLAW_API_KEY` 进行鉴权

### `/api/metrics/directives` — Agent 指令接口

这是 Dashboard 向 Agent 发送指令的关键接口（在 HEARTBEAT.md 步骤 0c 被调用）。

响应格式：
```json
{
  "directives": "plain-English corrections here",
  "avoidRepos": ["owner/repo1", "owner/repo2"],
  "reposWithOpenPRs": ["owner/repo3"]
}
```

- `directives`：Agent 会阅读并遵循的自然语言指令
- `avoidRepos`：有 2+ PR 且 0 合并的仓库（Agent 不向这些仓库提新 PR）
- `reposWithOpenPRs`：已有开放 PR 的仓库（信息性，Agent 优先 follow-up）

修改此接口的逻辑可以实时调整 Agent 行为，无需重启。
