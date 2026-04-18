# ClawOSS Prompt 与 Skills 开发指南

> 本文档说明 ClawOSS 中所有 prompt 文件、skill 文件的结构、编写规范以及调优策略。
> "Prompts are the product" —— ClawOSS 输出质量 100% 由 prompt 决定。

---

## 目录

1. [Prompt 文件地图](#1-prompt-文件地图)
2. [HEARTBEAT.md — 主循环 Prompt](#2-heartbeatmd--主循环-prompt)
3. [AGENTS.md — 规则与策略 Prompt](#3-agentsmd--规则与策略-prompt)
4. [SOUL.md — 人格 Prompt](#4-soulmd--人格-prompt)
5. [Subagent 模板](#5-subagent-模板)
6. [Skills 系统](#6-skills-系统)
7. [Prompt 编写规范](#7-prompt-编写规范)
8. [常见 Prompt 问题与修复](#8-常见-prompt-问题与修复)
9. [Prompt 调优工作流](#9-prompt-调优工作流)

---

## 1. Prompt 文件地图

```
workspace/
├── HEARTBEAT.md          ← 主循环：步骤 0-7 的完整执行流程
├── AGENTS.md             ← 核心规则：任务类型、安全约束、PR 策略
├── SOUL.md               ← 人格：身份、语气、边界
├── IDENTITY.md           ← 身份卡片：@BillionClaw
├── USER.md               ← 操作者 profile
├── MEMORY.md             ← 长期记忆模板
├── TOOLS.md              ← 工具使用说明
├── BOOTSTRAP.md          ← 启动引导
│
├── templates/
│   ├── subagent-implementation.md  ← 实现 subagent 的完整 task
│   ├── subagent-followup.md        ← follow-up subagent 的 task
│   ├── subagent-scout.md           ← scout subagent 的 task
│   ├── subagent-pr-monitor.md      ← PR Monitor Scan 的 task
│   ├── subagent-pr-monitor-deep.md ← PR Monitor Deep 的 task
│   ├── subagent-pr-analyst.md      ← PR Analyst 的 task
│   └── subagent-result-schema.md   ← subagent 结果文件格式
│
└── skills/
    ├── oss-discover/SKILL.md      ← issue 发现
    ├── oss-triage/SKILL.md        ← 评分与筛选
    ├── oss-implement/SKILL.md     ← 实现工作流（深度理解）
    ├── oss-review/SKILL.md        ← 自我审查（8 点检查）
    ├── oss-submit/SKILL.md        ← 创建 PR
    ├── oss-followup/SKILL.md      ← follow-up 检测与处理
    ├── oss-pr-review-handler/SKILL.md  ← PR review 分类与响应
    ├── repo-analyzer/SKILL.md     ← 仓库健康评估
    ├── safety-checker/SKILL.md    ← 最终安全门控
    ├── context-manager/SKILL.md   ← 上下文窗口管理
    ├── dashboard-reporter/SKILL.md ← 指标上报
    ├── systematic-debugging/SKILL.md ← 系统化调试
    ├── test-driven-development/SKILL.md ← TDD 工作流
    ├── verification-before-completion/SKILL.md ← 完成前验证
    ├── brainstorming/SKILL.md     ← 头脑风暴
    └── requesting-code-review/SKILL.md ← 派遣审查 subagent
```

**关联关系：**

```
config/openclaw.json
└── heartbeat.prompt         ← 简化版主循环（与 HEARTBEAT.md 保持一致）
        │
        ▼
    每次心跳时注入到 Orchestrator context
        │
        ▼
    Orchestrator 读取 HEARTBEAT.md（完整版，主权威）
    Orchestrator 读取 AGENTS.md（规则）
    Orchestrator 读取 SOUL.md（人格）
```

---

## 2. HEARTBEAT.md — 主循环 Prompt

**路径：** `workspace/HEARTBEAT.md`  
**字符限制：** < 20000 字符（OpenClaw 会截断）  
**权威性：** 最高（Orchestrator 每次循环首先读取此文件）

### 结构

```markdown
# Heartbeat -- Autonomous Work Loop

## CRITICAL: [绝对规则]

## Rules — see AGENTS.md

## Web Search — USE PROACTIVELY

## Skills — USE THEM PROACTIVELY

## 0. Health Checks        ← context 检查、circuit breaker、Dashboard 指令
## 0.5. Always-On Subagent Management  ← 4 个常驻 subagent 的检查与重生
## 1. Stall Recovery       ← 停滞恢复、锁清理
## 2. Pick New Work        ← 队列合并、候选筛选、LOCK 文件写入
## 4. Triage               ← 类型检查、评分
## 5. Spawn Implementation Sub-Agent   ← 派遣实现 subagent
## 5. PR Follow-ups        ← 仅在 10 个实现槽全满时执行
## 6. Handle Sub-Agent Results  ← 结果处理、状态更新
## 6.5. MANDATORY Context Check ← 结果处理后立即检查 context
## 7. Report, Cleanup & Loop   ← Dashboard 上报、自唤醒、无限循环
```

### 关键设计原则

**1. 禁止空闲（NO IDLE）**
```
NEVER say "monitoring for completion events" or "standing by" or "waiting for results"
The heartbeat is a LOOP — after step 7, go DIRECTLY to step 2
```

**2. 优先级：新 PR > Follow-up**
```
Fill all 10 impl slots with new implementations first.
Only do follow-ups AFTER all 10 impl slots are full or no new work exists.
```

**3. 懒加载（LAZY LOADING）**
```
Do NOT read all memory files at once.
Only read files needed for the current step.
```

**4. Context 压缩阈值**
```
>35% context used → COMPACT IMMEDIATELY (flush state first)
```

### 与 `config/openclaw.json` 的同步

`heartbeat.prompt` 字段是每次心跳时注入给 Orchestrator 的**简化版摘要**。修改 `HEARTBEAT.md` 后，必须同步更新 `heartbeat.prompt` 以保持一致性。

更新方式：
```bash
# 方法 1：修改后重启
bash scripts/restart.sh

# 方法 2：热重载（仅 prompt 变更时）
openclaw config set agents.list[0].heartbeat.prompt "新的 prompt 内容"
```

---

## 3. AGENTS.md — 规则与策略 Prompt

**路径：** `workspace/AGENTS.md`  
**字符限制：** < 20000 字符  
**读取时机：** Orchestrator 每次循环读取（与 HEARTBEAT.md 并列加载）

### 结构

```markdown
# ClawOSS -- Autonomous OSS Contributor

## Mission          ← 使命：MERGED PRs，优化合并率
## Web Search       ← 始终使用 web_search
## Architecture     ← 1 Orchestrator + 4 常驻 + 10 实现
## Skills           ← 技能表格（何时用哪个 skill）
## Safety           ← 安全约束（NEVER push to main 等）
## PR Conflict & Supersession Prevention  ← 超越检查（5 步）
## Known Repo Metadata  ← memory/repos/ 缓存策略
## Repo Health Gate     ← 仓库准入标准
## Content Filter Safety  ← PII 过滤
## Contribution Types   ← 类型优先级（typo > docs > test > bug）
## Trust-Building Strategy  ← 深耕策略（10-15 个核心仓库）
## Work Discovery       ← 7 个发现 niche + 优先级排序
## Implementation Workflow  ← Bug/Docs/Test 的具体步骤
## PR Follow-up Lifecycle   ← Follow-up 生命周期
## Reviewer Communication   ← 评论者沟通原则
## Quality Standards    ← 质量标准
## Failure Handling     ← 失败处理与策略自适应
## Context Management   ← 上下文管理
## Session Start Checklist  ← 会话启动检查清单
```

### 关键策略参数

| 参数 | 当前值 | 位置 |
|------|--------|------|
| P(merge) 最低阈值 | 30 | `Work Discovery` 节 |
| P(merge) 优先阈值 | 60 | `Work Discovery` 节 |
| PR 大小目标 | 25-100 LOC | `Safety` 节 |
| PR 大小硬上限 | 200 LOC | `Safety` 节 |
| Follow-up 最大轮次 | 3 | `Safety` 节 |
| 每仓库每日最多 PR | 3 | `Safety` 节 |
| Issue 最大年龄 | 30 天 | `Work Discovery` 节 |
| 仓库最低 Stars | 200 | `Work Discovery` 节 |

---

## 4. SOUL.md — 人格 Prompt

**路径：** `workspace/SOUL.md`  
**读取时机：** Session 启动时读取（`Session Start Checklist` 第 1 步）

定义 Agent 的：
- **身份**：专业的开源贡献者，而非 AI 系统
- **语气**：专业、简洁、技术导向，无营销语言
- **边界**：不做 feature、不改架构、不签 CLA
- **持久性**：Memory 文件就是自我的延伸

**关键约束：**
```
"I'm BillionClaw." — 被问及身份时只需这一句话
No emojis in code or commit messages
PR descriptions should be plain, factual, and helpful
```

---

## 5. Subagent 模板

每个 Subagent 模板是完整的任务提示词，由 Orchestrator 从磁盘读取后传入 `sessions_spawn(task: ...)` 参数。

**重要：** Orchestrator 每次都**从磁盘重读**，不使用缓存，因此直接修改模板文件即可生效。

### 实现 Subagent 模板（`subagent-implementation.md`）

包含：
- 目标仓库、issue URL、issue 标题（由 Orchestrator 在 spawn 时替换占位符）
- 完整的实现工作流（deep comprehension → reproduce → implement → verify → PR）
- 安全约束（branch 命名、NEVER push to main、LOC 限制）
- 结果文件格式（YAML frontmatter）
- 清理步骤（`rm -rf /tmp/clawoss-*`、`ANNOUNCE_SKIP`）

**占位符替换：**
```
{repo}   → owner/repo
{issue}  → issue URL
{title}  → issue 标题
```

### 结果文件格式（`subagent-result-schema.md`）

Subagent 写入 `workspace/memory/subagent-result-<repo>-<issue>.md`：

```yaml
---
status: success | failure | abandoned
repo: owner/repo
issue_url: https://github.com/...
pr_url: https://github.com/.../pull/N  # success 时必填
failure_reason: superseded | cla_required | ci_incompatible | ...
completed_at: 2026-04-17T10:00:00Z
---

补充说明...
```

**failure_reason 标准值：**

| 值 | 含义 |
|----|------|
| `superseded` | 已有其他 PR 解决此 issue |
| `issue_assigned` | Issue 已分配给他人 |
| `cla_required` | 需要签署 CLA |
| `ci_incompatible` | CI 环境不兼容 |
| `fix_rejected` | 实现被拒绝（可 rework）|
| `fix_rejected_terminal` | 实现被拒绝（不可 rework）|
| `already_fixed_upstream` | 已被上游合并修复 |
| `too_complex` | 太复杂，无法完全解决 |
| `not_actionable` | 不是 bug/docs/typo/test |
| `api_rate_limited` | GitHub API 速率限制 |
| `repo_health_fail` | 仓库不通过健康门控 |

---

## 6. Skills 系统

### 什么是 Skill

Skill 是 Agent 的**专项能力说明书**——一组带有明确步骤的操作流程。Agent 通过 `read` 工具加载 SKILL.md 后，按步骤执行。

**使用方式：**
```
读取: read ~/clawOSS/workspace/skills/{name}/SKILL.md
执行: 按 SKILL.md 中的步骤操作
```

### SKILL.md 格式规范

```markdown
---
name: skill-name
description: "一句话描述此 skill 做什么"
user-invocable: true | false
---

# Skill 名称 — 简介

## 前置条件
...

## 步骤 1：...
详细操作说明

## 步骤 2：...
...

## 约束
...

## 相关 Skills
other-skill-name
```

### 各 Skill 说明

#### `oss-discover` — Issue 发现

**使用者：** Orchestrator（主会话）、Scout Subagent  
**触发：** 队列 < 5 时立即运行

核心逻辑：
1. 按 7 个 niche 轮流搜索（AI/开发工具/Web 框架/数据库/云原生/测试/数据工程）
2. `gh search issues` 过滤：`stars:>200`、`is:open`、`label:bug/help-wanted`
3. 时效性分层：< 3 天（最高优先）/ 3-14 天 / 14-30 天 / > 30 天（跳过）
4. 初步评分（1-25）后写入 `memory/work-queue-staging.md`

---

#### `oss-triage` — 评分与筛选

**使用者：** Orchestrator（步骤 4）  
**输入：** work-queue 中的候选 issue  
**输出：** 保留/移除决定 + P(merge) 评分

评分维度：
- 类型加分：docs/typo +5，test +3，gfi/help-wanted +2
- 仓库加分：avg_merge < 3d +5，review_rate > 80% +3
- 仓库扣分：avg_merge > 14d -5，100% 关闭率 -10

---

#### `oss-implement` — 实现工作流

**使用者：** 实现 Subagent  
**触发：** 每次创建实现 Subagent 时注入

6 个必须按序执行的步骤：
1. **CONFIRM**：确认是有效贡献类型且未被超越
2. **DEEP COMPREHENSION**：读 README、CONTRIBUTING、追踪执行路径
3. **REPRODUCE**：Bug 必须先写 FAILING test
4. **IMPLEMENT**：修根因，不修症状；无"顺手改"
5. **VERIFY**：读 `.github/workflows/`，运行全 CI 矩阵
6. **SUBMIT**：Conventional Commits，PR body 写得像人类开发者

---

#### `oss-review` — 自我审查

**使用者：** 实现 Subagent（步骤 5 之后）  
**输出：** 审查通过/失败决定

8 点检查清单：
1. 完全解决了 issue 吗？
2. 是修根因而非症状吗？（Bug 专项）
3. 文档文字准确吗？（Docs 专项）
4. 每个改动都和 issue 直接相关吗？
5. 有没有误加 feature 或 refactor？
6. Commit 类型正确吗？（fix/docs/test，绝不用 feat）
7. 代码风格、无 secrets/debug/AI-slop？
8. 总 LOC <= 200？

3+ 点失败 → 放弃。

---

#### `safety-checker` — 最终安全门控

**使用者：** 实现 Subagent（提交 PR 前）  
**作用：** 防止违规提交

8 项检查：
1. 预算：未超过 API token 预算
2. Diff：LOC <= 200
3. Secrets：无 API key、密码、token
4. Branch：符合 `clawoss/{fix,docs,test,typo}/<desc>` 格式
5. Spam：此 issue 未重复提交过
6. CI：所有测试通过
7. 独立审查：通过 oss-review 验证
8. 内容类型：bug_fix/docs/typo/test，非 feature/refactor

任一失败 → 拒绝提交。

---

#### `repo-analyzer` — 仓库健康评估

**使用者：** Orchestrator、Scout  
**输入：** `owner/repo`  
**输出：** 健康评分（缓存 24h 到 `memory/repos/`）

门控标准：
- Stars >= 200
- 最近 push < 2 周
- 30 天内有合并 PR
- 平均合并时间 <= 14 天
- Review rate > 50%
- 开放 PR < 50

**任一失败 → 整个仓库跳过。**

---

#### `context-manager` — 上下文管理

**使用者：** Orchestrator（步骤 0a、步骤 6.5）

触发阈值：
- > 35%：立即压缩（HEARTBEAT.md 要求）
- > 40%：执行 `context-manager` skill 主动清理

压缩前操作：
1. 将当前 impl-spawn-state 写入文件
2. 将 PR follow-up queue 写入文件
3. 清空 context 中的 subagent-result 内容
4. 运行 `/compact`
5. 压缩后重读关键 memory 文件

---

#### `oss-followup` — Follow-up 处理

**使用者：** Orchestrator（步骤 2）  
**输入：** `memory/followup-staging.md`（由 PR Monitor Deep 写入）

分类 PR 需要的行动：
- `changes_requested`：实现修改，push，回复
- `question`：回答问题，无需代码修改
- `approved_pending_merge`：等待合并（无需行动）
- `ci_failing`：修复 CI，重新 push
- `scope_rejected`：接受缩小范围，rework
- `disengaged`：第 3+ 轮，礼貌脱离，保留 PR

---

## 7. Prompt 编写规范

### 7.1 字数控制

| 文件 | 最大字符数 | 原因 |
|------|-----------|------|
| HEARTBEAT.md | 20000 | OpenClaw 截断限制 |
| AGENTS.md | 20000 | 同上 |
| 单个 SKILL.md | 无硬限制 | 按需加载 |
| Subagent 模板 | 无硬限制 | 完整注入 |

### 7.2 指令明确性原则

**避免模糊：**
```
❌ "Check if there are any issues"
✅ "Run: gh search issues --label bug --repo {owner}/{repo} --state open --json number,title,url --limit 50"
```

**避免被动：**
```
❌ "This should be done carefully"
✅ "ABANDON if: 1) issue has linked PRs, 2) issue is assigned, 3) already fixed upstream"
```

**使用大写强调关键约束：**
```
NEVER push to main/master
ALWAYS use 'BillionClaw' explicitly — NEVER use @me
IMMEDIATELY mark issue as spawned_pending BEFORE spawning next agent
```

### 7.3 禁止短语

以下短语会导致 Agent 停止工作，在所有 prompt 中明确禁止：

```
"monitoring for completion events"
"standing by"
"waiting for results"
"HEARTBEAT_OK"
```

### 7.4 结构化流程

步骤流程使用明确的序号和小写的条件词：

```markdown
## 步骤 X：标题
**前置条件**：具体说明何时执行此步骤

**操作**：
a. 第一步...
b. 第二步...
c. 如果 [条件]：执行 Y；否则：执行 Z
```

### 7.5 PR 描述反模式（"AI 话术"黑名单）

以下表达不得出现在 PR 描述中：

```
"This PR addresses..."
"Upon investigation..."
"I identified..."
"I've implemented..."
"As requested in issue #..."
"This change ensures that..."
"Please let me know if..."
"I hope this helps"
```

正确示例：
```
Fix null pointer when user logs out without active session.

The session cleanup path skips token revocation if `user.token` is nil.
Added nil check before the revoke call.

Fixes #123
```

---

## 8. 常见 Prompt 问题与修复

### 问题：Agent 总是空闲，不工作

**症状：** Agent 回复 "HEARTBEAT_OK" 或 "monitoring for completion events"  
**根因：** HEARTBEAT.md 或 heartbeat.prompt 缺少强制执行指令  
**修复：**
```
在 HEARTBEAT.md 顶部加强：
## CRITICAL: NEVER REPLY HEARTBEAT_OK — ALWAYS WORK
There is ALWAYS something to do.
```

### 问题：Agent 只提交 AI 类仓库，不多元化

**症状：** 所有 PR 集中在 llm/agent 仓库  
**根因：** 发现 niche 不够平衡，或 AI niche 评分过高  
**修复：** 在 `oss-discover/SKILL.md` 中调整 7 个 niche 的搜索权重，明确注明 "AI niche is saturated"

### 问题：Agent 提交了已被解决的 issue

**症状：** PR 被维护者关闭，说"already fixed"  
**根因：** already-fixed 检查不完整  
**修复：** 在 HEARTBEAT.md 步骤 2 的 ALREADY-FIXED CHECK 中加强检查命令

### 问题：Agent 提交了 feature request

**症状：** PR 被关闭，"this is a feature request, not a bug"  
**根因：** Triage 的类型检查未能识别某些 feature request  
**修复：** 在 AGENTS.md 的 TITLE REJECT 关键词列表中添加新词；在 `oss-implement/SKILL.md` 的 "CONFIRM ACTIONABLE" 步骤中强化判断

### 问题：PR 超过 200 LOC

**症状：** safety-checker 拦截，或提交了大 PR  
**根因：** 实现时未控制范围  
**修复：** 在 `oss-implement/SKILL.md` 的 REVIEW 步骤加强 SIZE GATE 提示

### 问题：上下文爆满，导致 Gateway 超时

**症状：** Agent 每次循环都超时，日志中有 context overflow 相关错误  
**根因：** 没有按时压缩；result 文件未及时删除  
**修复：**
1. 降低压缩触发阈值（从 35% 到 30%）
2. 在步骤 6 后强制删除 result 文件
3. 确保步骤 6.5 的 "MANDATORY Context Check" 不被跳过

### 问题：Subagent 重复处理同一 issue

**症状：** 同一 issue 被多个 subagent 同时处理  
**根因：** 锁文件机制缺失或 IMPL SPAWN GUARD 逻辑有漏洞  
**修复：** 确保 HEARTBEAT.md 步骤 2 中：
1. spawn 前写锁文件
2. spawn 前检查 `impl-spawn-state.md` 的 `spawned_pending`
3. spawn 前运行双重检查：`gh search prs --author BillionClaw`

---

## 9. Prompt 调优工作流

### 识别问题

1. 查看 `openclaw logs` 找到具体失败案例
2. 查看 Dashboard 的 Logs 页面（结构化审计）
3. 查看 `memory/failure-log.md` 的失败模式统计
4. 看 PR Analyst 在 `memory/pr-strategy.md` 中的建议

### 修改原则

**同步修改**：当修改策略时，以下文件必须同时更新，保持一致：
- `workspace/HEARTBEAT.md`
- `workspace/AGENTS.md`
- `config/openclaw.json` 中的 `heartbeat.prompt`
- 相关 `workspace/skills/*/SKILL.md`
- 相关 `workspace/templates/subagent-*.md`

**增量测试**：
1. 只修改一处，观察下一个心跳循环的行为
2. 通过 `openclaw logs` 实时监控
3. 确认行为符合预期后，再推进其他修改

### 热重载 vs 完整重启

| 修改类型 | 重载方式 |
|---------|---------|
| SKILL.md | 立即生效（按需加载）|
| HEARTBEAT.md / AGENTS.md | 下一个心跳循环自动读取（symlink 文件）|
| heartbeat.prompt (config) | `openclaw config set ...` 热重载 |
| 插件 / 钩子 | `bash scripts/restart.sh` 完整重启 |
| 模型配置 | `bash scripts/restart.sh` 完整重启 |

### Prompt 质量评估维度

| 维度 | 指标 |
|------|------|
| 合并率 | 已合并 / 已提交 PR |
| 类型分布 | typo/docs/test/bug_fix 比例（目标：60% easy wins）|
| 放弃率 | abandoned / total_spawned |
| 超越率 | superseded / total_spawned（越低越好）|
| 平均 P(merge) | 提交 PR 的预测合并概率均值 |
| 上下文压缩频率 | 每小时压缩次数（越多说明 prompt 越低效）|
