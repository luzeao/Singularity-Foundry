# 《奇点熔炉》成长循环重做实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复守卫无限血和试炼软锁，并交付“每轮一名守卫、跨轮试炼、主动超载、前快后稳”的第一层重铸循环。

**Architecture:** 保留现有原生 JavaScript 状态机和静态页面结构，在 `src/game.js` 中以有限数值工具、单轮完成状态和超载状态扩展战斗核心；`src/app.js` 只负责即时渲染新状态。平衡标准由确定性测试驱动，不引入大数依赖，也不修改部署或配置文件。

**Tech Stack:** 原生 ES Modules、HTML/CSS、Node.js 内置测试运行器。

**Spec:** `docs/superpowers/specs/2026-09-29-progression-rebalance-design.md`

## Global Constraints

- 不修改 `.env`、密钥、配置、证书或 CI/CD。
- 不删除文件或历史，不执行 `git reset`、`rebase`、commit 或 push。
- 保持旧存档可迁移，已获得的永久研究进度不得回退。
- 新增或修改的非直观状态流转必须有简明中文注释。
- 所有生产代码修改必须先有能够正确失败的回归测试。
- 任何合法运行状态和新序列化存档都不能包含非有限数值。

## Review Focus

- 高伤害和高多重投射同帧发生时，只能击败当轮的一名守卫。
- 守卫由普通攻击、共振附伤、暴击复制或技能击杀时，都必须进入相同的稳定状态。
- 激活试炼在重铸后继续生效，主动取消才清空连续进度。
- `null`、`NaN`、`Infinity` 旧敌人数据必须修复，不能重置全部永久进度。
- 超载输入不能因为键盘长按或浏览器重复事件获得不受限收益。

---

### Task 1: 有限数值边界与非法存档修复

**Files:**
- Modify: `src/game.js`
- Test: `tests/game.test.js`

**Interfaces:**
- Produces: `finiteValue(value, fallback, maximum)` 内部工具；`createBoss(level)` 始终返回有限生命值；`deserializeGame(raw)` 修复非法敌人状态。
- Consumes: 现有 `createGameState()`、`serializeGame()`、`deserializeGame()`。

- [ ] **Step 1: 写失败测试**

  增加以下真实行为测试：
  - 极端攻击等级和多重攻击后，敌人生命、最大生命、熵晶与派生攻击均满足 `Number.isFinite`。
  - 将旧守卫的生命序列化为 `null` 后，读取存档会按 `research.totalPoints + 1` 恢复合法守卫，并保留研究、科技和炉心协议。
  - 新存档的序列化文本不包含 `null` 战斗数值。

- [ ] **Step 2: 运行定向测试并确认按预期失败**

  Run: `node --test --test-name-pattern "finite|invalid legacy guardian" tests/game.test.js`
  Expected: FAIL，失败原因是当前战斗产生非有限数值或旧敌人未修复。

- [ ] **Step 3: 实现统一有限值保护**

  在 `src/game.js` 中增加内部有限数值工具，把 Boss 生命、伤害、奖励和资源累加收敛到安全上限；反序列化时仅修复非法运行态字段，不丢弃永久进度。

- [ ] **Step 4: 运行定向测试确认通过**

  Run: `node --test --test-name-pattern "finite|invalid legacy guardian" tests/game.test.js`
  Expected: PASS。

---

### Task 2: 每轮一名守卫与熔炉稳定状态

**Files:**
- Modify: `src/game.js`
- Modify: `src/app.js`
- Test: `tests/game.test.js`
- Test: `tests/app-interaction.test.js`

**Interfaces:**
- Produces: `state.run.awaitingReforge: boolean`；守卫击杀事件 `bossDefeated` 只结算一次；`reforge(state)` 清除稳定状态并开始下一轮。
- Consumes: Task 1 的有限值保护；现有 `grantKill()`、`applyDamage()`、`performAttack()`、`activateSkill()`、`advanceGame()`。

- [ ] **Step 1: 写失败测试**

  - 极端多重攻击的一次手动脉冲只增加 1 点 `research.totalPoints`，并设置 `run.awaitingReforge`。
  - 稳定状态下手动、自动和技能攻击均不造成伤害或生成新守卫。
  - 守卫不再直接奖励普通熵晶。
  - 重铸后回到区域 1，且下一次抵达第 30 节点时生成永久研究等级对应的下一名守卫。

- [ ] **Step 2: 运行定向测试并确认按预期失败**

  Run: `node --test --test-name-pattern "one guardian per run|awaiting reforge|guardian reward" tests/game.test.js`
  Expected: FAIL，当前实现会在同一批攻击中继续生成守卫或奖励指数熵晶。

- [ ] **Step 3: 实现单轮完成状态**

  Boss 击杀后保留已败守卫作为稳定态展示对象，停止所有攻击管线；研究和重铸收益只结算一次。`reforge()` 创建新轮并清除 `awaitingReforge`。

- [ ] **Step 4: 更新界面状态**

  战斗区显示“熔炉已稳定”、本轮成果和下一守卫预告；任务栏引导重铸；攻击与技能按钮立即禁用，重铸按钮保持可操作。

- [ ] **Step 5: 运行定向测试确认通过**

  Run: `node --test --test-name-pattern "one guardian per run|awaiting reforge|guardian reward|focused action" tests`
  Expected: PASS。

---

### Task 3: 跨重铸法则试炼

**Files:**
- Modify: `src/game.js`
- Modify: `src/app.js`
- Test: `tests/game.test.js`
- Test: `tests/ui.test.js`

**Interfaces:**
- Produces: `state.challenges.active` 与 `progress` 在 `reforge()` 后保留；`cancelChallenge(state)` 是唯一主动清零路径。
- Consumes: Task 2 的每轮单守卫结算。

- [ ] **Step 1: 写失败测试**

  - Rank 2 试炼击败首名守卫后为 `1/2`，重铸后仍激活且保持 `1/2`。
  - 第二轮击败守卫后晋升 Rank 2 并退出激活状态。
  - 主动取消把进度清零；普通重铸不能清零。
  - 试炼限制在重铸后的普通节点阶段继续生效。

- [ ] **Step 2: 运行定向测试并确认按预期失败**

  Run: `node --test --test-name-pattern "trial persists|trial cancel" tests/game.test.js`
  Expected: FAIL，当前 `reforge()` 会清空试炼激活态和进度。

- [ ] **Step 3: 修改试炼状态流转**

  重铸复制 `active` 和 `progress`，Boss 击杀每轮最多增加一次进度；界面文案改为“连续完成 X/Y 轮”，并说明重铸不会中断。

- [ ] **Step 4: 运行定向测试确认通过**

  Run: `node --test --test-name-pattern "trial persists|trial cancel|trial" tests`
  Expected: PASS。

---

### Task 4: 主动熔炉超载与升级里程碑

**Files:**
- Modify: `src/game.js`
- Modify: `src/app.js`
- Modify: `index.html`
- Modify: `styles.css`
- Test: `tests/game.test.js`
- Test: `tests/app-interaction.test.js`
- Test: `tests/ui.test.js`

**Interfaces:**
- Produces: `state.effects.overdriveCharge`、`state.effects.overdriveTime`；`manualAttack(state, randomValues, options)` 以非重复输入积累能量；`deriveStats()` 应用限时爆发；升级派生包含每 10 级倍率。
- Consumes: Task 1 的有限值保护和现有即时渲染入口。

- [ ] **Step 1: 写失败测试**

  - 有效手动脉冲造成高于单次自动攻击、但有限的伤害并增加能量。
  - 重复输入标记不会增加能量。
  - 能量达到 100 后触发 10 秒超载，伤害和普通节点收益提高；计时结束恢复。
  - 重铸清空能量和超载时间。
  - 攻击升级 Lv.10 相比 Lv.9 获得额外里程碑倍率，Lv.20 再获得一次。

- [ ] **Step 2: 运行定向测试并确认按预期失败**

  Run: `node --test --test-name-pattern "overdrive|upgrade milestone" tests/game.test.js`
  Expected: FAIL，状态字段或倍率尚不存在。

- [ ] **Step 3: 实现超载战斗规则**

  手动脉冲按受限的当前 DPS 窗口计算；只对非重复输入充能；满能量触发 10 秒增益。为能量、时间递减和重铸清理补充简明注释。

- [ ] **Step 4: 实现升级里程碑**

  在派生属性中按每 10 级应用额外倍率；升级卡显示下一里程碑距离和已获得倍率，不改变购买成本算法。

- [ ] **Step 5: 更新战斗界面**

  增加能量条、超载状态和触摸反馈；移动端不增加新的必须滚动区域。点击事件把 `event.repeat` 或等价的重复输入信息传入战斗函数。

- [ ] **Step 6: 运行定向测试确认通过**

  Run: `node --test --test-name-pattern "overdrive|upgrade milestone|focused action|workspace" tests`
  Expected: PASS。

---

### Task 5: 分段经济和平衡模拟

**Files:**
- Modify: `src/game.js`
- Modify: `tests/pacing.test.js`
- Modify: `README.md`
- Modify: `docs/ROADMAP-200H.md`

**Interfaces:**
- Produces: 调整后的节点生命/奖励、守卫生命和重铸收益曲线；确定性购买模拟输出每轮耗时。
- Consumes: Tasks 1～4 的完整循环。

- [ ] **Step 1: 写失败的节奏验收测试**

  扩展确定性模拟，断言：
  - 首次守卫在 8～15 分钟到达并击败；
  - 首次重铸后 1～3 分钟回到第 30 节点；
  - 前十轮不会在单次模拟调用中完成两名守卫；
  - 每轮至少发生一次有效购买或永久决策；
  - 主动超载策略比纯挂机快 30%～50%；
  - 两种试炼 Rank 1～5 不会出现非有限值或不可恢复软锁。

- [ ] **Step 2: 运行节奏测试并确认当前曲线失败**

  Run: `node --test tests/pacing.test.js`
  Expected: FAIL，并输出不在目标区间的轮次与耗时。

- [ ] **Step 3: 调整最小必要曲线参数**

  仅修改普通节点生命/奖励、守卫分段生命、重铸收益和必要的升级基础成本，直到模拟进入规格区间；不新增第二层 Prestige 或任意精度依赖。

- [ ] **Step 4: 同步玩家文档**

  README 说明新的单轮循环、超载和试炼连续轮次；路线图准确标记已完成范围，不宣称 200 小时已实现。

- [ ] **Step 5: 运行完整验证**

  Run: `node --check src/game.js`
  Expected: 无输出，退出码 0。

  Run: `node --check src/app.js`
  Expected: 无输出，退出码 0。

  Run: `node --test tests`
  Expected: 全部 PASS。

  Run: `git diff --check`
  Expected: 无错误。

  Run: 本地静态服务 HTTP 检查。
  Expected: HTTP 200。

## 交付说明

完成后汇报修改内容、设计原因、自动验证、未完成的后续阶段，并明确所有变更仍未 commit/push。除非用户随后明确说“可以推送”，否则不进行任何 Git 提交或远端操作。
