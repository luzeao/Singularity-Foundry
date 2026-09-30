// 探索内容只操作游戏状态，不依赖 DOM 或战斗模拟，便于独立验证奖励结算。
export const BUILD_DEFINITIONS = {
  resonance: { name: '共振引擎', module: 'resonanceCore', rule: '共振爆发 ×2，精通后继续强化', tradeoff: '依靠高频攻击积累；绝对时间会限制触发速度' },
  fracture: { name: '断裂处决', module: 'fractureLens', rule: '暴击回响率 50%，敌人低于 30% 生命时伤害 ×1.5', tradeoff: '需要暴击投资；重复伤害会被熵适应克制' },
  singularity: { name: '奇点编译', module: 'timeCapacitor', rule: '奇点炮伤害 ×1.8，时间折叠立即重置炮击', tradeoff: '依靠技能联动；沉默法则会封锁输出循环' },
};

export const RELIC_DEFINITIONS = {
  'gravity-guardian': { name: '坍缩锚', effect: '每阶对守卫伤害 +12%' },
  'mirror-guardian': { name: '镜面棱晶', effect: '每阶暴击伤害 +20%' },
  'time-guardian': { name: '时序残片', effect: '每阶技能冷却 ×0.95' },
  'entropy-guardian': { name: '余烬容器', effect: '每阶熵晶收益 +15%' },
};

export const EXPEDITION_REWARDS = {
  assault: { name: '不稳定增幅', description: '本段攻击力 ×1.4；守卫击破后结束，同类不叠加' },
  salvage: { name: '回收航线', description: '本段熵晶收益 ×1.6；守卫击破后结束，同类不叠加' },
  archive: { name: '封存炉心', description: '立即获得 2 炉心，可投资永久协议；放弃本次增幅' },
};

export const ACHIEVEMENT_DEFINITIONS = {
  firstGuardian: { name: '打破第一条法则', target: 1, reward: 3, progress: (s) => s.lifetime.bosses },
  firstReforge: { name: '熔炉的第二人生', target: 1, reward: 5, progress: (s) => s.lifetime.reforges },
  fourGuardians: { name: '四相观测者', target: 4, reward: 12, progress: (s) => s.research.discoveredGuardians.length },
  depth60: { name: '深入未知', target: 60, reward: 20, progress: (s) => s.journey.peakDepth },
  fiveLaws: { name: '法则旅行家', target: 5, reward: 25, progress: (s) => s.journey.completedLaws.length },
  depth100: { name: '百层之外', target: 100, reward: 60, progress: (s) => s.journey.peakDepth },
  relicCollector: { name: '遗物考古学家', target: 4, reward: 80, progress: (s) => Object.values(s.journey.relics).filter((count) => count >= 7).length },
  threeMasters: { name: '三位一体', target: 3, reward: 150, progress: (s) => Object.values(s.journey.mastery).filter((count) => count >= 15).length },
};

const safeCount = (value) => Number.isFinite(value) ? Math.min(1e6, Math.max(0, Math.floor(value))) : 0;
const knownList = (value, ids) => Array.isArray(value) ? [...new Set(value.filter((id) => ids.includes(id)))] : [];

export function normalizeJourney(state) {
  const saved = state.journey ?? {};
  return {
    specialization: Object.hasOwn(BUILD_DEFINITIONS, saved.specialization) ? saved.specialization : null,
    mastery: Object.fromEntries(Object.keys(BUILD_DEFINITIONS).map((id) => [id, safeCount(saved.mastery?.[id])])),
    // 老玩家已收集的守卫图鉴迁移为一阶遗物，不要求重新刷一次才获得新内容。
    relics: Object.fromEntries(Object.keys(RELIC_DEFINITIONS).map((id) => [id,
      Math.max(safeCount(saved.relics?.[id]), state.research?.discoveredGuardians?.includes(id) ? 1 : 0),
    ])),
    completedLaws: knownList(saved.completedLaws, ['massCollapse', 'silenceProtocol', 'absoluteSequence', 'mirrorCircuit', 'entropyAdaptation']),
    claimedAchievements: knownList(saved.claimedAchievements, Object.keys(ACHIEVEMENT_DEFINITIONS)),
    peakDepth: Math.max(safeCount(saved.peakDepth), safeCount(state.bestDepth), 1),
  };
}

export function getMasteryRank(count = 0) {
  return [1, 5, 15].filter((threshold) => count >= threshold).length;
}

export function getRelicRank(count = 0) {
  return [1, 3, 7, 15, 31].filter((threshold) => count >= threshold).length;
}

export function chooseSpecialization(state, id) {
  if (!Object.hasOwn(BUILD_DEFINITIONS, id) || !state.unlocked.autoAttack && state.bestDepth < 12
      || state.run.buildCommitted && !state.run.awaitingDecision) return { chosen: false };
  state.journey.specialization = id;
  state.run.buildCommitted = true;
  return { chosen: true };
}

export function getBuildModifiers(state) {
  const id = state.journey?.specialization;
  const definition = BUILD_DEFINITIONS[id];
  const active = Boolean(definition && state.equippedModules.includes(definition.module));
  const rank = getMasteryRank(state.journey?.mastery?.[id]);
  const relics = state.journey?.relics ?? {};
  return {
    resonance: active && id === 'resonance' ? 2 + rank * 0.4 : 1,
    echoChance: active && id === 'fracture' ? 0.5 + rank * 0.05 : 0.2,
    execute: active && id === 'fracture' && state.enemy.health / state.enemy.maxHealth <= 0.3 ? 1.5 + rank * 0.1 : 1,
    cannon: active && id === 'singularity' ? 1.8 + rank * 0.2 : 1,
    foldReset: active && id === 'singularity',
    bossDamage: 1 + getRelicRank(relics['gravity-guardian']) * 0.12,
    critDamage: getRelicRank(relics['mirror-guardian']) * 0.2,
    cooldown: 0.95 ** getRelicRank(relics['time-guardian']),
    entropy: 1 + getRelicRank(relics['entropy-guardian']) * 0.15,
    sectorAttack: state.run.sectorBuff === 'assault' ? 1.4 : 1,
    sectorEntropy: state.run.sectorBuff === 'salvage' ? 1.6 : 1,
  };
}

export function recordGuardianVictory(state, guardianId) {
  state.journey.peakDepth = Math.max(state.journey.peakDepth, state.depth);
  if (Object.hasOwn(RELIC_DEFINITIONS, guardianId)) {
    state.journey.relics[guardianId] = safeCount(state.journey.relics[guardianId] + 1);
  }
  const build = state.journey.specialization;
  // 专精经验来自真正使用对应模块的守卫战，不能只选一个名字空刷永久强化。
  if (BUILD_DEFINITIONS[build] && state.equippedModules.includes(BUILD_DEFINITIONS[build].module)) {
    state.journey.mastery[build] = safeCount(state.journey.mastery[build] + 1);
  }
  if (state.run.currentLaw && !state.journey.completedLaws.includes(state.run.currentLaw)) {
    state.journey.completedLaws.push(state.run.currentLaw);
  }
  state.run.expedition = null;
  state.run.sectorBuff = null;
}

export function chooseExpeditionReward(state, id) {
  const event = state.run.expedition;
  if (!event || event.choice || state.run.awaitingDecision || !Object.hasOwn(EXPEDITION_REWARDS, id)) return { chosen: false };
  event.choice = id;
  if (id === 'archive') {
    state.coreShards = Math.min(1e300, state.coreShards + 2);
    state.totalCoreShards = Math.min(1e300, state.totalCoreShards + 2);
  } else state.run.sectorBuff = id;
  return { chosen: true };
}

export function claimAchievement(state, id) {
  // 只接受定义自身的 ID，不能把 constructor 等继承属性当作成就规则调用。
  if (!Object.hasOwn(ACHIEVEMENT_DEFINITIONS, id)) return { claimed: false };
  const item = ACHIEVEMENT_DEFINITIONS[id];
  if (!item || state.journey.claimedAchievements.includes(id) || item.progress(state) < item.target) return { claimed: false };
  state.journey.claimedAchievements.push(id);
  state.coreShards = Math.min(1e300, state.coreShards + item.reward);
  state.totalCoreShards = Math.min(1e300, state.totalCoreShards + item.reward);
  return { claimed: true, reward: item.reward };
}

export function getJourneyGoals(state) {
  const achievement = Object.values(ACHIEVEMENT_DEFINITIONS).find((item) => item.progress(state) < item.target);
  const nextGuardian = state.depth < 30 ? 30 : Math.floor(state.depth / 10) * 10 + (state.enemy.isBoss ? 0 : 10);
  const nextAttack = (Math.floor(state.upgrades.attack / 10) + 1) * 10;
  return [
    { label: '眼前', text: state.run.expedition && !state.run.expedition.choice ? '途中发现补给：选择爆发、经济或炉心' : `脉冲强度 Lv.${nextAttack}：额外伤害 ×2` },
    { label: '本轮', text: state.run.awaitingDecision ? '收益已锁定：换流派、继续深潜或重铸' : `击破深度 ${nextGuardian} 守卫，收集专属遗物` },
    { label: '长期', text: achievement ? `${achievement.name} · ${Math.min(achievement.target, achievement.progress(state))}/${achievement.target}` : `突破个人纪录：深度 ${state.journey.peakDepth + 10}` },
  ];
}
