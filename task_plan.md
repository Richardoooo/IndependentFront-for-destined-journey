# Task Plan: 命定之诗 — 多 Agent 游戏引擎架构

## Goal

将《命定之诗》从单管道 SillyTavern 引擎，重构为支持多 Agent 协作、角色可插拔、世界书 EJS 兼容、DeepSeek 缓存优化的文字 RPG 游戏引擎，同时构建三页面前端 UI（首页/捏人/游戏界面）。

## Current Phase

Phase 2

---

## Phases

### Phase 1: 架构设计 & 可行性验证
- [ ] 完整梳理前端需求（页面结构、组件树、数据流）
- [ ] 完整梳理后端需求（Agent 管线、Prompt 模板、缓存策略）
- [ ] 设计 Agent 编排引擎的数据结构（Agent 定义、依赖 DAG、调度器）
- [ ] 评估现有代码复用率，标注改造/新建范围
- [ ] 设计多角色可插拔架构（NPC/主角/怪物统一接口）
- [ ] 设计 EJS 模板兼容方案（世界书动态内容渲染）
- [ ] 设计 DeepSeek 多 userID 缓存隔离方案
- [ ] 写入 findings.md，产出架构决策记录
- **Status:** complete ✅

### Phase 2: 核心数据结构 & 数据库设计
- [ ] 扩展 types.ts：CharacterState（含登神长阶/要素/权能/法则）、AgentConfig、ApiEndpoint、MapTopology、MemoryRecord、PlotEvent、Snapshot、SaveSlot
- [ ] 设计 IndexedDB 新表：memories / plot_events / characters / snapshots / saves / api_endpoints
- [ ] 设计存档系统数据结构（10 档 × 30 快照/档），存档包含完整状态快照
- [ ] 编写数据库迁移脚本（v3 → v4）
- [ ] 新增 AppSettings 字段（apiEndpoints / agentConfigs / agentPipeline / theme / cacheStrategy）
- [ ] 实现 Prompt vs Code 边界：确定性逻辑（战斗/制作/数值）归 code，创造性（叙事/角色/记忆）归 prompt
- **Status:** pending

### Phase 3: Agent 编排引擎
- [ ] 实现 AgentOrchestrator 核心类（DAG 依赖 + 并行/串行混合调度）
- [ ] 实现每 Agent 独立 Prompt 模板系统（前固定后可变）
- [ ] 实现多 userID 缓存隔离（DeepSeek 特化）
- [ ] 实现 Agent 输出验证 & 手动重生成机制
- [ ] 实现流程单向性保证（上游 Agent 输出不可被下游回写）
- **Status:** pending

### Phase 4: 记忆系统 & 剧情规划
- [ ] 实现记忆数据结构（MEM00XXX 编号、时间跨度、正文/暗线）
- [ ] 实现记忆召回 Agent（相关性排序 + 配置召回上限）
- [ ] 实现记忆总结 Agent（每轮结束后写入新记忆）
- [ ] 实现剧情规划数据结构（嵌套事件：大事件{小事件{...}}）
- [ ] 实现剧情初始化（开局生成 + 每年自动生成）
- [ ] 实现剧情运行时判断 & 世界线变动修正
- **Status:** pending

### Phase 5: 角色 & 变量系统
- [ ] 统一角色接口（NPC/主角/怪物共用 Character 类型）
- [ ] 实现角色更新 Agent（并行多角色，每角色独立 Agent 调用）
- [ ] 实现 mvu_update 变量系统（JSON Patch: replace/delta/insert）
- [ ] 实现时间/地点/在场人物/新闻等系统变量自动更新
- [ ] 实现变量快照 & 回滚（保留 15-30 快照/存档）
- **Status:** pending

### Phase 6: 战斗 & 制作工具调用
- [ ] 实现 CombatResolver（d20 掷骰 + 公式计算，禁止 LLM 口胡）
- [ ] 实现 CraftingResolver（材料消耗 + 品质检定 + 成品生成）
- [ ] 实现 Function Calling 接口（OpenAI tools 格式）
- [ ] 实现 <action_info> 面板解析器
- **Status:** pending

### Phase 7: 前端 UI
- [ ] 首页（标题 + 新存档/读取/设置/创意工坊）
- [ ] 捏人页面（参考 v4.2.1 自定义开局脚本）
- [ ] 游戏界面（三栏：左引擎/中对话/**右状态栏+背包+技能+地图拓扑**）
- [ ] 状态栏组件（参考 v4.2.1 状态栏脚本，**位于右侧栏顶部**）
- [ ] 地图拓扑面板（基于 DLC 地理拓扑 + 长途移动数据）
- [ ] API 总控设置页（端点管理 + Agent 配置 + 管线顺序）
- [ ] 世界书 EJS 静态化导入流程
- [ ] 开发服务器（监听端口 + 浏览器访问）
- **Status:** pending

### Phase 8: 集成测试 & 交付
- [ ] 端到端流程测试（开局→多轮对话→回档→读档）
- [ ] DeepSeek 缓存命中率基准测试
- [ ] 角色可插拔性验证（加载不同角色卡）
- [ ] 更新 ARCHITECTURE.md 为完整架构文档
- [ ] 更新 CLAUDE.md 反映新架构
- **Status:** pending

---

## Key Questions

1. 多个 Agent 之间的上下文传递格式？（JSON？共享变量池？）
2. 剧情规划 Agent 与记忆 Agent 输出如何合并后再喂给正文 AI？
3. 并发角色更新的上限？（一次更新 10 个 NPC 还是分批？）
4. 快照的粒度？（全量变量 or 增量 diff？）
5. EJS 模板渲染应该在哪个阶段执行？（世界书导入时 or 每次扫描时？）
6. 输出违规检测器的正则库如何维护和扩展？
7. 前端三页面的状态如何与 Vanilla Store 对接？
8. DeepSeek 的 userID 隔离真的能命中缓存吗？（需要实际测试验证）

## Decisions Made

| 决策 | 理由 |
|------|------|
| 保留 Dexie/IndexedDB 持久化 | 已有成熟框架，本地存储满足需求 |
| 保留 Observer 模式 Store | 框架无关，React/Vue/Vanilla 均可对接 |
| Agent 调度器用 DAG 而非管线 | 支持并行 + 串行混合，扩展性更好 |
| 现有 lorebook-engine 保留但改注入位置 | 关键词匹配逻辑完全可用 |
| 现有 api-router 重构为 Agent 调度器 | 双 API 模型太局限 |

## Errors Encountered

| 错误 | 尝试次数 | 解决方案 |
|------|---------|---------|
| (暂无) | — | — |

## Notes

- 用户强调"先写 plan，别急着开始" — 当前聚焦 Phase 1
- 30% 复用现有代码，70% 新建
- DeepSeek 缓存优化是核心差异化需求
- EJS 兼容需要额外的模板引擎
- CLAUDE.md 需修改以反映多 Agent 架构
