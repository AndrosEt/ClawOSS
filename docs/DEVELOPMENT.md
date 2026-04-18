# ClawOSS 开发文档

> 本文档面向后续开发者，完整描述 ClawOSS 的架构、核心文件、工作流程和开发指南。

---

## 目录

1. [项目概述](#1-项目概述)
2. [整体架构](#2-整体架构)
3. [目录结构详解](#3-目录结构详解)
4. [核心组件说明](#4-核心组件说明)
5. [工作流程](#5-工作流程)
6. [配置系统](#6-配置系统)
7. [开发指南](#7-开发指南)
8. [运维指南](#8-运维指南)
9. [常见问题](#9-常见问题)

---

## 1. 项目概述

ClawOSS 是一个**自主运行的开源贡献 Agent**。它以 [OpenClaw](https://github.com/openclaw/openclaw) 为运行引擎，24/7 自动发现 GitHub issue、实现修复、提交 PR，目标是最大化 **PR 合并率**（而非提交数量）。

**贡献类型（按合并概率降序）：**

| 类型 | 说明 |
|------|------|
| Typo 修复 | 几乎必合并 |
| 文档修复 | 高合并率 |
| 测试添加 | 良好合并率 |
| Bug 修复 | 标准合并率 |

**明确不做：** 新功能、重构、性能优化、依赖升级、架构变更。

**GitHub 身份：** 通过 `GITHUB_USERNAME` 环境变量配置（`.env` 文件）

**主模型：** 通过 `LLM_MODEL` / `LLM_BASE_URL` / `LLM_API_KEY` 环境变量配置，支持任意 OpenAI 兼容 API

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────┐
│           OpenClaw Gateway (port 18789, local mode)      │
│   每 5 分钟心跳唤醒 Orchestrator                          │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Orchestrator (主会话, main session)          │
│                                                         │
│  读取: HEARTBEAT.md / AGENTS.md / SOUL.md               │
│        memory/work-queue.md                             │
│        memory/pr-ledger.md                              │
│        memory/pipeline-state.md                         │
│                                                         │
│  执行: oss-discover / oss-triage                         │
│        repo-analyzer / context-manager                  │
└────────┬──────────┬──────────┬──────────┬──────────────┘
         │          │          │          │
    ┌────▼───┐ ┌────▼───┐ ┌───▼────┐ ┌───▼────┐
    │ Scout  │ │PR Mon  │ │PR Mon  │ │PR      │  ← 4 个常驻 Subagent
    │(发现)  │ │Scan    │ │Deep    │ │Analyst │
    └────────┘ └────────┘ └────────┘ └────────┘
         │
    ┌────▼───┐ ┌────────┐  ... 最多 10 个并发
    │Impl #1 │ │Impl #2 │  ← 实现/跟进 Subagent
    │clone   │ │clone   │    (clone→repro→fix→test→PR)
    │fix     │ │fix     │
    │PR      │ │PR      │
    └────────┘ └────────┘
         │
         ▼
  memory/subagent-result-<repo>-<issue>.md
         │
    ┌────▼───────────────────────────────────┐
    │         Telemetry & Sync               │
    │  dashboard-reporter hook (tokens/cost) │
    │  audit-logger hook (结构化日志)         │
    │  pii-sanitizer plugin (@↔＠)           │
    │  dashboard-sync.sh (JSONL→Dashboard)   │
    │  pr-ledger-sync.sh (GitHub→pr-ledger)  │
    └────────────────────────────────────────┘
         │
         ▼
  Vercel Dashboard (clawoss-dashboard.vercel.app)
```

**并发限制：**
- 总 maxConcurrent = **14**（4 常驻 + 10 实现/跟进）
- 新 PR 优先于跟进：先填满 10 个实现槽，再做 follow-up
- 每个 Subagent 生命周期结束后回复 `ANNOUNCE_SKIP`

---

## 3. 目录结构详解

```
ClawOSS/
├── config/                          # 配置文件（提交到 git，无 secrets）
│   ├── openclaw.json                # Agent/Gateway/Model/Tools 配置模板
│   ├── cron-jobs.json               # 定时任务（V10 已禁用，由 subagents 替代）
│   └── com.clawoss.pr-ledger-sync.plist  # macOS launchd: PR 账本同步服务
│
├── dashboard/                       # Next.js 15 监控面板
│   ├── app/
│   │   ├── api/                     # API 路由（ingest/metrics/github/agent）
│   │   ├── live/                    # 实时对话页
│   │   ├── prs/                     # PR 流水线页
│   │   ├── logs/                    # 审计日志页
│   │   ├── health/                  # 健康状态页
│   │   ├── repos/                   # 仓库统计页
│   │   └── quality/                 # 质量评分页
│   ├── components/                  # React 组件
│   ├── lib/
│   │   ├── schema.ts                # Drizzle ORM 数据库 Schema（11 张表）
│   │   ├── db.ts                    # Turso/libSQL 数据库连接
│   │   ├── github.ts                # GitHub API 封装
│   │   ├── metrics.ts               # 指标计算
│   │   ├── quality.ts               # 质量评分逻辑
│   │   ├── cost-models.ts           # Token 费用模型
│   │   └── pr-type.ts               # PR 类型分类
│   └── drizzle.config.ts            # 数据库迁移配置
│
├── plugins/
│   └── pii-sanitizer/               # OpenClaw 插件
│       └── index.js                 # 双向 @↔＠ 替换（绕过内容过滤器）
│
├── scripts/                         # 运维脚本
│   ├── setup.sh                     # 首次安装（145 行）
│   ├── restart.sh                   # 完整重启（18 步，幂等）
│   ├── start.sh / stop.sh           # 启停
│   ├── health-check.sh              # 系统健康检查
│   ├── dashboard-sync.sh            # JSONL 会话→Dashboard（319 行）
│   ├── pr-ledger-sync.sh            # GitHub API→pr-ledger.md（185 行）
│   ├── heartbeat-status.sh          # 快速状态快照（返回 JSON）
│   ├── compute-merge-probability.sh # P(merge) 计算
│   ├── check-*.sh                   # 各类检查脚本
│   └── tests/                       # 脚本测试套件
│
├── templates/                       # PR/Issue 文案模板
│   ├── pr-template.md               # PR 描述模板
│   ├── commit-conventions.md        # Conventional Commits 规范
│   └── issue-response-template.md   # Issue 回复模板
│
├── workspace/                       # Agent 工作区（symlink → ~/.openclaw/workspace）
│   ├── AGENTS.md                    # ⭐ 核心规则（任务、安全、PR 生命周期）
│   ├── HEARTBEAT.md                 # ⭐ 自主循环（步骤 0-7）
│   ├── SOUL.md                      # Agent 人格与边界
│   ├── IDENTITY.md                  # Agent 身份（由 GITHUB_USERNAME 配置）
│   ├── USER.md                      # 操作者 Profile
│   ├── MEMORY.md                    # 长期记忆（经验积累）
│   ├── TOOLS.md                     # 工具使用说明
│   ├── BOOTSTRAP.md                 # 启动引导
│   │
│   ├── hooks/                       # OpenClaw 钩子（TypeScript）
│   │   ├── dashboard-reporter/      # Telemetry 上报（628 行）
│   │   └── audit-logger/            # 结构化日志（133 行）
│   │
│   ├── skills/                      # Agent 技能库（16 个）
│   │   ├── oss-discover/            # 发现 GitHub issue
│   │   ├── oss-triage/              # 评分与筛选
│   │   ├── oss-implement/           # 实现修复（深度理解工作流）
│   │   ├── oss-review/              # 自我审查（8 点检查）
│   │   ├── oss-submit/              # 创建 PR
│   │   ├── oss-followup/            # 处理审查反馈
│   │   ├── oss-pr-review-handler/   # PR Review 处理器
│   │   ├── repo-analyzer/           # 仓库健康评估
│   │   ├── safety-checker/          # 最终安全门控
│   │   ├── context-manager/         # 上下文窗口管理
│   │   ├── dashboard-reporter/      # 上报指标
│   │   ├── systematic-debugging/    # 系统化调试
│   │   ├── test-driven-development/ # TDD 工作流
│   │   ├── verification-before-completion/ # 完成前验证
│   │   ├── brainstorming/           # 复杂设计前头脑风暴
│   │   └── requesting-code-review/  # 派遣独立审查 subagent
│   │
│   ├── templates/                   # Subagent 任务模板
│   │   ├── subagent-implementation.md  # 实现 subagent 提示词
│   │   ├── subagent-followup.md        # 跟进 subagent 提示词
│   │   ├── subagent-scout.md           # Scout subagent 提示词
│   │   ├── subagent-pr-monitor.md      # PR Monitor Scan 提示词
│   │   ├── subagent-pr-monitor-deep.md # PR Monitor Deep 提示词
│   │   ├── subagent-pr-analyst.md      # PR Analyst 提示词
│   │   └── subagent-result-schema.md   # Result 文件格式规范
│   │
│   └── memory/                      # 运行时状态（gitignored）
│       ├── work-queue.md            # 当前工作队列
│       ├── work-queue-staging.md    # Scout 写入的待合并候选
│       ├── followup-staging.md      # PR Monitor 写入的跟进任务
│       ├── impl-spawn-state.md      # 实现 subagent 状态跟踪
│       ├── pr-followup-state.md     # PR 跟进状态
│       ├── pr-ledger.md             # 所有 PR 账本（自动同步）
│       ├── wake-state.md            # 心跳状态计数器
│       ├── trust-repos.md           # 可信仓库列表与评分
│       ├── failure-log.md           # 失败原因日志
│       ├── pr-strategy.md           # PR Analyst 输出的策略
│       ├── repos/                   # 每个仓库的元数据（24h 缓存）
│       ├── locks/                   # 防重复锁文件
│       └── subagent-result-*.md     # Subagent 结果（处理后删除）
│
├── reports/                         # 历史分析报告
├── .env.example                     # 环境变量模板
├── CLAUDE.md                        # Claude Code 使用说明（本 Agent 配置概览）
├── CHANGELOG.md                     # 版本变更记录
└── package.json                     # 根包（validate-config 脚本）
```

---

## 4. 核心组件说明

### 4.1 OpenClaw Gateway

OpenClaw 是运行引擎，Gateway 是本地服务（端口 18789）。

- **心跳**：每 5 分钟唤醒 Orchestrator，执行 HEARTBEAT.md
- **配置路径**：`~/.openclaw/openclaw.json`（由 `restart.sh` 深度合并生成）
- **会话文件**：`~/.openclaw/agents/clawoss/sessions/*.jsonl`
- **日志**：`~/.openclaw/logs/`

关键配置项（`config/openclaw.json`）：

| 字段 | 值 | 说明 |
|------|----|------|
| `agents.defaults.model.primary` | `__LLM_MODEL__` (from env) | 主模型 |
| `agents.defaults.subagents.maxConcurrent` | `14` | 最大并发 subagent |
| `agents.defaults.compaction.mode` | `safeguard` | 上下文压缩策略 |
| `heartbeat.every` | `5m` | 心跳间隔 |
| `gateway.port` | `18789` | Gateway 端口 |

### 4.2 Orchestrator 主循环（HEARTBEAT.md）

每次心跳执行步骤 0-7，无限循环：

| 步骤 | 内容 |
|------|------|
| 0 | 健康检查：context 使用率 >35% 立即压缩；读 Dashboard 指令；circuit breaker |
| 0.5 | 检查 4 个常驻 Subagent（Scout/PR Monitor Scan/Deep/Analyst），死亡则立即重生 |
| 1 | 停滞恢复：kill 超时 Subagent；清理过期锁 |
| 2 | **选择工作**：合并 staging 文件→work-queue；按 P(merge) 排序；填满 10 个实现槽 |
| 4 | Triage：类型检查、标签过滤、评分、超越检查 |
| 5 | 派遣实现 Subagent（含锁文件写入，防止重复） |
| 6 | 处理 Subagent 结果：更新 pr-ledger、impl-spawn-state、trust-repos |
| 7 | 上报 Dashboard；更新 wake-state；自我唤醒；删除已处理结果文件 |

**关键约束：**
- 禁止说 "monitoring for completion events"、"standing by"、"waiting"
- 队列 <5 立即运行 `oss-discover`
- 新 PR > 跟进；10 个实现槽全满才做 follow-up

### 4.3 常驻 Subagent（4 个）

| 名称 | Label | 输出文件 | 功能 |
|------|-------|----------|------|
| Scout | `scout-*` | `memory/work-queue-staging.md` | 持续发现 issue，写入候选队列 |
| PR Monitor Scan | `pr-monitor-scan` | `memory/pr-monitor-active.md` | 快速扫描所有开放 PR，处理即时操作 |
| PR Monitor Deep | `pr-monitor-deep` | `memory/followup-staging.md` | 深度分析 PR 评论，构建 follow-up 上下文 |
| PR Analyst | `pr-analyst` | `memory/pr-strategy.md` | 组合分析：失败模式、信任评分、策略建议 |

启动模板：`workspace/templates/subagent-*.md`（每次从磁盘重读，避免使用缓存）

### 4.4 实现 Subagent

每个实现 Subagent 的生命周期：

```
clone repo → 读取 CONTRIBUTING.md → 理解架构 → 复现 bug（写 FAILING test）
→ 实现修复（根因，非症状）→ 验证（CI 矩阵全通过）→ 自我审查
→ safety-checker 最终门控 → 创建 PR → 清理 /tmp/clawoss-* → ANNOUNCE_SKIP
```

**失败处理：**
- 2 次 fix 尝试失败 → 放弃
- CI 不通过 → 不提交（ci_incompatible 或 fix_rejected）
- 发现是 feature request → 立即放弃

### 4.5 PII Sanitizer 插件

路径：`plugins/pii-sanitizer/index.js`

解决 OpenRouter 内容过滤器对 `@` 符号的误判（如 `@me`、`@username` 导致 403）。

```
Disk (@) → 读入 Session (＠) → 模型输出 (＠) → 工具调用执行 (＠→@) → Disk
```

三个钩子：
- `tool_result_persist`：读文件时 `@`→`＠`
- `before_message_write`：写消息时 `@`→`＠`
- `before_tool_call`：执行工具前 `＠`→`@`

### 4.6 Telemetry 管道

**dashboard-reporter hook**（`workspace/hooks/dashboard-reporter/`）：
- 追踪 inputTokens / outputTokens / costUsd
- 检测 `sessions_spawn` 调用，提取 subagent 元数据
- 事件：`user_message` / `after_tool_call` / `agent_end`
- `agent_end` 时 flush 全部指标并重置累加器

**audit-logger hook**（`workspace/hooks/audit-logger/`）：
- 结构化日志：`info`/`debug`/`warn`/`error`
- 事件：会话启动、工具调用、运行完成

**dashboard-sync.sh**（319 行后台进程）：
- 每 60s 读 `~/.openclaw/agents/clawoss/sessions/*.jsonl`
- 解析消息块（text/thinking/toolCall/tool_result）
- `curl POST /api/ingest/conversation`（每条消息）
- `curl POST /api/ingest/heartbeat`（session 计数）

**pr-ledger-sync.sh**（185 行，launchd 每 60s）：
- 来源 1：`gh search prs --author $GITHUB_USERNAME --limit 200`
- 来源 2：grep `subagent-result-*.md` 提取 PR URL
- Python 合并：以 GitHub 状态为权威；更新 `memory/pr-ledger.md`

---

## 5. 工作流程

### 5.1 P(merge) 评分公式

```
P(merge) = 信任度(25%) + PR大小(20%) + 任务类型(15%)
         + 仓库响应速度(15%) + 时效性(10%) + 贡献者契合度(10%)
         + 竞争情况(5%)
```

- P(merge) >= 30：可以尝试
- P(merge) >= 60：优先派遣

### 5.2 Issue 过滤规则

**跳过条件（任一满足即跳过）：**
- 存档仓库 / Stars < 100 / 30 天无提交
- 标签含：`enhancement`、`feature`、`refactor`、`discussion`、`question` 等
- Issue 有关联的开放 PR（超越检查）
- Issue 已被分配给他人
- 有人发表了"我来处理"的评论
- Issue 已关闭
- 近期合并 PR 已修复该 issue
- 需要签署 CLA（agent 无法签署）
- 超过 30 天未更新

**标题关键词拒绝：**
`add`、`extend`、`enable`、`improve`、`enhance`、`new feature`、`implement`、`support` 等

### 5.3 PR 大小限制

| 限制 | 值 |
|------|----|
| 目标行数 | 25-100 LOC |
| 硬性上限 | 200 LOC（超过即放弃） |
| 最大文件数 | 5 |
| 每仓库每日最多 | 3 PR |
| 同仓库间最小间隔 | 30 分钟 |

### 5.4 PR Follow-up 生命周期

```
PR 创建 → PR Monitor Scan 检测评论
         → PR Monitor Deep 构建完整评论上下文
         → followup-staging.md 写入跟进任务
         → Follow-up Subagent 派遣
         → clone → checkout PR 分支 → 读所有评论
           → 实现修改 → 运行测试 → push → gh pr comment 回复
         → 最多 3 轮，第 4 轮礼貌脱离
```

---

## 6. 配置系统

### 6.1 环境变量（`.env`）

```bash
# 必填 — GitHub
GITHUB_TOKEN=ghp_...          # GitHub PAT，需要 public_repo scope
GITHUB_USERNAME=your-username # PR 提交用户名（用于 gh 命令、fork 克隆等）
GITHUB_EMAIL=...              # PR 提交邮箱

# 必填 — LLM（任意 OpenAI 兼容 API）
LLM_MODEL=openai/gpt-4o       # 格式：provider/model_id
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...

# 可选 — LLM 详细配置
LLM_CONTEXT_WINDOW=128000     # 上下文窗口大小（tokens）
LLM_MAX_TOKENS=16384          # 最大输出 tokens
LLM_INPUT_COST_PER_MILLION=2.50   # 输入计费（USD/M tokens）
LLM_OUTPUT_COST_PER_MILLION=10.00 # 输出计费（USD/M tokens）
LLM_FALLBACK_MODEL=           # 备用模型（可选）
LLM_FALLBACK_BASE_URL=
LLM_FALLBACK_API_KEY=

# 可选 — 预算控制
TOKEN_BUDGET_USD=50           # 总花费上限（USD，0 = 不限制）

# 可选 — Dashboard
DASHBOARD_URL=https://...     # Vercel Dashboard URL
CLAW_API_KEY=...              # Dashboard 鉴权 key
```

### 6.2 配置部署流程

`restart.sh` 通过 Python 深度合并：
```
config/openclaw.json（模板）
        ↓ 替换 __WORKSPACE_PATH__ 等占位符
        ↓ 深度合并到 ~/.openclaw/openclaw.json
        ↓ 注入环境变量（LLM_API_KEY、GITHUB_TOKEN、GITHUB_USERNAME 等）
```

**规则：** 部署配置保留 Gateway 管理字段（`meta`、`commands`、`plugins`、`gateway.auth`），覆盖 Agent/Tool/Skill 字段。

### 6.3 Workspace 链接

```bash
~/.openclaw/workspace → /path/to/ClawOSS/workspace  # symlink
```

这意味着 `workspace/` 目录下的所有修改会立即对 Agent 生效（SKILL.md、HEARTBEAT.md 等）。

---

## 7. 开发指南

### 7.1 修改 Agent 行为

**修改 Heartbeat 循环（步骤逻辑）：**
- 编辑 `workspace/HEARTBEAT.md`
- 同时更新 `config/openclaw.json` 中 `heartbeat.prompt` 字段
- 运行 `openclaw config set` 热重载，或 `bash scripts/restart.sh` 完整重启

**修改安全规则、PR 策略、发现标准：**
- 编辑 `workspace/AGENTS.md`
- 文件大小限制：**< 20000 字符**（OpenClaw 会截断）

**修改 Agent 人格/边界：**
- 编辑 `workspace/SOUL.md`

### 7.2 添加新 Skill

```
workspace/skills/my-skill/
└── SKILL.md   # 技能说明（YAML frontmatter + 步骤流程）
```

SKILL.md 格式：
```yaml
---
name: my-skill
description: "简短描述"
user-invocable: true
---

# 技能名称
详细步骤...
```

Agent 加载方式：`read ~/clawOSS/workspace/skills/my-skill/SKILL.md`

### 7.3 修改 Subagent 模板

Subagent 任务提示词位于 `workspace/templates/`。每次 Orchestrator 派遣 Subagent 时都会**从磁盘重读**（不使用缓存），因此直接编辑模板文件即可生效。

关键模板：
- `subagent-implementation.md`：实现 Subagent 的完整任务提示词
- `subagent-followup.md`：Follow-up Subagent 的任务提示词
- `subagent-scout.md`：Scout 的持续发现提示词

### 7.4 修改模型配置

只需修改 `.env`，无需手动编辑 `config/openclaw.json`：
```bash
LLM_MODEL=anthropic/claude-opus-4  # 改为你的模型
LLM_BASE_URL=https://api.anthropic.com/v1
LLM_API_KEY=sk-ant-...
LLM_INPUT_COST_PER_MILLION=15.0
LLM_OUTPUT_COST_PER_MILLION=75.0
LLM_CONTEXT_WINDOW=200000
LLM_MAX_TOKENS=32768
```

`restart.sh` 会自动读取这些变量，动态生成 `models.providers` 块并部署到 `~/.openclaw/openclaw.json`。修改后运行：
```bash
bash scripts/restart.sh
```

### 7.5 添加新 Telemetry 钩子

```
workspace/hooks/my-hook/
├── handler.ts     # OpenClaw hook handler
└── package.json
```

钩子接收的事件：
- `command:new`：新会话启动
- `after_tool_call`：工具调用后
- `agent_end`：Agent 运行结束
- `tool_result_persist`：工具结果持久化
- `before_message_write`：消息写入前
- `before_tool_call`：工具调用前

### 7.6 修改 PII Sanitizer

`plugins/pii-sanitizer/index.js`（101 行）。

修改后需重新安装插件：
```bash
cp plugins/pii-sanitizer/index.js ~/.openclaw/extensions/clawoss-pii-sanitizer/index.js
```

或运行 `bash scripts/restart.sh`（自动复制）。

### 7.7 修改 PR 账本同步逻辑

`scripts/pr-ledger-sync.sh`：
- 修改同步频率：编辑 `config/com.clawoss.pr-ledger-sync.plist` 中的 `StartInterval`
- 修改 PR 查询逻辑：调整 `gh search prs` 参数
- 修改后重载 launchd：
  ```bash
  launchctl unload ~/Library/LaunchAgents/com.clawoss.pr-ledger-sync.plist
  launchctl load ~/Library/LaunchAgents/com.clawoss.pr-ledger-sync.plist
  ```

---

## 8. 运维指南

### 8.1 启动与重启

```bash
# 首次安装
cp .env.example .env
# 编辑 .env 填入 API keys
bash scripts/setup.sh

# 完整重启（推荐，幂等）
bash scripts/restart.sh

# 快速启动（不清理状态）
bash scripts/start.sh

# 停止
bash scripts/stop.sh
```

### 8.2 常用运维命令

```bash
# 查看 Agent 日志（实时）
openclaw logs

# 查看 Agent 状态快照
bash scripts/heartbeat-status.sh

# 手动唤醒 Agent
openclaw system event --text "resume heartbeat" --mode now

# 查看所有开放 PR
gh pr list --author $GITHUB_USERNAME --state open

# 健康检查
bash scripts/health-check.sh

# 查看 Gateway 状态
openclaw gateway status

# 重启 Gateway（修改配置后）
launchctl unload ~/Library/LaunchAgents/ai.openclaw.gateway.plist
launchctl load ~/Library/LaunchAgents/ai.openclaw.gateway.plist

# 查看 PR 账本同步日志
tail -f /tmp/dashboard-sync.log

# 清理过期临时目录
bash scripts/tmp-cleaner.sh
```

### 8.3 Memory 文件管理

Memory 文件（`workspace/memory/`）由 Agent 自主管理，但开发者可手动干预：

| 文件 | 用途 | 何时手动修改 |
|------|------|-------------|
| `work-queue.md` | 当前工作队列 | 想手动添加/删除任务 |
| `trust-repos.md` | 信任仓库列表 | 手动添加/屏蔽仓库 |
| `wake-state.md` | 心跳计数器 | 重置错误计数 |
| `impl-spawn-state.md` | Subagent 状态 | 解决状态卡死（restart.sh 自动重置）|
| `pr-ledger.md` | PR 账本 | 由 pr-ledger-sync.sh 自动维护 |

**重启会自动重置：** `impl-spawn-state.md`、`pr-followup-state.md`、`wake-state.md`、所有锁文件。

### 8.4 仓库黑名单管理

在 `memory/trust-repos.md` 的 `Deprioritized` 区域添加：

```markdown
| owner/repo | permanent | 原因 |
```

`Skip Until: permanent` 表示永久屏蔽，Agent 不会覆盖此规则。

### 8.5 上下文压缩

Agent 在以下情况自动触发压缩：
- 步骤 0a：上下文 > 35% 立即压缩
- 步骤 6.5：处理 Subagent 结果后必检查

压缩前会将状态 flush 到 memory 文件：
- `memory/impl-spawn-state.md`
- `memory/pr-followup-state.md`
- `memory/work-queue.md`

### 8.6 故障排查

**Agent 不响应 / 心跳停止：**
```bash
openclaw gateway status
openclaw logs | tail -50
bash scripts/restart.sh
```

**Sub-agent 卡死（zombie）：**
```bash
# 通过 heartbeat-status.sh 找到 session key
bash scripts/heartbeat-status.sh
# 手动 kill
openclaw system event --text "/subagents kill {sessionKey}" --mode now
```

**PR 重复提交（race condition）：**
- 检查 `memory/locks/` 中是否有遗留锁文件
- `bash scripts/cleanup-stale-sessions.sh` 清理

**Dashboard 无数据：**
```bash
# 检查 dashboard-sync 是否在运行
ps aux | grep dashboard-sync
# 检查 API key
echo $CLAW_API_KEY
# 手动触发同步
curl -X POST https://clawoss-dashboard.vercel.app/api/github/sync
```

---

## 9. 常见问题

**Q: 如何知道 Agent 当前在做什么？**  
A: `openclaw logs` 查看实时日志；Dashboard 的 Live 页面查看对话流。

**Q: 如何添加一个特定仓库作为优先目标？**  
A: 编辑 `workspace/memory/trust-repos.md`，在 Trusted Repos 区域添加该仓库并设置高优先级分数。

**Q: Agent 为什么跳过某个 issue？**  
A: 检查 `memory/failure-log.md`；常见原因：CLA、已被分配、存在竞争 PR、超过 30 天、仓库不活跃。

**Q: 如何调整 merge-probability 阈值？**  
A: 编辑 `workspace/AGENTS.md` 和 `workspace/HEARTBEAT.md` 中的 P(merge) 相关段落，以及 `config/openclaw.json` 中 heartbeat prompt 对应描述。

**Q: context 压缩后 Agent 会丢失状态吗？**  
A: 不会。压缩前 Agent 会将状态写入 memory 文件，压缩后重读。参见 `workspace/skills/context-manager/SKILL.md`。

**Q: 如何让 Agent 停止向某个仓库提 PR？**  
A: 在 `memory/trust-repos.md` Deprioritized 区域添加该仓库（设 `Skip Until: permanent`），或等待 Dashboard 的 `avoidRepos` 指令自动屏蔽（仓库有 2+ PR 且 0 合并时触发）。

**Q: 为什么要用 MiniMax M2.7 而不是 OpenRouter？**  
A: OpenRouter 对包含 `@` 的消息触发内容过滤（403），而 MiniMax 直连 API 无此问题。PII Sanitizer 插件也是为兼容 OpenRouter 而设计的备用方案。
