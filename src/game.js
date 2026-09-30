import {
  FIRST_GUARDIAN_DEPTH,
  SECTOR_LAW_DEFINITIONS,
  getDepthHealthScale,
  getDepthNode,
  getDepthRegion,
  getSectorLawChoices,
  getSectorModifiers,
  isGuardianDepth,
} from './progression.js';

export { SECTOR_LAW_DEFINITIONS, getSectorLawChoices, getSectorModifiers } from './progression.js';
import { chooseSpecialization, getBuildModifiers, normalizeJourney, recordGuardianVictory } from './content.js';
export { BUILD_DEFINITIONS, RELIC_DEFINITIONS, EXPEDITION_REWARDS, ACHIEVEMENT_DEFINITIONS,
  chooseSpecialization, chooseExpeditionReward, claimAchievement, getJourneyGoals,
  getMasteryRank, getRelicRank } from './content.js';

const ACTIVE_STEP_LIMIT = 600;
const BASE_EQUIPPED_MODULES = 2;
const MAX_REPORTED_EVENTS = 500;
const MAX_REALTIME_ATTACK_SPEED = 120;
const MAX_FINITE_VALUE = 1e300;

function finiteValue(value, fallback = 0, maximum = MAX_FINITE_VALUE) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(-maximum, Math.min(maximum, value));
}

export const REGION_DEFINITIONS = [
  { id: 'matter', name: '物质层', nodeName: '物质节点', healthBase: 8, rewardBase: 5 },
  { id: 'gravity', name: '重力井', nodeName: '重力节点', healthBase: 80, rewardBase: 28 },
  { id: 'entropy', name: '热寂边界', nodeName: '热力节点', healthBase: 820, rewardBase: 150 },
];

export const BOSS_DEFINITIONS = [
  { id: 'gravity-guardian', name: '重力守卫', cycle: 12 },
  { id: 'mirror-guardian', name: '镜像守卫', cycle: 8 },
  { id: 'time-guardian', name: '时间守卫', cycle: 10 },
  { id: 'entropy-guardian', name: '熵守卫', cycle: 10 },
];

export const UPGRADE_DEFINITIONS = {
  attack: { name: '脉冲强度', description: '攻击力 ×1.167', baseCost: 5, growth: 1.1, unlockNode: 1 },
  speed: { name: '脉冲频率', description: '攻击速度 ×1.2', baseCost: 8, growth: 1.19, unlockNode: 2 },
  critChance: { name: '断裂概率', description: '暴击率 +5%', baseCost: 75, growth: 1.22, unlockNode: 6 },
  critDamage: { name: '断裂深度', description: '暴击伤害 +50%', baseCost: 180, growth: 1.24, unlockNode: 8 },
  multiStrike: { name: '多重投射', description: '每 4 级增加一次攻击', baseCost: 420, growth: 1.28, unlockNode: 11 },
  skillPower: { name: '技能增幅', description: '技能效果 ×1.35', baseCost: 900, growth: 1.25, unlockNode: 13 },
  cooldown: { name: '时间压缩', description: '技能冷却 -6%', baseCost: 1_800, growth: 1.27, unlockNode: 16 },
  entropy: { name: '熵晶提纯', description: '熵晶获取 ×1.45', baseCost: 3_600, growth: 1.23, unlockNode: 18 },
  resonance: { name: '共振回路', description: '共振伤害 ×1.5', baseCost: 8_000, growth: 1.3, unlockNode: 21 },
  bossReward: { name: '守卫解析', description: 'Boss 奖励 ×1.5', baseCost: 18_000, growth: 1.3, unlockNode: 23 },
  global: { name: '熔炉协同', description: '伤害与资源 ×1.22', baseCost: 42_000, growth: 1.32, unlockNode: 26 },
  reforgeEfficiency: { name: '重铸预演', description: '炉心碎片 +20%', baseCost: 100_000, growth: 1.35, unlockNode: 29 },
};

export const SKILL_DEFINITIONS = {
  overload: { name: '过载', description: '10 秒内攻击速度 ×2', cooldown: 30, duration: 10, unlockNode: 11 },
  singularityCannon: { name: '奇点炮', description: '造成 1000% 技能伤害', cooldown: 20, unlockNode: 16 },
  timeFold: { name: '时间折叠', description: '其他技能剩余冷却 -30%', cooldown: 24, unlockNode: 21 },
};

export const MODULE_DEFINITIONS = {
  resonanceCore: { name: '共振核心', description: '每 10 次攻击获得 1% 攻速，实时攻速上限提高至 120/s', unlockNode: 12 },
  fractureLens: { name: '裂变镜片', description: '暴击有 20% 概率复制一次', unlockNode: 15 },
  timeCapacitor: { name: '时间电容', description: '每次暴击使所有技能冷却减少 0.1 秒', unlockNode: 18 },
  entropyRecycler: { name: '熵回收器', description: '技能击杀返还该技能 30% 冷却', unlockNode: 21 },
  overloadAmplifier: { name: '过载放大器', description: '超过 10/s 的攻速转化为技能伤害', unlockNode: 25 },
  singularityLens: { name: '奇点透镜', description: '每第 12 次攻击聚焦，造成 20 倍伤害', unlockNode: 28 },
};

export const CORE_UPGRADE_DEFINITIONS = {
  damageMatrix: { name: '破坏矩阵', description: '永久伤害 ×1.35', baseCost: 5, growth: 2, maxLevel: 12 },
  entropyLattice: { name: '熵晶格', description: '永久熵晶获取 ×1.3', baseCost: 5, growth: 2, maxLevel: 12 },
  chronoCoil: { name: '时序线圈', description: '永久技能冷却 -6%', baseCost: 8, growth: 2.4, maxLevel: 8 },
  guardianLens: { name: '守卫透镜', description: '永久 Boss 奖励 ×1.4', baseCost: 12, growth: 2.5, maxLevel: 8 },
  autoSkills: { name: '技能编译器', description: '解锁自动释放技能', baseCost: 50, growth: 1, maxLevel: 1 },
  moduleBay: { name: '模块扩展舱', description: '永久增加 1 个模块槽', baseCost: 75, growth: 3, maxLevel: 2 },
};

export const TECH_DEFINITIONS = {
  kineticTheory: { branch: '破坏', name: '动能理论', description: '伤害 ×1.25', baseCost: 1, growth: 2, maxLevel: 5 },
  executionVectors: { branch: '破坏', name: '处决向量', description: '对 Boss 伤害 ×1.35', baseCost: 2, growth: 2, maxLevel: 4 },
  entropyRouting: { branch: '熔炉', name: '熵路由', description: '熵晶获取 ×1.2', baseCost: 1, growth: 2, maxLevel: 5 },
  reforgeLattice: { branch: '熔炉', name: '重铸晶格', description: '重铸收益 ×1.2', baseCost: 2, growth: 2, maxLevel: 4 },
  temporalLogic: { branch: '法则', name: '时序逻辑', description: '技能冷却 -5%', baseCost: 2, growth: 2, maxLevel: 5 },
  spatialWeave: { branch: '法则', name: '空间编织', description: '增加 1 个模块槽', baseCost: 5, growth: 1, maxLevel: 1 },
};

export const CHALLENGE_DEFINITIONS = {
  silence: {
    name: '沉默试炼', rule: '无法主动或自动释放技能', reward: '每阶令普通攻击额外削减 0.01 秒技能冷却', unlockResearch: 2,
  },
  absoluteTime: {
    name: '绝对时间', rule: '攻击速度固定为 1/s', reward: '每阶将多余攻速的 3% 永久转化为伤害', unlockResearch: 4,
  },
};

export const CHALLENGE_RANK_UNLOCKS = {
  silence: [2, 6, 14, 26, 42],
  absoluteTime: [4, 10, 20, 34, 52],
};

function createDepthEnemy(depth, modifiers = {}) {
  const region = getDepthRegion(depth);
  const node = getDepthNode(depth);
  const definition = REGION_DEFINITIONS[region] ?? REGION_DEFINITIONS.at(-1);
  const openingDepth = Math.min(depth, FIRST_GUARDIAN_DEPTH);
  // The first automation milestone is a smooth climb: quick early wins, then a readable ramp into depth 12.
  const openingRamp = 1.62 ** Math.min(9, Math.max(0, openingDepth - 3));
  const health = Math.round(finiteValue(
    definition.healthBase * 1.42 ** (node - 1) * openingRamp
      * getDepthHealthScale(depth) * (modifiers.health ?? 1),
    MAX_FINITE_VALUE,
  ));
  return {
    id: `${definition.id}-${depth}`,
    name: definition.nodeName,
    maxHealth: health,
    health,
    isBoss: false,
    aliveSeconds: 0,
  };
}

function createEnemy(region, node) {
  return createDepthEnemy(region * 10 + Math.min(node, 10));
}

function createBoss(level = 1) {
  const definition = BOSS_DEFINITIONS[(level - 1) % BOSS_DEFINITIONS.length];
  // 早期守卫让永久协议追得上，中后期再逐段提高软墙；旧存档的超高层级仍会被有限值保护。
  const earlyLevels = Math.min(level - 1, 9);
  const midLevels = Math.min(Math.max(level - 10, 0), 20);
  const lateLevels = Math.max(level - 30, 0);
  const earlyGrowth = earlyLevels === 0 ? 1 : 6.5 * 1.55 ** (earlyLevels - 1);
  // 重力易伤会随连续命中快速叠高，用基础生命补偿其机制带来的平均承伤差异。
  const ruleScale = definition.id === 'gravity-guardian' ? 2.2 : 1;
  const health = Math.round(finiteValue(
    18_000 * earlyGrowth * 2 ** midLevels * 2.1 ** lateLevels * ruleScale,
    MAX_FINITE_VALUE,
  ));
  return {
    id: definition.id, name: definition.name, maxHealth: health, health,
    isBoss: true, level, aliveSeconds: 0, vulnerability: 0, pulseTimer: definition.cycle,
    phase: definition.id === 'mirror-guardian' ? 'attack' : null,
    lastDamageSource: null, entropyResistance: 0,
  };
}

function createDepthGuardian(depth, guardianLevel = 1, modifiers = {}) {
  const guardian = createBoss(guardianLevel);
  const health = Math.round(finiteValue(
    guardian.maxHealth * getDepthHealthScale(depth) * (modifiers.health ?? 1),
    MAX_FINITE_VALUE,
  ));
  // 镜面法则覆盖任意类型守卫，不仅是原生镜像守卫，否则整段始终停在同一相位。
  return { ...guardian, maxHealth: health, health, depth,
    phase: modifiers.mirrorGuardian ? 'attack' : guardian.phase,
    pulseTimer: modifiers.mirrorGuardian ? 8 : guardian.pulseTimer,
    mirrorSector: Boolean(modifiers.mirrorGuardian) };
}

export function getBossRuleText(enemy) {
  if (!enemy?.isBoss) return '';
  if (enemy.id === 'gravity-guardian' && !enemy.mirrorSector) {
    return `重力裂隙 +${Math.round((enemy.vulnerability ?? 0) * 100)}% · ${(enemy.pulseTimer ?? 12).toFixed(1)} 秒后收束`;
  }
  if (enemy.id === 'mirror-guardian' || enemy.mirrorSector) {
    const label = enemy.phase === 'skill' ? '技能' : '普通攻击';
    return `镜面相位：${label}造成 150% 伤害 · ${(enemy.pulseTimer ?? 8).toFixed(1)} 秒后切换`;
  }
  if (enemy.id === 'time-guardian') return '时间封锁：攻击速度减半，技能伤害翻倍';
  if (enemy.id === 'entropy-guardian') {
    return `熵适应：重复伤害来源抗性 ${Math.round((enemy.entropyResistance ?? 0) * 100)}%`;
  }
  return '';
}

export function createGameState() {
  return {
    version: 1,
    entropy: 0,
    coreShards: 0,
    totalCoreShards: 0,
    region: 0,
    node: 1,
    highestNode: 1,
    depth: 1,
    bestDepth: 1,
    completed: false,
    enemy: createEnemy(0, 1),
    upgrades: Object.fromEntries(Object.keys(UPGRADE_DEFINITIONS).map((id) => [id, 0])),
    coreUpgrades: Object.fromEntries(Object.keys(CORE_UPGRADE_DEFINITIONS).map((id) => [id, 0])),
    techs: Object.fromEntries(Object.keys(TECH_DEFINITIONS).map((id) => [id, 0])),
    research: { points: 0, totalPoints: 0, discoveredGuardians: [] },
    challenges: {
      active: null,
      progress: 0,
      ranks: Object.fromEntries(Object.keys(CHALLENGE_DEFINITIONS).map((id) => [id, 0])),
      completed: [],
    },
    unlocked: {
      skills: [],
      modules: [],
      autoAttack: false,
      autoBuy: false,
      autoSkills: false,
    },
    equippedModules: [],
    skillCooldowns: {},
    effects: { overload: 0, resonanceStacks: 0, overdriveCharge: 0, overdriveTime: 0, manualPulseCooldown: 0 },
    settings: {
      buyAmount: 1,
      autoBuy: false,
      autoSkills: false,
      reducedMotion: false,
      autoBuyPriority: 'cheapest',
    },
    run: {
      attacks: 0,
      criticalHits: 0,
      kills: 0,
      bosses: 0,
      damage: 0,
      entropyEarned: 0,
      activeSeconds: 0,
      attackAccumulator: 0,
      awaitingReforge: false,
      awaitingDecision: false,
      guardiansDefeated: 0,
      lockedCoreGain: 0,
      lockedDepth: 0,
      lawChoices: [],
      currentLaw: null,
      riskProduct: 1,
      expedition: null,
      sectorBuff: null,
      buildCommitted: false,
    },
    buildPresets: [null],
    journey: normalizeJourney({ bestDepth: 1 }),
    lifetime: {
      reforges: 0,
      entropyEarned: 0,
      bosses: 0,
    },
    tutorialStep: 0,
    logs: ['奇点熔炉已点火。点击核心发射主动脉冲。'],
    lastSavedAt: Date.now(),
  };
}

export function deriveStats(state) {
  const sector = getSectorModifiers(state);
  const build = getBuildModifiers(state);
  // 未消费碎片只代表选择空间，永久战力必须来自玩家实际购买的协议。
  const coreDamage = 1.35 ** (state.coreUpgrades?.damageMatrix ?? 0);
  const coreEntropy = 1.3 ** (state.coreUpgrades?.entropyLattice ?? 0);
  const globalMultiplier = 1.22 ** (state.upgrades.global ?? 0);
  const techDamage = 1.25 ** (state.techs?.kineticTheory ?? 0);
  const rawAttackSpeed = 1.2 ** (state.upgrades.speed ?? 0)
    * (state.effects.overload > 0 ? 2 : 1)
    * (1 + (state.effects.resonanceStacks ?? 0) * 0.01)
    * (state.enemy?.id === 'time-guardian' ? 0.5 : 1);
  const hasResonanceCore = state.equippedModules.includes('resonanceCore');
  const excessSpeed = Math.max(0, rawAttackSpeed - 10);
  const absoluteTimeRank = state.challenges?.ranks?.absoluteTime
    ?? (state.challenges?.completed.includes('absoluteTime') ? 1 : 0);
  const speedConversion = absoluteTimeRank > 0
    ? 1 + Math.max(0, rawAttackSpeed - 1) * 0.03 * absoluteTimeRank
    : 1;
  const attackMilestone = 2 ** Math.floor((state.upgrades.attack ?? 0) / 10);
  // 前四次重铸形成旧区域追赶里程碑，但不作用于当前永久守卫的软墙。
  const reforgeCatchup = state.enemy?.isBoss ? 1 : 2 ** Math.min(state.lifetime?.reforges ?? 0, 4);
  const overdriveDamage = (state.effects.overdriveTime ?? 0) > 0 ? 2 : 1;
  const overdriveEntropy = (state.effects.overdriveTime ?? 0) > 0 ? 1.5 : 1;
  return {
    attack: finiteValue(1.167 ** (state.upgrades.attack ?? 0) * attackMilestone
      * globalMultiplier * coreDamage * techDamage * speedConversion * reforgeCatchup * overdriveDamage
      * build.execute * build.sectorAttack, MAX_FINITE_VALUE),
    attackSpeed: state.challenges?.active === 'absoluteTime'
      ? 1
      // 原始攻速仍供溢出转化使用，仅限制逐次模拟量，避免共振构筑阻塞浏览器主线程。
      : Math.min(sector.attackSpeedCap, hasResonanceCore ? MAX_REALTIME_ATTACK_SPEED : 10, rawAttackSpeed),
    rawAttackSpeed: finiteValue(rawAttackSpeed, MAX_FINITE_VALUE),
    critChance: finiteValue(0.05 + (state.upgrades.critChance ?? 0) * 0.05 + sector.critChance, MAX_FINITE_VALUE),
    critDamage: finiteValue(2 + (state.upgrades.critDamage ?? 0) * 0.5 + build.critDamage, MAX_FINITE_VALUE),
    multiStrike: 1 + Math.floor((state.upgrades.multiStrike ?? 0) / 4),
    skillPower: finiteValue(1.35 ** (state.upgrades.skillPower ?? 0)
      * (state.enemy?.id === 'time-guardian' ? 2 : 1)
      * (state.equippedModules.includes('overloadAmplifier') ? 1 + excessSpeed * 0.1 : 1), MAX_FINITE_VALUE),
    cooldownMultiplier: Math.max(0.15, 0.94 ** ((state.upgrades.cooldown ?? 0) + (state.coreUpgrades?.chronoCoil ?? 0))
      * 0.95 ** (state.techs?.temporalLogic ?? 0) * build.cooldown),
    entropyMultiplier: finiteValue(1.45 ** (state.upgrades.entropy ?? 0) * globalMultiplier * coreEntropy
      * 1.2 ** (state.techs?.entropyRouting ?? 0) * overdriveEntropy * build.entropy * build.sectorEntropy, MAX_FINITE_VALUE),
    resonanceMultiplier: finiteValue(1.5 ** (state.upgrades.resonance ?? 0), MAX_FINITE_VALUE),
    bossRewardMultiplier: finiteValue(1.5 ** (state.upgrades.bossReward ?? 0) * 1.4 ** (state.coreUpgrades?.guardianLens ?? 0), MAX_FINITE_VALUE),
    bossDamageMultiplier: finiteValue(1.35 ** (state.techs?.executionVectors ?? 0) * build.bossDamage, MAX_FINITE_VALUE),
  };
}

export function getCoreUpgradeCost(state, id) {
  const definition = CORE_UPGRADE_DEFINITIONS[id];
  if (!definition) return Number.POSITIVE_INFINITY;
  const level = state.coreUpgrades?.[id] ?? 0;
  if (level >= definition.maxLevel) return Number.POSITIVE_INFINITY;
  return Math.ceil(definition.baseCost * definition.growth ** level);
}

export function buyCoreUpgrade(state, id) {
  const definition = CORE_UPGRADE_DEFINITIONS[id];
  if (!definition) return { bought: false, reason: 'unknown', cost: Number.POSITIVE_INFINITY };
  const level = state.coreUpgrades?.[id] ?? 0;
  if (level >= definition.maxLevel) return { bought: false, reason: 'maxed', cost: Number.POSITIVE_INFINITY };
  const cost = getCoreUpgradeCost(state, id);
  if (state.coreShards < cost) return { bought: false, reason: 'insufficient', cost };
  state.coreShards -= cost;
  state.coreUpgrades[id] = level + 1;
  if (id === 'autoSkills') state.unlocked.autoSkills = true;
  pushLog(state, `炉心协议升级：${definition.name} Lv.${state.coreUpgrades[id]}`);
  return { bought: true, cost };
}

export function getModuleSlotCount(state) {
  return BASE_EQUIPPED_MODULES + (state.coreUpgrades?.moduleBay ?? 0) + (state.techs?.spatialWeave ?? 0);
}

export function getTechCost(state, id) {
  const definition = TECH_DEFINITIONS[id];
  if (!definition) return Number.POSITIVE_INFINITY;
  const level = state.techs?.[id] ?? 0;
  if (level >= definition.maxLevel) return Number.POSITIVE_INFINITY;
  return Math.ceil(definition.baseCost * definition.growth ** level);
}

export function buyTech(state, id) {
  const definition = TECH_DEFINITIONS[id];
  if (!definition) return { bought: false, reason: 'unknown', cost: Number.POSITIVE_INFINITY };
  const level = state.techs?.[id] ?? 0;
  if (level >= definition.maxLevel) return { bought: false, reason: 'maxed', cost: Number.POSITIVE_INFINITY };
  const cost = getTechCost(state, id);
  if (state.research.points < cost) return { bought: false, reason: 'insufficient', cost };
  state.research.points -= cost;
  state.techs[id] = level + 1;
  pushLog(state, `科技解析：${definition.branch} · ${definition.name} Lv.${state.techs[id]}`);
  return { bought: true, cost };
}

export function startChallenge(state, id) {
  const definition = CHALLENGE_DEFINITIONS[id];
  if (!definition) return { started: false, reason: 'unknown' };
  if (state.challenges.active) return { started: false, reason: 'active' };
  const currentRank = state.challenges.ranks?.[id] ?? 0;
  if (currentRank >= 5) return { started: false, reason: 'completed' };
  // 每阶试炼分散到永久守卫里程碑，避免首次解锁后几分钟内连续点完全部内容。
  const requiredResearch = CHALLENGE_RANK_UNLOCKS[id]?.[currentRank] ?? definition.unlockResearch;
  if (state.research.totalPoints < requiredResearch) {
    return { started: false, reason: 'locked', requiredResearch };
  }
  state.challenges.active = id;
  state.challenges.progress = 0;
  const required = currentRank + 1;
  pushLog(state, `法则试炼启动：${definition.name}。连续击败 ${required} 名守卫即可晋阶。`);
  return { started: true };
}

export function cancelChallenge(state) {
  if (!state.challenges.active) return { cancelled: false };
  const id = state.challenges.active;
  state.challenges.active = null;
  state.challenges.progress = 0;
  pushLog(state, `已退出法则试炼：${CHALLENGE_DEFINITIONS[id].name}。`);
  return { cancelled: true };
}

export function getUpgradeCost(state, id, amount = 1) {
  const definition = UPGRADE_DEFINITIONS[id];
  if (!definition || amount < 1) return Number.POSITIVE_INFINITY;
  const level = state.upgrades[id] ?? 0;
  let total = 0;
  for (let offset = 0; offset < amount; offset += 1) {
    total += Math.ceil(definition.baseCost * definition.growth ** (level + offset));
  }
  return total;
}

export function buyUpgrade(state, id, amount = 1) {
  if (!UPGRADE_DEFINITIONS[id]) return { bought: 0, spent: 0 };
  let bought = 0;
  let spent = 0;
  const target = amount === 'max' ? Number.POSITIVE_INFINITY : Math.max(0, amount);

  while (bought < target) {
    const cost = getUpgradeCost(state, id, 1);
    if (state.entropy + Number.EPSILON < cost) break;
    state.entropy -= cost;
    state.upgrades[id] = (state.upgrades[id] ?? 0) + 1;
    spent += cost;
    bought += 1;
  }

  return { bought, spent };
}

function nextRandom(values, cursor) {
  if (cursor.index < values.length) {
    const value = values[cursor.index];
    cursor.index += 1;
    return value;
  }
  return 0.5;
}

function pushLog(state, message) {
  state.logs.unshift(message);
  state.logs.length = Math.min(state.logs.length, 30);
}

function updateUnlocks(state) {
  if (!state.unlocked.autoAttack && (state.bestDepth ?? 1) >= 12) {
    state.unlocked.autoAttack = true;
    pushLog(state, '脉冲无人机已上线：自动攻击开始运行。');
  }
  for (const [id, skill] of Object.entries(SKILL_DEFINITIONS)) {
    if (state.highestNode >= skill.unlockNode && !state.unlocked.skills.includes(id)) {
      state.unlocked.skills.push(id);
      state.skillCooldowns[id] = 0;
      pushLog(state, `技能解锁：${skill.name}`);
    }
  }
  for (const [id, module] of Object.entries(MODULE_DEFINITIONS)) {
    if (state.highestNode >= module.unlockNode && !state.unlocked.modules.includes(id)) {
      state.unlocked.modules.push(id);
      pushLog(state, `模块获得：${module.name}`);
    }
  }
}

function moveAfterKill(state) {
  // Legacy callers may still set region/node directly; use the furthest compatible position during migration.
  const currentDepth = Math.max(state.depth ?? 1, state.region * 10 + Math.min(state.node, 10));
  const nextDepth = currentDepth === FIRST_GUARDIAN_DEPTH ? currentDepth : currentDepth + 1;
  state.depth = nextDepth;
  state.region = getDepthRegion(nextDepth);
  state.node = getDepthNode(nextDepth);
  const modifiers = getSectorModifiers(state);
  if (nextDepth === FIRST_GUARDIAN_DEPTH || isGuardianDepth(nextDepth)) {
    state.node = 11;
    state.enemy = createDepthGuardian(nextDepth, state.research.totalPoints + 1, modifiers);
    pushLog(state, `法则守卫出现：${state.enemy.name} Lv.${state.enemy.level}`);
  } else {
    state.enemy = createDepthEnemy(nextDepth, modifiers);
    if (getDepthNode(nextDepth) === 1) pushLog(state, `区域突破：${REGION_DEFINITIONS[state.region].name}`);
  }
  state.highestNode = Math.max(state.highestNode, state.depth);
  state.bestDepth = Math.max(state.bestDepth ?? 1, state.depth);
  state.journey.peakDepth = Math.max(state.journey.peakDepth, state.depth);
  // 途中事件不强制打断挂机；过路不领取时，下一个补给点会替换旧卡片。
  if (nextDepth >= 15 && nextDepth % 10 === 5) state.run.expedition = { depth: nextDepth, choice: null };
  updateUnlocks(state);
}

function grantKill(state, source = 'attack') {
  if (state.enemy.isBoss) {
    const defeatedName = state.enemy.name;
    const defeatedId = state.enemy.id;
    state.enemy.health = 0;
    state.depth = Math.max(FIRST_GUARDIAN_DEPTH, state.depth ?? 1);
    state.bestDepth = Math.max(state.bestDepth ?? 1, state.depth);
    // 一轮只能结算一名永久守卫，剩余攻击必须停在稳定态，不能穿透到下一层。
    state.run.awaitingReforge = true;
    state.run.awaitingDecision = true;
    state.run.bosses += 1;
    state.run.guardiansDefeated += 1;
    state.run.lockedDepth = Math.max(state.run.lockedDepth ?? 0, state.depth);
    state.lifetime.bosses += 1;
    recordGuardianVictory(state, defeatedId);
    const researchGain = getSectorModifiers(state).research;
    state.research.points += researchGain;
    state.research.totalPoints += researchGain;
    if (!state.research.discoveredGuardians.includes(defeatedId)) {
      state.research.discoveredGuardians.push(defeatedId);
    }
    if (state.challenges.active) {
      const completedId = state.challenges.active;
      const currentRank = state.challenges.ranks[completedId] ?? 0;
      state.challenges.progress += 1;
      if (state.challenges.progress >= currentRank + 1) {
        state.challenges.ranks[completedId] = currentRank + 1;
        state.challenges.active = null;
        state.challenges.progress = 0;
        if (currentRank + 1 >= 5 && !state.challenges.completed.includes(completedId)) {
          state.challenges.completed.push(completedId);
        }
        pushLog(state, `法则试炼晋阶：${CHALLENGE_DEFINITIONS[completedId].name} Rank ${currentRank + 1}。`);
      }
    }
    state.completed = true;
    state.highestNode = Math.max(state.highestNode, state.depth);
    if (state.run.currentLaw) {
      // Risk is earned only after surviving the full sector; selecting a law cannot be cashed out immediately.
      state.run.riskProduct = finiteValue(
        state.run.riskProduct * SECTOR_LAW_DEFINITIONS[state.run.currentLaw].riskMultiplier,
        MAX_FINITE_VALUE,
      );
    }
    state.run.currentLaw = null;
    state.run.lawChoices = getSectorLawChoices(state.depth);
    state.run.lockedCoreGain = Math.max(state.run.lockedCoreGain, getReforgeGain(state));
    updateUnlocks(state);
    pushLog(state, `${defeatedName}被击溃。选择新区段法则继续深潜，或立即重铸。`);
    return { type: 'bossDefeated', reward: 0, source };
  }

  const definition = REGION_DEFINITIONS[getDepthRegion(state.depth ?? 1)];
  const reward = Math.round(
    definition.rewardBase * 1.18 ** (getDepthNode(state.depth ?? 1) - 1)
      * (1 + Math.max(0, Math.min(state.depth ?? 1, FIRST_GUARDIAN_DEPTH) - 3) * 0.22)
      * getDepthHealthScale(state.depth ?? 1) * deriveStats(state).entropyMultiplier,
  );
  state.entropy = finiteValue(state.entropy + reward, MAX_FINITE_VALUE);
  state.run.entropyEarned = finiteValue(state.run.entropyEarned + reward, MAX_FINITE_VALUE);
  state.lifetime.entropyEarned = finiteValue(state.lifetime.entropyEarned + reward, MAX_FINITE_VALUE);
  state.run.kills += 1;
  moveAfterKill(state);
  return { type: 'kill', reward, source };
}

function criticalMultiplier(stats, randomValue) {
  // Each full 100% creates a guaranteed tier; the remainder rolls the next tier.
  const guaranteedTiers = Math.floor(stats.critChance);
  const extraTier = randomValue < stats.critChance % 1 ? 1 : 0;
  const tiers = guaranteedTiers + extraTier;
  return { tiers, multiplier: tiers > 0 ? finiteValue(stats.critDamage ** tiers, MAX_FINITE_VALUE) : 1 };
}

function reduceCooldowns(state, seconds, exceptId = null) {
  for (const id of Object.keys(state.skillCooldowns)) {
    if (id !== exceptId) state.skillCooldowns[id] = Math.max(0, state.skillCooldowns[id] - seconds);
  }
}

function applyDamage(state, damage, source) {
  if (state.run.awaitingDecision || state.run.awaitingReforge) return null;
  let bossMultiplier = state.enemy.isBoss ? 1 + (state.enemy.vulnerability ?? 0) : 1;
  if (state.enemy.id === 'mirror-guardian' || (state.enemy.isBoss && getSectorModifiers(state).mirrorGuardian)) {
    const isSkill = Object.hasOwn(SKILL_DEFINITIONS, source);
    bossMultiplier = (state.enemy.phase === 'skill') === isSkill ? 1.5 : 0.35;
  }
  if (state.enemy.id === 'entropy-guardian' || getSectorModifiers(state).entropyAdaptation) {
    // 熵守卫会适应连续相同来源，主动切换攻击、技能或模块才能保持输出。
    if (state.enemy.lastDamageSource === source) {
      state.enemy.entropyResistance = Math.min(0.5, (state.enemy.entropyResistance ?? 0) + 0.05);
    } else {
      state.enemy.lastDamageSource = source;
      state.enemy.entropyResistance = 0;
    }
    bossMultiplier = 1 - state.enemy.entropyResistance;
  }
  if (state.enemy.isBoss) bossMultiplier *= deriveStats(state).bossDamageMultiplier;
  const applied = finiteValue(damage * bossMultiplier, MAX_FINITE_VALUE);
  state.enemy.health = finiteValue(state.enemy.health - applied, 0);
  state.run.damage = finiteValue(state.run.damage + applied, MAX_FINITE_VALUE);
  if (state.enemy.health <= 0) return grantKill(state, source);
  return null;
}

function performAttack(state, randomValues, cursor, damageMultiplier = 1) {
  if (state.run.awaitingDecision || state.run.awaitingReforge) return [];
  const stats = deriveStats(state);
  const critical = criticalMultiplier(stats, nextRandom(randomValues, cursor));
  const attackNumber = state.run.attacks + 1;
  const focused = state.equippedModules.includes('singularityLens') && attackNumber % 12 === 0;
  const damage = finiteValue(
    stats.attack * critical.multiplier * (focused ? 20 : 1) * damageMultiplier,
    MAX_FINITE_VALUE,
  );
  const events = [];

  state.run.attacks += 1;
  const silenceRank = state.challenges?.ranks?.silence
    ?? (state.challenges?.completed.includes('silence') ? 1 : 0);
  if (silenceRank > 0) reduceCooldowns(state, 0.01 * silenceRank);
  if (critical.tiers > 0) {
    state.run.criticalHits += 1;
    if (state.equippedModules.includes('timeCapacitor')) reduceCooldowns(state, 0.1);
  }
  if (state.equippedModules.includes('resonanceCore') && state.run.attacks % 10 === 0) {
    state.effects.resonanceStacks += 1;
    events.push({ type: 'resonance', stacks: state.effects.resonanceStacks });
    const resonanceDamage = finiteValue(stats.attack * 3 * stats.resonanceMultiplier * getBuildModifiers(state).resonance, MAX_FINITE_VALUE);
    const resonanceKill = applyDamage(state, resonanceDamage, 'resonance');
    events.push({ type: 'resonanceDamage', damage: resonanceDamage });
    if (resonanceKill) events.push(resonanceKill);
  }
  if (state.enemy.isBoss) state.enemy.vulnerability = Math.min(2, state.enemy.vulnerability + 0.04);

  const kill = applyDamage(state, damage, 'attack');
  events.push({ type: focused ? 'focusedAttack' : 'attack', damage, criticalTier: critical.tiers });
  if (kill) events.push(kill);

  if (!kill && critical.tiers > 0 && state.equippedModules.includes('fractureLens')
      && nextRandom(randomValues, cursor) < getBuildModifiers(state).echoChance) {
    const echoKill = applyDamage(state, damage, 'criticalEcho');
    events.push({ type: 'criticalEcho', damage });
    if (echoKill) events.push(echoKill);
  }
  return events;
}

export function manualAttack(state, randomValues = [], options = {}) {
  if (state.run.awaitingDecision || state.run.awaitingReforge || options.repeated || (state.effects.manualPulseCooldown ?? 0) > 0) {
    return { attacked: false, events: [] };
  }
  const cursor = { index: 0 };
  const events = [];
  // 用游戏时间限制输入频率，避免触屏连发器或浏览器合成事件在同一帧重复充能。
  state.effects.manualPulseCooldown = 0.12;
  if ((state.effects.overdriveTime ?? 0) <= 0) {
    state.effects.overdriveCharge = Math.min(100, (state.effects.overdriveCharge ?? 0) + 5);
    if (state.effects.overdriveCharge >= 100) {
      state.effects.overdriveCharge = 0;
      state.effects.overdriveTime = 10;
      events.push({ type: 'overdriveStarted' });
    }
  }
  const stats = deriveStats(state);
  const strikeCount = stats.multiStrike;
  // 主动脉冲折算为有限的短时自动输出，后期仍有价值但不会随极端攻速无限膨胀。
  const manualMultiplier = Math.min(4, (1 + Math.sqrt(stats.attackSpeed) * 0.35) * getSectorModifiers(state).manual);
  for (let strike = 0; strike < strikeCount; strike += 1) {
    events.push(...performAttack(state, randomValues, cursor, manualMultiplier));
  }
  const directDamage = events
    .filter((event) => event.type === 'attack' || event.type === 'focusedAttack')
    .reduce((total, event) => total + event.damage, 0);
  const criticalTier = Math.max(0, ...events.map((event) => event.criticalTier ?? 0));
  // Manual input uses the complete attack pipeline, so crits, modules and multi-strike stay consistent with automation.
  return { attacked: true, events: [{ type: 'manualPulse', damage: directDamage, criticalTier }, ...events] };
}

export function toggleModule(state, id) {
  if (!state.unlocked.modules.includes(id) || !MODULE_DEFINITIONS[id]) return { equipped: false };
  const index = state.equippedModules.indexOf(id);
  if (index >= 0) {
    state.equippedModules.splice(index, 1);
    return { equipped: false };
  }
  if (state.equippedModules.length >= getModuleSlotCount(state)) return { equipped: false, full: true };
  state.equippedModules.push(id);
  return { equipped: true };
}

export function activateSkill(state, id) {
  const skill = SKILL_DEFINITIONS[id];
  if (!skill || state.run.awaitingDecision || state.run.awaitingReforge
      || getSectorModifiers(state).skillsDisabled || state.challenges?.active === 'silence'
      || !state.unlocked.skills.includes(id) || (state.skillCooldowns[id] ?? 0) > 0) {
    return { activated: false, events: [] };
  }

  const stats = deriveStats(state);
  const events = [];
  state.skillCooldowns[id] = skill.cooldown * stats.cooldownMultiplier;
  if (id === 'overload') state.effects.overload = skill.duration;
  if (id === 'singularityCannon') {
    const damage = finiteValue(stats.attack * stats.skillPower * 10 * getBuildModifiers(state).cannon, MAX_FINITE_VALUE);
    const kill = applyDamage(state, damage, id);
    events.push({ type: 'skillDamage', skill: id, damage });
    if (kill) {
      events.push(kill);
      if (state.equippedModules.includes('entropyRecycler')) state.skillCooldowns[id] *= 0.7;
    }
  }
  if (id === 'timeFold') {
    for (const otherId of Object.keys(state.skillCooldowns)) {
      if (otherId !== id) state.skillCooldowns[otherId] *= 0.7;
    }
    if (getBuildModifiers(state).foldReset && state.unlocked.skills.includes('singularityCannon')) {
      state.skillCooldowns.singularityCannon = 0;
    }
  }
  return { activated: true, events };
}

function updateTimers(state, elapsedSeconds) {
  reduceCooldowns(state, elapsedSeconds);
  state.effects.overload = Math.max(0, state.effects.overload - elapsedSeconds);
  state.effects.overdriveTime = Math.max(0, (state.effects.overdriveTime ?? 0) - elapsedSeconds);
  state.effects.manualPulseCooldown = Math.max(0, (state.effects.manualPulseCooldown ?? 0) - elapsedSeconds);
  if (state.enemy.isBoss) {
    state.enemy.pulseTimer -= elapsedSeconds;
    // 区段镜面覆盖原生机制，共享计时器不能先被重力收束重置。
    if (state.enemy.id === 'gravity-guardian' && !state.enemy.mirrorSector && state.enemy.pulseTimer <= 0) {
      state.enemy.vulnerability *= 0.35;
      state.enemy.pulseTimer += 12;
    }
    if ((state.enemy.id === 'mirror-guardian' || state.enemy.mirrorSector) && state.enemy.pulseTimer <= 0) {
      state.enemy.phase = state.enemy.phase === 'skill' ? 'attack' : 'skill';
      state.enemy.pulseTimer += 8;
    }
  }
}

function runAutoBuy(state) {
  if (!state.unlocked.autoBuy || !state.settings.autoBuy) return;
  const priorities = {
    damage: ['attack', 'speed', 'critChance', 'critDamage', 'multiStrike', 'skillPower'],
    economy: ['entropy', 'global', 'reforgeEfficiency', 'bossReward'],
  };
  const preferred = priorities[state.settings.autoBuyPriority] ?? [];
  const available = Object.entries(UPGRADE_DEFINITIONS)
    .filter(([, definition]) => definition.unlockNode <= state.highestNode)
    .sort(([a], [b]) => {
      const aRank = preferred.includes(a) ? preferred.indexOf(a) : preferred.length;
      const bRank = preferred.includes(b) ? preferred.indexOf(b) : preferred.length;
      return aRank - bRank || getUpgradeCost(state, a) - getUpgradeCost(state, b);
    });
  if (available[0]) buyUpgrade(state, available[0][0], 1);
}

function appendReportedEvents(target, source) {
  // 普通攻击已计入状态统计，不再逐条上报；界面只需要最近的关键战斗反馈。
  for (const event of source) if (event.type !== 'attack') target.push(event);
  if (target.length > MAX_REPORTED_EVENTS * 2) {
    target.splice(0, target.length - MAX_REPORTED_EVENTS);
  }
}

function advanceStep(state, elapsedSeconds, randomValues, cursor) {
  const events = [];
  // 守卫决策不是战斗时间；停在这里不会让刚积攒的技能/超载在读卡时消失。
  if (state.run.awaitingDecision || state.run.awaitingReforge) return events;
  updateTimers(state, elapsedSeconds);
  runAutoBuy(state);

  updateUnlocks(state);
  if (state.run.awaitingDecision || state.run.awaitingReforge) return events;

  if (state.unlocked.autoSkills && state.settings.autoSkills) {
    for (const id of state.unlocked.skills) {
      if ((state.skillCooldowns[id] ?? 0) <= 0) {
        const result = activateSkill(state, id);
        appendReportedEvents(events, result.events);
      }
    }
  }

  const stats = deriveStats(state);
  state.run.activeSeconds += elapsedSeconds;
  state.enemy.aliveSeconds += elapsedSeconds;
  if (!state.unlocked.autoAttack) return events;
  state.run.attackAccumulator += elapsedSeconds * stats.attackSpeed;
  const attackCount = Math.min(50_000, Math.floor(state.run.attackAccumulator + 1e-9));
  state.run.attackAccumulator -= attackCount;
  for (let index = 0; index < attackCount; index += 1) {
    for (let strike = 0; strike < stats.multiStrike; strike += 1) {
      appendReportedEvents(events, performAttack(state, randomValues, cursor));
    }
  }
  return events.slice(-MAX_REPORTED_EVENTS);
}

export function advanceGame(state, elapsedSeconds, randomValues = []) {
  // Active time is capped and subdivided so temporary effects and Boss timers remain ordered.
  const simulatedSeconds = Math.max(0, Math.min(elapsedSeconds, ACTIVE_STEP_LIMIT));
  const cursor = { index: 0 };
  const events = [];
  let remaining = simulatedSeconds;
  while (remaining > 0) {
    const step = Math.min(0.25, remaining);
    appendReportedEvents(events, advanceStep(state, step, randomValues, cursor));
    remaining -= step;
  }
  return { simulatedSeconds, events: events.slice(-MAX_REPORTED_EVENTS) };
}

export function getAutomationGoal(state) {
  const current = Math.min(12, state.bestDepth ?? 1);
  return { id: 'pulseDrone', label: '脉冲无人机', current, target: 12, unlocked: Boolean(state.unlocked.autoAttack) };
}

export function continueDeepDive(state, lawId) {
  if (!state.run.awaitingDecision || !state.run.lawChoices.includes(lawId)) return { continued: false, reason: 'invalid-law' };
  const law = SECTOR_LAW_DEFINITIONS[lawId];
  state.run.currentLaw = lawId;
  state.run.buildCommitted = true;
  // The selected law remains pending until its guardian falls, preventing risk-free reward farming.
  state.run.awaitingDecision = false;
  state.run.awaitingReforge = false;
  state.run.lawChoices = [];
  state.completed = false;
  state.depth += 1;
  state.region = getDepthRegion(state.depth);
  state.node = getDepthNode(state.depth);
  state.enemy = createDepthEnemy(state.depth, getSectorModifiers(state));
  state.highestNode = Math.max(state.highestNode, state.depth);
  state.bestDepth = Math.max(state.bestDepth, state.depth);
  pushLog(state, `区段法则已锁定：${law.name}。继续深潜至深度 ${state.depth}。`);
  updateUnlocks(state);
  return { continued: true };
}

export function getReforgeGainBreakdown(state) {
  const legacyDepth = Math.min(FIRST_GUARDIAN_DEPTH, state.highestNode ?? 1);
  const highestDepth = Math.max(state.bestDepth ?? 1, state.depth ?? 1, legacyDepth);
  const defeatedGuardians = Math.max(state.run.guardiansDefeated ?? 0, state.run.bosses ?? 0);
  // New saves track the exact defeated checkpoint; legacy saves fall back to their prior completed frontier.
  const settledDepth = state.run.lockedDepth > 0
    ? state.run.lockedDepth
    : defeatedGuardians > 0 ? highestDepth : 0;
  const rewardedDepth = Math.min(highestDepth, settledDepth);
  const checkpoint = Math.max(0, Math.floor((rewardedDepth - FIRST_GUARDIAN_DEPTH) / 10));
  const depthReward = rewardedDepth >= FIRST_GUARDIAN_DEPTH ? 12 * 1.65 ** checkpoint : 0;
  const streakMultiplier = Math.min(2.5, 1 + 0.08 * Math.max(0, (state.run.guardiansDefeated ?? 0) - 1));
  const riskMultiplier = Math.max(1, finiteValue(state.run.riskProduct ?? 1, 1e50));
  const protocolMultiplier = finiteValue(
    // 守卫奖励协议必须进入实际炉心结算，不能只改变遥测里无人消费的倍率。
    (1 + (state.upgrades.reforgeEfficiency ?? 0) * 0.2) * 1.2 ** (state.techs?.reforgeLattice ?? 0)
      * deriveStats(state).bossRewardMultiplier,
    1e50,
  );
  const calculated = Math.floor(finiteValue(depthReward * streakMultiplier * riskMultiplier * protocolMultiplier, MAX_FINITE_VALUE));
  return {
    checkpoint, depthReward, streakMultiplier, riskMultiplier, protocolMultiplier,
    total: Math.max(state.run.lockedCoreGain ?? 0, calculated),
  };
}

export function getReforgeGain(state) {
  return getReforgeGainBreakdown(state).total;
}

export function saveBuildPreset(state, slot = 0) {
  if (slot !== 0 || (state.lifetime?.reforges ?? 0) < 1) return { saved: false };
  state.buildPresets[0] = {
    modules: [...state.equippedModules],
    autoBuyPriority: state.settings.autoBuyPriority,
    autoBuy: state.settings.autoBuy,
    autoSkills: state.settings.autoSkills,
    specialization: state.journey.specialization,
  };
  return { saved: true };
}

export function loadBuildPreset(state, slot = 0) {
  const preset = state.buildPresets?.[slot];
  if (slot !== 0 || !preset || !Array.isArray(preset.modules)) return { loaded: false };
  // 专精是区段选择；预设不能成为绕过锁定的后门，也不能只应用一半构筑。
  if (preset.specialization && preset.specialization !== state.journey.specialization
      && !chooseSpecialization(state, preset.specialization).chosen) return { loaded: false, reason: 'build-locked' };
  state.equippedModules = preset.modules.filter((id) => state.unlocked.modules.includes(id)).slice(0, getModuleSlotCount(state));
  state.settings.autoBuyPriority = ['cheapest', 'damage', 'economy'].includes(preset.autoBuyPriority)
    ? preset.autoBuyPriority : 'cheapest';
  state.settings.autoBuy = Boolean(preset.autoBuy && state.unlocked.autoBuy);
  state.settings.autoSkills = Boolean(preset.autoSkills && state.unlocked.autoSkills);
  return { loaded: true };
}

export function reforge(state) {
  const gain = getReforgeGain(state);
  if (gain < 1) return state;
  const next = createGameState();
  next.coreShards = state.coreShards + gain;
  next.totalCoreShards = state.totalCoreShards + gain;
  next.unlocked.skills = [...state.unlocked.skills];
  next.unlocked.modules = [...state.unlocked.modules];
  next.unlocked.autoAttack = state.unlocked.autoAttack;
  next.unlocked.autoBuy = next.totalCoreShards >= 12;
  next.coreUpgrades = { ...state.coreUpgrades };
  next.techs = { ...state.techs };
  next.research = {
    ...state.research,
    discoveredGuardians: [...state.research.discoveredGuardians],
  };
  next.challenges = {
    // 试炼考察连续完整轮次；只有主动取消才会清空激活态和进度。
    active: state.challenges.active,
    progress: state.challenges.progress,
    ranks: { ...state.challenges.ranks },
    completed: [...state.challenges.completed],
  };
  next.unlocked.autoSkills = next.coreUpgrades.autoSkills > 0;
  next.skillCooldowns = Object.fromEntries(next.unlocked.skills.map((id) => [id, 0]));
  next.lifetime = { ...state.lifetime, reforges: state.lifetime.reforges + 1 };
  next.journey = normalizeJourney(state);
  next.buildPresets = [...(state.buildPresets ?? [null])];
  next.logs = [`重铸完成：获得 ${gain} 枚炉心碎片。`, ...state.logs].slice(0, 30);
  return next;
}

export function serializeGame(state) {
  const invalidEnemy = !Number.isFinite(state.enemy?.health) || !Number.isFinite(state.enemy?.maxHealth);
  // 保存前重建溢出的当前目标，避免 Infinity 被 JSON 降级为 0 后白送击杀或制造软锁。
  const enemy = invalidEnemy
    ? (state.enemy?.isBoss
      ? createDepthGuardian(state.depth ?? FIRST_GUARDIAN_DEPTH, state.research.totalPoints + 1)
      : createDepthEnemy(state.depth ?? state.region * 10 + state.node))
    : state.enemy;
  // JSON 会把 Infinity/NaN 静默写成 null；保存前统一收敛，避免制造不可恢复存档。
  return JSON.stringify(
    { ...state, enemy, lastSavedAt: Date.now() },
    (_, value) => (typeof value === 'number' ? finiteValue(value) : value),
  );
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasFiniteFields(record, keys) {
  return isRecord(record) && keys.every((key) => Number.isFinite(record[key]) && record[key] >= 0);
}

function usesKnownIds(values, definitions) {
  return Array.isArray(values) && values.every((id) => Object.hasOwn(definitions, id));
}

function isValidSave(parsed) {
  const scalarNumbers = ['entropy', 'coreShards', 'totalCoreShards', 'region', 'node', 'highestNode', 'tutorialStep', 'lastSavedAt'];
  const runFields = ['attacks', 'criticalHits', 'kills', 'bosses', 'damage', 'entropyEarned', 'activeSeconds', 'attackAccumulator'];
  const lifetimeFields = ['reforges', 'entropyEarned', 'bosses'];
  const enemyFields = ['maxHealth', 'health', 'aliveSeconds'];
  if (!isRecord(parsed) || parsed.version !== 1 || !hasFiniteFields(parsed, scalarNumbers)) return false;
  if (parsed.depth !== undefined && (!Number.isInteger(parsed.depth) || parsed.depth < 1)) return false;
  if (parsed.bestDepth !== undefined && (!Number.isInteger(parsed.bestDepth) || parsed.bestDepth < 1)) return false;
  if (!Number.isInteger(parsed.region) || parsed.region < 0 || parsed.region >= REGION_DEFINITIONS.length) return false;
  if (!Number.isInteger(parsed.node) || parsed.node < 1 || parsed.node > 11 || typeof parsed.completed !== 'boolean') return false;
  if (!hasFiniteFields(parsed.upgrades, Object.keys(UPGRADE_DEFINITIONS))) return false;
  if (!isRecord(parsed.unlocked)
      || !usesKnownIds(parsed.unlocked.skills, SKILL_DEFINITIONS)
      || !usesKnownIds(parsed.unlocked.modules, MODULE_DEFINITIONS)
      || typeof parsed.unlocked.autoBuy !== 'boolean') return false;
  if (parsed.coreUpgrades !== undefined && !hasFiniteFields(parsed.coreUpgrades, Object.keys(CORE_UPGRADE_DEFINITIONS))) return false;
  if (parsed.techs !== undefined && !hasFiniteFields(parsed.techs, Object.keys(TECH_DEFINITIONS))) return false;
  if (parsed.research !== undefined
      && (!hasFiniteFields(parsed.research, ['points', 'totalPoints'])
        || !usesKnownIds(parsed.research.discoveredGuardians, Object.fromEntries(BOSS_DEFINITIONS.map((boss) => [boss.id, boss]))))) return false;
  if (parsed.challenges !== undefined
      && (!isRecord(parsed.challenges)
        || (parsed.challenges.active !== null && !Object.hasOwn(CHALLENGE_DEFINITIONS, parsed.challenges.active))
        || (parsed.challenges.progress !== undefined && (!Number.isFinite(parsed.challenges.progress) || parsed.challenges.progress < 0))
        || (parsed.challenges.ranks !== undefined && !hasFiniteFields(parsed.challenges.ranks, Object.keys(CHALLENGE_DEFINITIONS)))
        || !usesKnownIds(parsed.challenges.completed, CHALLENGE_DEFINITIONS))) return false;
  if (!usesKnownIds(parsed.equippedModules, MODULE_DEFINITIONS)
      || parsed.equippedModules.length > getModuleSlotCount(parsed)) return false;
  if (!isRecord(parsed.skillCooldowns)
      || !Object.entries(parsed.skillCooldowns).every(([id, value]) => Object.hasOwn(SKILL_DEFINITIONS, id) && Number.isFinite(value) && value >= 0)) return false;
  if (!hasFiniteFields(parsed.effects, ['overload', 'resonanceStacks'])) return false;
  if (!isRecord(parsed.settings)
      || ![1, 10, 'max'].includes(parsed.settings.buyAmount)
      || typeof parsed.settings.autoBuy !== 'boolean'
      || (parsed.settings.autoSkills !== undefined && typeof parsed.settings.autoSkills !== 'boolean')
      || typeof parsed.settings.reducedMotion !== 'boolean') return false;
  if (!hasFiniteFields(parsed.run, runFields) || !hasFiniteFields(parsed.lifetime, lifetimeFields)) return false;
  if (parsed.run.awaitingReforge !== undefined && typeof parsed.run.awaitingReforge !== 'boolean') return false;
  const repairableBoss = parsed.enemy?.isBoss === true
    && Number.isFinite(parsed.enemy.aliveSeconds)
    && (!Number.isFinite(parsed.enemy.health) || !Number.isFinite(parsed.enemy.maxHealth));
  if ((!hasFiniteFields(parsed.enemy, enemyFields) && !repairableBoss)
      || typeof parsed.enemy.id !== 'string'
      || typeof parsed.enemy.name !== 'string'
      || typeof parsed.enemy.isBoss !== 'boolean') return false;
  if (parsed.enemy.isBoss && (!Number.isFinite(parsed.enemy.vulnerability) || !Number.isFinite(parsed.enemy.pulseTimer))) return false;
  return Array.isArray(parsed.logs) && parsed.logs.every((entry) => typeof entry === 'string');
}

export function deserializeGame(raw) {
  const fallback = createGameState();
  try {
    const parsed = JSON.parse(raw);
    if (!isValidSave(parsed)) throw new Error('invalid save');
    const legacyDepth = parsed.enemy?.isBoss || parsed.node === 11
      ? FIRST_GUARDIAN_DEPTH
      : parsed.region * 10 + parsed.node;
    const restoredDepth = parsed.depth ?? legacyDepth;
    const restored = {
      ...fallback,
      ...parsed,
      depth: restoredDepth,
      bestDepth: Math.max(restoredDepth, parsed.bestDepth ?? Math.min(parsed.highestNode, FIRST_GUARDIAN_DEPTH)),
      upgrades: { ...fallback.upgrades, ...parsed.upgrades },
      coreUpgrades: { ...fallback.coreUpgrades, ...parsed.coreUpgrades },
      techs: { ...fallback.techs, ...parsed.techs },
      research: {
        ...fallback.research,
        ...parsed.research,
        discoveredGuardians: [...(parsed.research?.discoveredGuardians ?? [])],
      },
      challenges: {
        ...fallback.challenges,
        ...parsed.challenges,
        progress: parsed.challenges?.progress ?? 0,
        ranks: Object.fromEntries(Object.keys(CHALLENGE_DEFINITIONS).map((id) => [
          id,
          parsed.challenges?.ranks?.[id] ?? (parsed.challenges?.completed?.includes(id) ? 1 : 0),
        ])),
        // 旧版“完成一次”只迁移为 Rank 1，不能误标成新版 Rank 5 精通。
        completed: [...(parsed.challenges?.completed ?? [])].filter(
          (id) => (parsed.challenges?.ranks?.[id] ?? 1) >= 5,
        ),
      },
      unlocked: { ...fallback.unlocked, ...parsed.unlocked },
      settings: { ...fallback.settings, ...parsed.settings },
      effects: { ...fallback.effects, ...parsed.effects },
      run: { ...fallback.run, ...parsed.run },
      lifetime: { ...fallback.lifetime, ...parsed.lifetime },
      enemy: { ...fallback.enemy, ...parsed.enemy },
      logs: parsed.logs.slice(0, 30),
      equippedModules: parsed.equippedModules.slice(0, getModuleSlotCount({ ...fallback, ...parsed })),
      buildPresets: Array.isArray(parsed.buildPresets) ? parsed.buildPresets.slice(0, 1) : [null],
    };
    // The old stable state becomes the new explicit continue-or-reforge decision without losing progress.
    if (parsed.run.awaitingReforge && parsed.run.awaitingDecision === undefined) restored.run.awaitingDecision = true;
    if (restored.run.awaitingDecision && !restored.run.lockedDepth) restored.run.lockedDepth = restored.depth;
    // 新增字段局部归一化，避免坏的可选内容把旧资源和升级一起清空。
    restored.journey = normalizeJourney(restored);
    restored.run.lawChoices = usesKnownIds(restored.run.lawChoices, SECTOR_LAW_DEFINITIONS)
      ? [...new Set(restored.run.lawChoices)] : [];
    if (restored.run.awaitingDecision && restored.run.lawChoices.length !== 3) restored.run.lawChoices = getSectorLawChoices(restored.depth);
    restored.run.currentLaw = Object.hasOwn(SECTOR_LAW_DEFINITIONS, restored.run.currentLaw) ? restored.run.currentLaw : null;
    restored.run.sectorBuff = ['assault', 'salvage'].includes(restored.run.sectorBuff) ? restored.run.sectorBuff : null;
    const expedition = restored.run.expedition;
    restored.run.expedition = isRecord(expedition) && Number.isInteger(expedition.depth)
      && expedition.depth >= 15 && expedition.depth % 10 === 5 && expedition.depth <= restored.depth
      ? { depth: expedition.depth, choice: ['assault', 'salvage', 'archive'].includes(expedition.choice) ? expedition.choice : null } : null;
    restored.run.buildCommitted = Boolean(restored.run.buildCommitted);
    if (parsed.enemy.isBoss && (!Number.isFinite(parsed.enemy.health) || !Number.isFinite(parsed.enemy.maxHealth))) {
      // 仅重建损坏的运行态守卫，永久研究、科技和炉心协议保持原样。
      restored.enemy = createDepthGuardian(restored.depth, restored.research.totalPoints + 1, getSectorModifiers(restored));
    }
    // 老版本没有区段镜面标志：从已保存的合法法则恢复，不重置生命或已完成进度。
    if (restored.enemy.isBoss && getSectorModifiers(restored).mirrorGuardian) {
      restored.enemy.mirrorSector = true;
      restored.enemy.phase = ['attack', 'skill'].includes(restored.enemy.phase) ? restored.enemy.phase : 'attack';
      restored.enemy.pulseTimer = Math.min(8, Math.max(0, restored.enemy.pulseTimer));
    }
    return restored;
  } catch {
    fallback.logs = ['存档无法读取，已安全启动新的奇点熔炉。'];
    return fallback;
  }
}

function effectiveOfflineSeconds(elapsedSeconds) {
  const firstEightHours = Math.min(elapsedSeconds, 8 * 60 * 60) * 0.8;
  const nextSixteenHours = Math.min(Math.max(0, elapsedSeconds - 8 * 60 * 60), 16 * 60 * 60) * 0.5;
  const remaining = Math.max(0, elapsedSeconds - 24 * 60 * 60) * 0.2;
  return firstEightHours + nextSixteenHours + remaining;
}

export function applyOfflineProgress(state, now = Date.now()) {
  // Offline returns economy value at reduced efficiency and never simulates unbounded attacks.
  const elapsedSeconds = Math.min(72 * 60 * 60, Math.max(0, (now - state.lastSavedAt) / 1000));
  const effectiveSeconds = effectiveOfflineSeconds(elapsedSeconds);
  const stats = deriveStats(state);
  const entropyGained = Math.floor(finiteValue(
    effectiveSeconds * stats.attack * stats.attackSpeed * stats.entropyMultiplier * 0.5,
    MAX_FINITE_VALUE,
  ));
  state.entropy = finiteValue(state.entropy + entropyGained, MAX_FINITE_VALUE);
  state.run.entropyEarned = finiteValue(state.run.entropyEarned + entropyGained, MAX_FINITE_VALUE);
  state.lifetime.entropyEarned = finiteValue(state.lifetime.entropyEarned + entropyGained, MAX_FINITE_VALUE);
  state.lastSavedAt = now;
  if (entropyGained > 0) pushLog(state, `离线回收完成：获得 ${entropyGained} 熵晶。`);
  return { elapsedSeconds, effectiveSeconds, entropyGained };
}
