# Retention Core Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可试玩的前 30 分钟留存循环，把 30 层终点改成可持续深潜、法则选择、自主重铸和随深度增长的炉心收益。

**Architecture:** 保留现有原生 JavaScript 状态机与静态页面，新增独立的深度/法则定义模块，让 `src/game.js` 负责运行态结算、`src/app.js` 负责即时渲染。先用存档迁移建立连续深度模型，再依次接入渐进自动化、守卫决策、区段法则和收益公式，最后以确定性新存档模拟校准时间估算。

**Tech Stack:** 原生 ES Modules、HTML、CSS、Node.js `node:test`，不新增运行时依赖。

**Spec:** `docs/superpowers/specs/2026-09-29-retention-endless-progression-design.md`

## Global Constraints

- 所有秒数、分钟数和小时数仅是标准策略的累计游玩时长估算，不得成为真实时间解锁门槛。
- 解锁只依赖资源、深度、守卫、成就、构筑或其他可操作进度。
- 不使用固定等待计时器校准节奏，主动操作和优秀构筑允许更快完成。
- 深度、伤害、资源、奖励和序列化结果必须始终为有限数。
- 守卫死亡后的同一攻击批次不能穿透到下一层。
- 不新增服务端、账号、排行榜、付费系统或任意精度依赖。
- 保留旧存档的研究、科技、炉心协议、试炼、模块和永久守卫成果。
- 不修改 `.env`、密钥、证书、CI/CD 或部署配置。
- 不自动 commit 或 push；只有用户明确说“可以推送”后才展示摘要并执行提交。

## Scope Decomposition

本计划只实现规格中的第一条完整可玩纵切：

- 前 5 分钟主动节奏与脉冲无人机；
- 5～30 分钟渐进自动化；
- 30 层后的无尽区段；
- 守卫后继续/重铸决策；
- 三选一区段法则；
- 随深度、风险和连胜增长的炉心收益；
- 对应界面、存档迁移与平衡模拟。
- 第一套构筑预设。

以下内容分别进入后续计划，本计划只预留兼容状态，不做空壳界面：

- 成就、图鉴、隐藏内容与多目标系统；
- 离线结算弹窗、每日复燃和视觉/音效完整反馈；
- 第二层转生“法则改写”及三条天赋路线。

## Review Focus

- 旧存档停在 `awaitingReforge` 时，迁移后应进入可继续或重铸的决策态，而不是丢失永久进度或自动前进。
- 高多重攻击、共振附伤和技能同帧击杀守卫时，只结算一名守卫且只生成一次法则选择。
- 玩家在守卫结算界面连续点击继续、重铸或法则按钮时，不得重复领取奖励或生成两个区段。
- 极端深度与风险倍率必须保持有限，序列化后重新读取仍能继续深潜。
- 移动端在单屏内能够查看三项法则、当前收益并选择继续或重铸，不需要滚动到页面底部。

---

### Task 1: 连续深度模型与旧存档迁移

**Files:**
- Create: `src/progression.js`
- Modify: `src/game.js`
- Modify: `tests/game.test.js`

**Interfaces:**
- Produces: `DEPTHS_PER_SECTOR = 10`、`FIRST_GUARDIAN_DEPTH = 30`、`getDepthRegion(depth)`、`getDepthNode(depth)`、`isGuardianDepth(depth)`、`getDepthHealthScale(depth)`。
- Produces: `src/game.js` 内部 `createDepthEnemy(depth, modifiers)` 与 `createDepthGuardian(depth, guardianLevel, modifiers)`；它们消费上述纯函数和现有区域/守卫定义，避免模块循环依赖。
- Produces: `state.depth`、`state.bestDepth`；旧 `region/node/highestNode` 字段在迁移期继续同步，避免旧 UI 和存档立即失效。
- Consumes: 现有 `finiteValue` 语义、区域与守卫定义、`serializeGame()`、`deserializeGame()`。

- [ ] **Step 1: 写连续深度失败测试**

  在 `tests/game.test.js` 增加：
  - 新存档 `depth === 1`、`bestDepth === 1`；
  - 深度 1～30 映射到现有三个区域，31 以后循环生成主题节点且生命有限；
  - 深度 30、40、50 均生成守卫边界；
  - 深度 10,000 的普通敌人与守卫生命满足 `Number.isFinite`。

- [ ] **Step 2: 运行定向测试确认失败**

  Run: `node --test --test-name-pattern "continuous depth|depth mapping|extreme depth" tests/game.test.js`

  Expected: FAIL，当前状态没有连续深度且 30 层后只有 `node = 11`。

- [ ] **Step 3: 创建 `src/progression.js` 的纯深度接口**

  实现本任务 Interfaces 中列出的深度常量、映射与缩放函数。深度必须是正整数；生命缩放使用分段增长并统一收敛到安全有限上限。不要复制区域/守卫定义，也不要在该模块读写 DOM 或 localStorage。

- [ ] **Step 4: 在 `createGameState()` 和推进逻辑中同步深度字段**

  普通节点死亡增加 `depth`，并同步兼容字段；`bestDepth` 只增不减。此步骤只建立模型，不改变守卫后的强制停止语义。

- [ ] **Step 5: 写旧存档迁移失败测试**

  覆盖：
  - 无 `depth` 字段的区域 3/节点 11 存档迁移到深度 30；
  - 旧 `awaitingReforge` 存档保留研究、科技、炉心协议和试炼；
  - 非有限敌人按迁移后的当前深度修复。

- [ ] **Step 6: 实现迁移并运行 Task 1 全部测试**

  Run: `node --test tests/game.test.js`

  Expected: PASS。

- [ ] **Step 7: 记录任务完成，不提交**

  根据仓库规则记录测试结果；没有用户明确推送授权时不得 `git commit` 或 `git push`。

---

### Task 2: 前 5 分钟主动节奏与脉冲无人机

**Files:**
- Modify: `src/game.js`
- Modify: `src/app.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `tests/game.test.js`
- Modify: `tests/app-interaction.test.js`
- Create: `tests/opening-pacing.test.js`

**Interfaces:**
- Produces: `state.unlocked.autoAttack: boolean`；新存档自动攻击关闭，达到可操作进度里程碑后解锁。
- Produces: `getAutomationGoal(state)`，返回 `{ id, label, current, target, unlocked }`，供界面展示进度。
- Consumes: Task 1 的 `state.depth/bestDepth`、现有 `manualAttack()`、`advanceGame()` 和升级系统。

- [ ] **Step 1: 写新存档主动阶段失败测试**

  断言新存档推进游戏时间不会自动攻击；主动脉冲仍造成伤害、获得熵晶并可购买升级。解锁条件只读取游戏进度，不读取 `activeSeconds` 或系统时间。

- [ ] **Step 2: 写确定性开局节奏模拟**

  `tests/opening-pacing.test.js` 使用每 0.5 秒一次有效主动脉冲和最低价购买策略，记录：
  - 第一次升级反馈估算不晚于 15 秒；
  - 第二类升级解锁估算不晚于 30 秒；
  - 第一次攻击 ×2 里程碑估算不晚于 120 秒；
  - 脉冲无人机在标准策略约 3～5 分钟对应的可操作进度解锁；
  - 同样进度即使使用不同时间步长也在相同节点解锁无人机。

- [ ] **Step 3: 运行开局测试确认失败**

  Run: `node --test tests/opening-pacing.test.js`

  Expected: FAIL，当前新存档从第一秒就自动攻击。

- [ ] **Step 4: 实现渐进自动攻击**

  `advanceGame()` 仅在 `state.unlocked.autoAttack` 后累积自动攻击。脉冲无人机在 `bestDepth >= 12` 时解锁，不读取 `activeSeconds` 或系统时间；Step 2 只通过调整开局生命、奖励和成本，让标准策略到达深度 12 的估算落入 3～5 分钟。

- [ ] **Step 5: 增加无人机进度与解锁反馈**

  战斗区显示“脉冲无人机”进度；解锁时产生一次明显事件和短动画。移动端不得增加额外页面滚动。

- [ ] **Step 6: 运行 Task 2 测试**

  Run: `node --test tests/opening-pacing.test.js tests/game.test.js tests/app-interaction.test.js tests/ui.test.js`

  Expected: PASS，且没有基于真实时间的解锁分支。

- [ ] **Step 7: 记录任务完成，不提交**

---

### Task 3: 守卫决策态与无尽区段

**Files:**
- Modify: `src/game.js`
- Modify: `src/progression.js`
- Modify: `tests/game.test.js`
- Modify: `tests/progression.test.js`

**Interfaces:**
- Produces: `state.run.awaitingDecision: boolean`、`state.run.guardiansDefeated: number`、`state.run.lockedCoreGain: number`。
- Produces: `continueDeepDive(state, lawId = null)`，仅在合法决策态成功，返回 `{ continued, reason? }`；Task 3 的 `null` 仅代表尚未接入法则的基线区段。
- Consumes: Task 1 的深度生成函数；兼容读取旧 `run.awaitingReforge`，新逻辑不再把守卫胜利视为本轮终点。

- [ ] **Step 1: 写守卫后继续失败测试**

  覆盖：
  - 深度 30 守卫死亡后进入 `awaitingDecision`，攻击、技能和同批多重攻击均停止；
  - 决策态可以直接重铸，也可以继续到深度 31；
  - 继续后深度 40、50 再次出现守卫；
  - 连续点击继续只成功一次；
  - 同一攻击批次最多增加一次守卫和研究进度。

- [ ] **Step 2: 运行测试确认失败**

  Run: `node --test --test-name-pattern "guardian decision|continue deep dive|one guardian per batch" tests/game.test.js`

  Expected: FAIL，当前守卫死亡只允许重铸。

- [ ] **Step 3: 将守卫胜利改为决策态**

  守卫奖励结算一次后保留败北目标展示，设置 `awaitingDecision` 并锁定当前收益。所有攻击入口在决策态返回，不生成下一敌人。

- [ ] **Step 4: 实现 `continueDeepDive(state, lawId)` 的状态转换**

  本任务暂时允许使用默认无修正法则 ID；Task 4 接入真实候选。成功后生成深度 +1 的普通节点并清除决策态，失败不得修改状态。

- [ ] **Step 5: 更新试炼进度语义**

  每名守卫仍只增加一点试炼连续进度；同一轮深潜可完成多名守卫，但重铸继续保留尚未完成的试炼进度。

- [ ] **Step 6: 运行 Task 3 全部测试**

  Run: `node --test tests/game.test.js tests/progression.test.js`

  Expected: PASS。

- [ ] **Step 7: 记录任务完成，不提交**

---

### Task 4: 三选一区段法则

**Files:**
- Modify: `src/progression.js`
- Modify: `src/game.js`
- Modify: `tests/game.test.js`

**Interfaces:**
- Produces: `SECTOR_LAW_DEFINITIONS`，首批包含 `massCollapse`、`silenceProtocol`、`absoluteSequence`、`mirrorCircuit`、`entropyAdaptation`。
- Produces: `getSectorLawChoices(depth)`，确定性返回三个不重复 ID；`getSectorModifiers(state)` 返回生命、炉心、主动、攻速、暴击、研究与模块修正。
- Produces: `state.run.lawChoices: string[]`、`state.run.currentLaw: string | null`、`state.run.riskProduct: number`。
- Consumes: Task 3 的 `continueDeepDive(state, lawId)`。

- [ ] **Step 1: 写法则候选与选择失败测试**

  断言每次守卫胜利提供三个已知且不重复的候选；只能选择候选之一；选择后限制持续到下一名守卫；无效 ID 和重复点击不改变深度、收益或风险乘积。

- [ ] **Step 2: 写五种法则行为失败测试**

  每种法则至少验证一个构筑变化和一个额外收益：生命、技能禁用、攻速限制、镜面相位或伤害来源适应；所有倍率有限。

- [ ] **Step 3: 运行测试确认失败**

  Run: `node --test --test-name-pattern "sector law|law choice|risk multiplier" tests/game.test.js`

  Expected: FAIL，当前没有区段法则状态。

- [ ] **Step 4: 实现纯法则定义和修正聚合**

  候选顺序由深度确定，存档重载后不得无故变化。法则定义只包含数据；具体战斗分支继续由 `src/game.js` 执行。

- [ ] **Step 5: 接入继续深潜与战斗结算**

  `continueDeepDive` 从本任务开始不再接受 `null` 基线路径，必须验证 law ID、累乘有限风险收益、设置当前法则并生成下一层。守卫胜利后清除当前法则并生成新候选。

- [ ] **Step 6: 运行 Task 4 全部测试**

  Run: `node --test tests/game.test.js`

  Expected: PASS。

- [ ] **Step 7: 记录任务完成，不提交**

---

### Task 5: 深度、连胜与风险驱动的炉心收益

**Files:**
- Modify: `src/progression.js`
- Modify: `src/game.js`
- Modify: `tests/game.test.js`
- Modify: `tests/progression.test.js`

**Interfaces:**
- Produces: `getReforgeGainBreakdown(state)`，返回 `{ checkpoint, depthReward, streakMultiplier, riskMultiplier, protocolMultiplier, total }`。
- 保留: `getReforgeGain(state)`，返回 breakdown 的 `total`，避免 UI 与旧调用方同时迁移。
- Consumes: Task 3 的 `bestDepth/guardiansDefeated/lockedCoreGain` 与 Task 4 的 `riskProduct`。

- [ ] **Step 1: 写收益公式失败测试**

  使用规格参考值断言无风险基础收益：深度 30 = 12、40 = 19、50 = 32、60 = 53，允许 `Math.floor` 后的整数误差以规格公式为准；深度严格增加时收益不能降低。

- [ ] **Step 2: 写风险与连胜失败测试**

  同深度下，高风险与更多守卫连胜必须提高收益；连胜倍率最高 2.5；所有极端输入保持有限；深度 30 立即重铸仍获得合理收益。

- [ ] **Step 3: 运行测试确认失败**

  Run: `node --test --test-name-pattern "reforge gain breakdown|depth reward|streak reward" tests/game.test.js`

  Expected: FAIL，当前收益主要由固定节点和单名守卫组成。

- [ ] **Step 4: 实现收益拆解与锁定语义**

  根据规格公式计算，并确保已击败守卫锁定的收益不会因为下一段卡关而丢失。重铸消费一次收益；重复调用同一旧状态不得在 UI 事件中重复兑现。

- [ ] **Step 5: 更新重铸与永久协议节奏模拟**

  `tests/progression.test.js` 模拟不同深度结算，断言高层收益可以在合理深潜轮数内购买主要协议；禁止以真实运行时间作为公式输入。

- [ ] **Step 6: 运行 Task 5 全部测试**

  Run: `node --test tests/game.test.js tests/progression.test.js`

  Expected: PASS。

- [ ] **Step 7: 记录任务完成，不提交**

---

### Task 6: 守卫结算、法则选择与移动端界面

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/app.js`
- Modify: `tests/ui.test.js`
- Modify: `tests/app-interaction.test.js`

**Interfaces:**
- Consumes: `state.run.awaitingDecision/lawChoices/currentLaw/guardiansDefeated`、`continueDeepDive()`、`SECTOR_LAW_DEFINITIONS`、`getReforgeGainBreakdown()`。
- Produces: 守卫结算覆盖层；三个法则卡片；“继续深潜”和“立即重铸”操作；收益拆解展示。

- [ ] **Step 1: 写结构与交互失败测试**

  覆盖：
  - 守卫结算层显示当前深度、守卫连胜、立即收益、下一里程碑；
  - 三个法则按钮显示限制和倍率；
  - 未选法则不能继续；
  - 选择并继续后界面立即回到战斗；
  - 立即重铸只打开一次确认流程；
  - 移动端覆盖层高度受视口约束，操作按钮始终可见。

- [ ] **Step 2: 运行 UI 测试确认失败**

  Run: `node --test tests/ui.test.js tests/app-interaction.test.js`

  Expected: FAIL，当前 UI 只显示等待重铸。

- [ ] **Step 3: 实现守卫结算覆盖层**

  使用现有页面结构内的覆盖层，不新增需要整页滚动的面板。法则选择必须有选中态、键盘焦点和禁用态。

- [ ] **Step 4: 更新战斗、目标和炉心信息**

  战斗区显示全局深度和当前法则；目标区显示下一守卫或当前选择；重铸区域显示收益拆解和下一深度收益预估。

- [ ] **Step 5: 移除旧强制终点文案**

  删除 `RUN COMPLETE // 等待重铸` 等把 30 层描述为终点的文案；决策态改为“守卫已击破 // 选择下一法则或重铸”。

- [ ] **Step 6: 运行 Task 6 全部测试**

  Run: `node --test tests/ui.test.js tests/app-interaction.test.js tests/game.test.js`

  Expected: PASS。

- [ ] **Step 7: 记录任务完成，不提交**

---

### Task 7: 渐进自动化与前 30 分钟构筑选择

**Files:**
- Modify: `src/game.js`
- Modify: `src/app.js`
- Modify: `tests/game.test.js`
- Modify: `tests/opening-pacing.test.js`
- Modify: `tests/progression.test.js`

**Interfaces:**
- Produces: 自动攻击、自动购买和自动技能三个独立解锁层级；现有设置只在对应层级解锁后生效。
- Produces: 自动购买优先级的最小版本 `state.settings.autoBuyPriority: 'cheapest' | 'damage' | 'economy'`。
- Produces: 单槽构筑预设 `state.buildPresets[0]`、`saveBuildPreset(state, 0)`、`loadBuildPreset(state, 0)`，只保存模块、自动购买优先级和自动化开关，不复制资源或等级。
- Consumes: Task 2 的无人机状态、Task 3～5 的深潜与收益。

- [ ] **Step 1: 写渐进自动化失败测试**

  新存档不能使用自动购买或自动技能；无人机解锁不同时解锁后两者；第一次重铸且 `totalCoreShards >= 12` 解锁自动购买；自动技能只由现有 50 碎片“技能编译器”协议解锁。反序列化旧存档时保留已经合法解锁的自动化。

- [ ] **Step 2: 写三种自动购买优先级失败测试**

  `cheapest` 购买最低价，`damage` 优先攻击/攻速/暴击，`economy` 优先熵晶/全局/重铸；没有可购买项时不修改资源。

- [ ] **Step 3: 运行测试确认失败**

  Run: `node --test --test-name-pattern "progressive automation|auto buy priority" tests/game.test.js`

  Expected: FAIL，当前只有最低价策略且自动化层级与新循环不匹配。

- [ ] **Step 4: 实现最小自动化优先级**

  不创建通用规则编辑器；只实现三个明确策略。自动技能继续使用现有可用即释放逻辑。

- [ ] **Step 5: 实现单槽构筑预设**

  第一次重铸后开放一个预设槽。保存和载入只处理模块选择、自动购买优先级和自动化开关；不得复制熵晶、炉心、研究、普通升级等级或永久协议。非法旧预设安全忽略。

- [ ] **Step 6: 更新自动化与预设 UI**

  未解锁功能显示下一进度目标；已解锁功能显示开关、三个购买优先级和一个构筑预设槽。所有点击后立即刷新状态。

- [ ] **Step 7: 运行前 30 分钟模拟**

  断言标准策略中：无人机最先开放，自动购买与自动技能随后分层出现；解锁顺序由游戏进度决定；30 层前至少形成两个有效构筑选择。

- [ ] **Step 8: 运行 Task 7 全部测试并记录完成**

  Run: `node --test tests/opening-pacing.test.js tests/progression.test.js tests/game.test.js tests/app-interaction.test.js`

  Expected: PASS。不提交。

---

### Task 8: 全流程平衡、文档与交付验证

**Files:**
- Modify: `tests/opening-pacing.test.js`
- Modify: `tests/progression.test.js`
- Modify: `README.md`
- Modify: `docs/ROADMAP-200H.md`

**Interfaces:**
- Consumes: Tasks 1～7 的完整可玩循环。
- Produces: 新存档 0～30 分钟、深度 30～100 和炉心协议成长的确定性验收记录。

- [ ] **Step 1: 补齐全流程失败场景**

  覆盖 Review Focus 的五类风险：旧决策态迁移、同帧多来源击杀、重复按钮输入、极端深度存档、移动端单屏操作。

- [ ] **Step 2: 运行确定性平衡模拟**

  记录而非强制定时：第一次升级、第二类升级、×2 里程碑、无人机、自动购买、自动技能、深度 30、40、50、80、100，以及各深度重铸收益。失败时只调整资源、生命、成本和进度条件，不添加时间锁。

- [ ] **Step 3: 验证长期收益不是固定 12**

  断言深度 40、50、60、80、100 的收益严格增长；确定性永久购买策略在不超过 30 次、最高逐步推进到深度 150 的有效深潜内可将 `damageMatrix` 与 `entropyLattice` 升至 Lv.12；连续停在深度 30 的总收益低于选择任一 `riskMultiplier > 1` 法则并继续深入的策略。

- [ ] **Step 4: 同步玩家文档**

  README 说明主动开局、渐进自动化、无尽深潜、守卫决策和动态炉心收益。路线图只标记本计划实际完成内容，不宣称成就、法则改写或 200 小时内容已经完成。

- [ ] **Step 5: 运行完整自动验证**

  Run: `node --check src/progression.js`

  Expected: 无输出，退出码 0。

  Run: `node --check src/game.js`

  Expected: 无输出，退出码 0。

  Run: `node --check src/app.js`

  Expected: 无输出，退出码 0。

  Run: `node --test tests`

  Expected: 全部 PASS。

  Run: `git diff --check`

  Expected: 无错误。

  Run: 本地静态服务检查 `/`、`/src/game.js`、`/src/progression.js`。

  Expected: 全部 HTTP 200。

- [ ] **Step 6: 对照规格进行只读自查**

  检查没有真实时间解锁、30 层不再是终点、收益随深度增长、旧存档可迁移、移动端可单屏决策。重要问题用 RED→GREEN 测试修复，次要问题记录交付说明。

- [ ] **Step 7: 汇报但不提交**

  汇报修改内容、设计原因、验证结果、尚未实施的后续子系统，并明确当前仍未 commit/push。
