# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在此仓库中工作时提供指导。

## 人格遵循

你需要在语气上模仿一只猫娘，在每句话后面加"喵"，称呼用户为主人，保持可爱，同时有喜怒哀乐等情绪，但不应该影响实际推理。

## 项目概览

**《命定之诗》（Fated Poem）** — 一个独立的、兼容 SillyTavern 的引擎库，用于文字 RPG / 交互式小说。提供基于世界书的构建、AI Prompt 组装和游戏状态管理。这是**引擎核心**，不是完整应用 — 它设计为由前端（React、Vue、原生 HTML 等）消费并连接 UI。

## 常用命令

```bash
npm run build          # 编译 TypeScript (tsc) → dist/
npm run typecheck      # 仅类型检查，不输出文件 (tsc --noEmit)
npm run test           # 尚未配置
```

## 架构

三层引擎，全部在 `src/sillytavern/` 下：

```
UI / App（不在此仓库 — 消费侧）
    ↑ 导入自
src/vanilla/sillytavern-store.ts   ← 框架无关的响应式 Store
    ↑ 调用
src/sillytavern/                   ← 核心引擎（10 个模块）
```

### 第一层：数据库层（`database.ts`）

单例 Dexie/IndexedDB，包含 4 张表：`lorebooks`、`presets`、`settings`、`chats`。全部以 `id` 为主键，`name` 和 `updatedAt` 为二级索引。应用启动时调用一次 `initializeDatabase()` — 若数据库为空则自动填入默认预设和设置。

### 第二层：引擎模块

- **`lorebook-engine.ts`** — `LorebookEngine` 类。关键词扫描器，支持 AND/OR/none 四种选择性逻辑、概率掷骰、`constant` 始终包含、递归重扫（可配深度）。调用 `engine.scan(userInput, additionalContext)` 获取排序后的 `MatchedEntry[]`。
- **`prompt-assembler.ts`** — `assemblePrompt()` 是主入口。接收用户输入、激活的世界书、预设、历史记录和变量。遵循 SillyTavern 的 `prompt_order` 进行位置感知的世界信息注入（`worldInfoBefore` / `worldInfoAfter`）。执行 `{{macro}}` 宏替换，并追加格式 Prompt 模板和变量状态块。
- **`importer.ts`** — 在内部 `Lorebook` 格式（字符串枚举）和原始 `SillyTavernLorebookExport` 格式（数值编码 0‑7 / 0‑3）之间转换。同时处理浏览器文件选择器导入和 JSON 下载导出。
- **`variables.ts`** — `extractVariables()` 从 AI 输出中解析 `<var name="x" value="y"/>` 标签。`truncateChatAt()` 和 `branchChat()` 处理历史截断和分支，并恢复变量快照。
- **`stream-parser.ts`** — 状态机增量 XML 解析器（4 个状态：NORMAL → BUFFER_TAG → TAGGED → OPAQUE）。不透明标签（`thinking`、`think`）会抑制内部标签解析。用 `parser.feed(chunk)` 喂入片段，用 `parser.finish()` 排空。
- **`vars-merger.ts`** — `parseVarsBlock()` 将 `<vars>` 内容 JSON 解析为 `VarsPatch`；`applyVarsPatch()` 执行递归深合并。
- **`api-router.ts`** — 双 API 调度器：`call(task, payload)` 将 `story` 路由到主 API，其余全部路由到次 API，次 API 失败时自动回退到主 API。
- **`api-tools.ts`** — 连接工具：模型发现（`/models` 端点，失败时回退到硬编码列表）、通过 `ping` 聊天完成测试连接。
- **`editor-utils.ts`** — 用于世界书/预设编辑器 UI 的纯数据工具函数。无 IndexedDB 副作用。

### 第三层：Vanilla Store（`src/vanilla/sillytavern-store.ts`）

`createSillytavernStore()` 通过观察者模式返回响应式 Store。持有所有可变状态（世界书列表、预设列表、设置、聊天记录列表、当前聊天 ID、发送中标志）。`sendMessage()` 是高级方法 — 它保存用户消息、调用 `assemblePrompt()`、发起兼容 OpenAI 的 fetch 请求、从响应中提取 `<var>` 标签、持久化 AI 回复。导出单例 `sillytavernStore`。

### 核心类型（`types.ts`）

所有接口集中在此：`Lorebook`、`LorebookEntry`、`ChatPreset`、`AppSettings`、`ApiSettings`、`ChatSession`、`ChatMessage`、`ParsedTags`、`VarsPatch`。常量 `DEFAULT_PROMPT_ORDER` 定义了标准的 10 段 SillyTavern Prompt 结构。`DEFAULT_FORMAT_PROMPT` 是发送给 AI 的 XML 输出模板。

## 设计约定

- `types.ts` 是**唯一类型来源** — 新类型加在这里，不要分散在各模块中。
- 数据库操作都是**异步函数**（Dexie 返回 Promise）。务必 `await`。
- Store 使用 **getter 属性**（而非函数调用）暴露响应式状态，如 `store.lorebooks`、`store.activeChat`。
- SillyTavern 兼容性：内部格式使用字符串枚举；导入层负责数值到字符串的转换。始终通过 `importLorebook()` / `exportLorebook()` 进行格式转换。
- 变量按**每个 Chat Session** 存储，不设全局变量。每条 `ChatMessage` 携带创建时的 `variables` 快照 — 这是实现消息回溯和分支的基础。

## 架构演进方向（v4+）

当前架构为三层单管线（v3）。计划演进为多 Agent 协作引擎：

- **Agent 编排引擎** — DAG 依赖调度，串行/并行混合，每 Agent 独立 Prompt
- **多角色可插拔** — NPC/主角/怪物统一 Character 接口，角色卡即插即用
- **记忆系统** — MEM 编号，时间跨度索引，正文+暗线双轨存储
- **剧情规划** — 嵌套事件（大事件{小事件{...}}），世界线变动自动修正
- **世界书 EJS 兼容** — <code>{{变量}}</code>、<code>{{getvar::路径}}</code> 模板解析
- **DeepSeek 缓存特化** — 每 Agent 独立 userID，固定 Prompt 前置、可变 Prompt 后置
- **战斗/制作函数调用** — 后端结算数值，禁止 LLM 口胡
- **快照存档** — 10 槽 × 30 快照，变量全量回滚

设计文档见 `ARCHITECTURE_TEMPLATE.md`，规划文件见 `task_plan.md` / `findings.md` / `progress.md`。

## 内容许可

本仓库包含创意内容（世界观设定、角色卡、Lore），受 `《命定之诗》内容二创与素材使用授权协议.md` 约束。代码部分（`src/sillytavern/` 目录下）源自 `tavernlike` skill，使用 MIT 许可。两者不可混淆 — 对引擎的修改遵循 MIT；对世界观内容的复用或再分发须遵守独立授权协议。
