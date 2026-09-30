# 主动构筑与探索 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** 普通区段可选择、守卫有收集、重铸有长期目标。
**Architecture:** content.js 负责定义、探索奖励和目标；game.js 负责战斗接入和存档；app.js/HTML/CSS 负责即时交互。
**Tech Stack:** 原生 JavaScript ES modules，node:test。
**Spec:** docs/superpowers/specs/2026-09-30-gameplay-loop-design.md

## Global Constraints
不提交、不推送、不删除、不修改配置；保留旧存档；按进度解锁而非等待；无浏览器权限绕过。

## Review Focus
事件重复领取、专精未装备空刷精通、遗物跨重铸丢失、旧版守卫决策无选项、沉默技能 UI 与规则不一致。

### Task 1: 核心探索规则
- [x] 在 tests/content-loop.test.js 写失败测试：三专精各自影响战斗；守卫遗物重复成长；事件仅领取一次且守卫清空增益；成就仅领取一次。
- [x] 运行 node --test tests/content-loop.test.js 观察缺少接口/效果失败。
- [x] content.js 导出 BUILD_DEFINITIONS、RELIC_DEFINITIONS、ACHIEVEMENT_DEFINITIONS、chooseSpecialization(state,id)、chooseExpeditionReward(state,id)、claimAchievement(state,id)、getJourneyGoals(state)、getBuildModifiers(state)、recordGuardianVictory(state,id)、normalizeJourney(state)。game.js 接入这些函数。
- [x] 验证针对测试和全套回归。

### Task 2: 存档与状态兼容
- [x] 先测试重铸保留 journey；旧版决策补全法则；损坏新增字段局部修复而非清档。
- [x] 实现序列化迁移和预设专精字段；守卫决策时禁止模拟临时效果流失。
- [x] 验证针对测试和全套回归。

### Task 3: 玩家可见闭环
- [x] 扩展交互测试：专精/事件/成就操作立即反映、沉默禁用、图鉴页可打开。
- [x] 新增探索页、永久图鉴页、三层目标、离线收益横幅，按状态变更更新卡片避免无用 DOM 重建；用户动作刷新所有受影响按钮并保存。
- [x] 手机触控按钮与结算内换专精入口；结算时隐藏手机导航；已选法则刷新保持 DOM 焦点。真实手机视觉仍未验证。
- [x] node --test、node --check、git diff --check；更新 README，本轮结果追加到本计划。

## 执行裁决
按用户直接实施要求在当前含未提交成果的工作区执行；不创建隔离副本以免遗漏已批准的核心代码。技能中的提交/清理步骤由用户红线覆盖。

## 执行记录 / 验证
- Task 1 complete：新增规则测试先失败，再实现；第一轮全套 102/102。
- Task 2 complete：旧决策生成法则、可选内容局部归一化、预设锁定、决策冻结临时效果；补齐旧镜面守卫相位与计时器迁移。
- Task 3 complete：交互测试先复现缺少探索操作；新增冷却焦点和存储额度失败测试 RED→GREEN。
- 原有镜面法则未覆盖非镜像守卫；共享计时器被重力机制提前重置，修复并回归。
- 原有守卫奖励升级没有消费其倍率；已接入真实炉心结算，测试 12 ×1.5 ×1.4 →25。
- 独立只读审查发现手机导航祖先层叠问题；通过结算期间隐藏导航修复。不只靠提高内部 z-index。
- 最终完整测试：node --test →108/108；三个入口模块及 content.js 语法检查；git diff --check 通过。
- 本地服务首页、app/game/content/progression 模块和样式均 HTTP 200。
- 未提交、未推送、未删除、未修改配置。浏览器真实布局和长期留存未验证，第二层转生/剧情/音效仍为后续范围。
