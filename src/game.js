const ACTIVE_STEP_LIMIT = 600;
const MAX_EQUIPPED_MODULES = 2;

export const REGION_DEFINITIONS = [
  { id: 'matter', name: '物质层', nodeName: '物质节点', healthBase: 8, rewardBase: 5 },
  { id: 'gravity', name: '重力井', nodeName: '重力节点', healthBase: 80, rewardBase: 28 },
  { id: 'entropy', name: '热寂边界', nodeName: '热力节点', healthBase: 820, rewardBase: 150 },
];

export const UPGRADE_DEFINITIONS = {
  attack: { name: '脉冲强度', description: '攻击力 ×1.167', baseCost: 10, growth: 1.16, unlockNode: 1 },
  speed: { name: '脉冲频率', description: '攻击速度 ×1.2', baseCost: 28, growth: 1.19, unlockNode: 3 },
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
  resonanceCore: { name: '共振核心', description: '每 10 次攻击获得 1% 攻速，并允许攻速突破上限', unlockNode: 12 },
  fractureLens: { name: '裂变镜片', description: '暴击有 20% 概率复制一次', unlockNode: 15 },
  timeCapacitor: { name: '时间电容', description: '每次暴击使所有技能冷却减少 0.1 秒', unlockNode: 18 },
  entropyRecycler: { name: '熵回收器', description: '技能击杀返还该技能 30% 冷却', unlockNode: 21 },
  overloadAmplifier: { name: '过载放大器', description: '超过 10/s 的攻速转化为技能伤害', unlockNode: 25 },
  singularityLens: { name: '奇点透镜', description: '每第 12 次攻击聚焦，造成 20 倍伤害', unlockNode: 28 },
};

function createEnemy(region, node) {
  const definition = REGION_DEFINITIONS[region] ?? REGION_DEFINITIONS.at(-1);
  const localNode = Math.min(node, 10);
  const health = Math.round(definition.healthBase * 1.42 ** (localNode - 1));
  return {
    id: `${definition.id}-${node}`,
    name: definition.nodeName,
    maxHealth: health,
    health,
    isBoss: false,
    aliveSeconds: 0,
  };
}

function createBoss(level = 1) {
  const health = Math.round(18_000 * 2.4 ** (level - 1));
  return {
    id: 'gravity-guardian', name: '重力守卫', maxHealth: health, health,
    isBoss: true, level, aliveSeconds: 0, vulnerability: 0, pulseTimer: 12,
  };
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
    completed: false,
    enemy: createEnemy(0, 1),
    upgrades: Object.fromEntries(Object.keys(UPGRADE_DEFINITIONS).map((id) => [id, 0])),
    unlocked: {
      skills: [],
      modules: [],
      autoBuy: false,
    },
    equippedModules: [],
    skillCooldowns: {},
    effects: { overload: 0, resonanceStacks: 0 },
    settings: {
      buyAmount: 1,
      autoBuy: false,
      autoSkills: false,
      reducedMotion: false,
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
    },
    lifetime: {
      reforges: 0,
      entropyEarned: 0,
      bosses: 0,
    },
    tutorialStep: 0,
    logs: ['奇点熔炉已点火。自动脉冲开始锁定法则节点。'],
    lastSavedAt: Date.now(),
  };
}

export function deriveStats(state) {
  const coreDamage = 1 + state.coreShards * 0.15;
  const coreEntropy = 1 + state.coreShards * 0.1;
  const globalMultiplier = 1.22 ** (state.upgrades.global ?? 0);
  const rawAttackSpeed = 1.2 ** (state.upgrades.speed ?? 0)
    * (state.effects.overload > 0 ? 2 : 1)
    * (1 + (state.effects.resonanceStacks ?? 0) * 0.01);
  const hasResonanceCore = state.equippedModules.includes('resonanceCore');
  const excessSpeed = Math.max(0, rawAttackSpeed - 10);
  return {
    attack: 1.167 ** (state.upgrades.attack ?? 0) * globalMultiplier * coreDamage,
    attackSpeed: hasResonanceCore ? rawAttackSpeed : Math.min(10, rawAttackSpeed),
    rawAttackSpeed,
    critChance: 0.05 + (state.upgrades.critChance ?? 0) * 0.05,
    critDamage: 2 + (state.upgrades.critDamage ?? 0) * 0.5,
    multiStrike: 1 + Math.floor((state.upgrades.multiStrike ?? 0) / 4),
    skillPower: 1.35 ** (state.upgrades.skillPower ?? 0)
      * (state.equippedModules.includes('overloadAmplifier') ? 1 + excessSpeed * 0.1 : 1),
    cooldownMultiplier: Math.max(0.25, 0.94 ** (state.upgrades.cooldown ?? 0)),
    entropyMultiplier: 1.45 ** (state.upgrades.entropy ?? 0) * globalMultiplier * coreEntropy,
    resonanceMultiplier: 1.5 ** (state.upgrades.resonance ?? 0),
    bossRewardMultiplier: 1.5 ** (state.upgrades.bossReward ?? 0),
  };
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
  if (state.node < 10) {
    state.node += 1;
    state.enemy = createEnemy(state.region, state.node);
  } else if (state.region < REGION_DEFINITIONS.length - 1) {
    state.region += 1;
    state.node = 1;
    state.enemy = createEnemy(state.region, state.node);
    pushLog(state, `区域突破：${REGION_DEFINITIONS[state.region].name}`);
  } else {
    state.node = 11;
    state.enemy = createBoss(state.run.bosses + 1);
    pushLog(state, '法则守卫出现：持续攻击可撕开它的重力防线。');
  }
  state.highestNode = Math.max(state.highestNode, state.region * 10 + state.node);
  updateUnlocks(state);
}

function grantKill(state, source = 'attack') {
  if (state.enemy.isBoss) {
    const reward = Math.round(5_000 * deriveStats(state).bossRewardMultiplier);
    state.entropy += reward;
    state.run.entropyEarned += reward;
    state.lifetime.entropyEarned += reward;
    state.run.bosses += 1;
    state.lifetime.bosses += 1;
    state.completed = true;
    state.highestNode = Math.max(state.highestNode, 31);
    state.enemy = createBoss(state.run.bosses + 1);
    pushLog(state, `重力守卫被击溃。获得 ${reward} 熵晶，重铸已就绪。`);
    return { type: 'bossDefeated', reward, source };
  }

  const definition = REGION_DEFINITIONS[state.region];
  const reward = Math.round(
    definition.rewardBase * 1.18 ** (state.node - 1) * deriveStats(state).entropyMultiplier,
  );
  state.entropy += reward;
  state.run.entropyEarned += reward;
  state.lifetime.entropyEarned += reward;
  state.run.kills += 1;
  moveAfterKill(state);
  return { type: 'kill', reward, source };
}

function criticalMultiplier(stats, randomValue) {
  // Each full 100% creates a guaranteed tier; the remainder rolls the next tier.
  const guaranteedTiers = Math.floor(stats.critChance);
  const extraTier = randomValue < stats.critChance % 1 ? 1 : 0;
  const tiers = guaranteedTiers + extraTier;
  return { tiers, multiplier: tiers > 0 ? stats.critDamage ** tiers : 1 };
}

function reduceCooldowns(state, seconds, exceptId = null) {
  for (const id of Object.keys(state.skillCooldowns)) {
    if (id !== exceptId) state.skillCooldowns[id] = Math.max(0, state.skillCooldowns[id] - seconds);
  }
}

function applyDamage(state, damage, source) {
  const bossMultiplier = state.enemy.isBoss ? 1 + state.enemy.vulnerability : 1;
  const applied = damage * bossMultiplier;
  state.enemy.health -= applied;
  state.run.damage += applied;
  if (state.enemy.health <= 0) return grantKill(state, source);
  return null;
}

function performAttack(state, randomValues, cursor) {
  const stats = deriveStats(state);
  const critical = criticalMultiplier(stats, nextRandom(randomValues, cursor));
  const attackNumber = state.run.attacks + 1;
  const focused = state.equippedModules.includes('singularityLens') && attackNumber % 12 === 0;
  const damage = stats.attack * critical.multiplier * (focused ? 20 : 1);
  const events = [];

  state.run.attacks += 1;
  if (critical.tiers > 0) {
    state.run.criticalHits += 1;
    if (state.equippedModules.includes('timeCapacitor')) reduceCooldowns(state, 0.1);
  }
  if (state.equippedModules.includes('resonanceCore') && state.run.attacks % 10 === 0) {
    state.effects.resonanceStacks += 1;
    events.push({ type: 'resonance', stacks: state.effects.resonanceStacks });
    const resonanceDamage = stats.attack * 3 * stats.resonanceMultiplier;
    const resonanceKill = applyDamage(state, resonanceDamage, 'resonance');
    events.push({ type: 'resonanceDamage', damage: resonanceDamage });
    if (resonanceKill) events.push(resonanceKill);
  }
  if (state.enemy.isBoss) state.enemy.vulnerability = Math.min(2, state.enemy.vulnerability + 0.04);

  const kill = applyDamage(state, damage, 'attack');
  events.push({ type: focused ? 'focusedAttack' : 'attack', damage, criticalTier: critical.tiers });
  if (kill) events.push(kill);

  if (!kill && critical.tiers > 0 && state.equippedModules.includes('fractureLens')
      && nextRandom(randomValues, cursor) < 0.2) {
    const echoKill = applyDamage(state, damage, 'criticalEcho');
    events.push({ type: 'criticalEcho', damage });
    if (echoKill) events.push(echoKill);
  }
  return events;
}

export function manualAttack(state, randomValues = []) {
  const cursor = { index: 0 };
  const events = [];
  const strikeCount = deriveStats(state).multiStrike;
  for (let strike = 0; strike < strikeCount; strike += 1) {
    events.push(...performAttack(state, randomValues, cursor));
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
  if (state.equippedModules.length >= MAX_EQUIPPED_MODULES) return { equipped: false, full: true };
  state.equippedModules.push(id);
  return { equipped: true };
}

export function activateSkill(state, id) {
  const skill = SKILL_DEFINITIONS[id];
  if (!skill || !state.unlocked.skills.includes(id) || (state.skillCooldowns[id] ?? 0) > 0) {
    return { activated: false, events: [] };
  }

  const stats = deriveStats(state);
  const events = [];
  state.skillCooldowns[id] = skill.cooldown * stats.cooldownMultiplier;
  if (id === 'overload') state.effects.overload = skill.duration;
  if (id === 'singularityCannon') {
    const damage = stats.attack * stats.skillPower * 10;
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
  }
  return { activated: true, events };
}

function updateTimers(state, elapsedSeconds) {
  reduceCooldowns(state, elapsedSeconds);
  state.effects.overload = Math.max(0, state.effects.overload - elapsedSeconds);
  if (state.enemy.isBoss) {
    state.enemy.pulseTimer -= elapsedSeconds;
    if (state.enemy.pulseTimer <= 0) {
      state.enemy.vulnerability *= 0.35;
      state.enemy.pulseTimer += 12;
    }
  }
}

function runAutoBuy(state) {
  if (!state.unlocked.autoBuy || !state.settings.autoBuy) return;
  const available = Object.entries(UPGRADE_DEFINITIONS)
    .filter(([, definition]) => definition.unlockNode <= state.highestNode)
    .sort(([a], [b]) => getUpgradeCost(state, a) - getUpgradeCost(state, b));
  if (available[0]) buyUpgrade(state, available[0][0], 1);
}

function advanceStep(state, elapsedSeconds, randomValues, cursor) {
  const events = [];
  updateTimers(state, elapsedSeconds);
  runAutoBuy(state);

  if (state.settings.autoSkills) {
    for (const id of state.unlocked.skills) {
      if ((state.skillCooldowns[id] ?? 0) <= 0) {
        const result = activateSkill(state, id);
        events.push(...result.events);
      }
    }
  }

  const stats = deriveStats(state);
  state.run.activeSeconds += elapsedSeconds;
  state.enemy.aliveSeconds += elapsedSeconds;
  state.run.attackAccumulator += elapsedSeconds * stats.attackSpeed;
  const attackCount = Math.min(50_000, Math.floor(state.run.attackAccumulator + 1e-9));
  state.run.attackAccumulator -= attackCount;
  for (let index = 0; index < attackCount; index += 1) {
    for (let strike = 0; strike < stats.multiStrike; strike += 1) {
      events.push(...performAttack(state, randomValues, cursor));
    }
  }
  return events;
}

export function advanceGame(state, elapsedSeconds, randomValues = []) {
  // Active time is capped and subdivided so temporary effects and Boss timers remain ordered.
  const simulatedSeconds = Math.max(0, Math.min(elapsedSeconds, ACTIVE_STEP_LIMIT));
  const cursor = { index: 0 };
  const events = [];
  let remaining = simulatedSeconds;
  while (remaining > 0) {
    const step = Math.min(0.25, remaining);
    events.push(...advanceStep(state, step, randomValues, cursor));
    remaining -= step;
  }
  return { simulatedSeconds, events };
}

export function getReforgeGain(state) {
  const progressGain = Math.floor(Math.max(0, state.highestNode - 10) / 4);
  const bossGain = state.run.bosses * 5;
  const efficiency = 1 + (state.upgrades.reforgeEfficiency ?? 0) * 0.2;
  return Math.floor((progressGain + bossGain) * efficiency);
}

export function reforge(state) {
  const gain = getReforgeGain(state);
  if (gain < 1) return state;
  const next = createGameState();
  next.coreShards = state.coreShards + gain;
  next.totalCoreShards = state.totalCoreShards + gain;
  next.unlocked.skills = [...state.unlocked.skills];
  next.unlocked.modules = [...state.unlocked.modules];
  next.unlocked.autoBuy = next.totalCoreShards >= 10;
  next.skillCooldowns = Object.fromEntries(next.unlocked.skills.map((id) => [id, 0]));
  next.lifetime = { ...state.lifetime, reforges: state.lifetime.reforges + 1 };
  next.logs = [`重铸完成：获得 ${gain} 枚炉心碎片。`, ...state.logs].slice(0, 30);
  return next;
}

export function serializeGame(state) {
  return JSON.stringify({ ...state, lastSavedAt: Date.now() });
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
  if (!Number.isInteger(parsed.region) || parsed.region < 0 || parsed.region >= REGION_DEFINITIONS.length) return false;
  if (!Number.isInteger(parsed.node) || parsed.node < 1 || parsed.node > 11 || typeof parsed.completed !== 'boolean') return false;
  if (!hasFiniteFields(parsed.upgrades, Object.keys(UPGRADE_DEFINITIONS))) return false;
  if (!isRecord(parsed.unlocked)
      || !usesKnownIds(parsed.unlocked.skills, SKILL_DEFINITIONS)
      || !usesKnownIds(parsed.unlocked.modules, MODULE_DEFINITIONS)
      || typeof parsed.unlocked.autoBuy !== 'boolean') return false;
  if (!usesKnownIds(parsed.equippedModules, MODULE_DEFINITIONS) || parsed.equippedModules.length > 2) return false;
  if (!isRecord(parsed.skillCooldowns)
      || !Object.entries(parsed.skillCooldowns).every(([id, value]) => Object.hasOwn(SKILL_DEFINITIONS, id) && Number.isFinite(value) && value >= 0)) return false;
  if (!hasFiniteFields(parsed.effects, ['overload', 'resonanceStacks'])) return false;
  if (!isRecord(parsed.settings)
      || ![1, 10, 'max'].includes(parsed.settings.buyAmount)
      || typeof parsed.settings.autoBuy !== 'boolean'
      || (parsed.settings.autoSkills !== undefined && typeof parsed.settings.autoSkills !== 'boolean')
      || typeof parsed.settings.reducedMotion !== 'boolean') return false;
  if (!hasFiniteFields(parsed.run, runFields) || !hasFiniteFields(parsed.lifetime, lifetimeFields)) return false;
  if (!hasFiniteFields(parsed.enemy, enemyFields)
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
    return {
      ...fallback,
      ...parsed,
      upgrades: { ...fallback.upgrades, ...parsed.upgrades },
      unlocked: { ...fallback.unlocked, ...parsed.unlocked },
      settings: { ...fallback.settings, ...parsed.settings },
      effects: { ...fallback.effects, ...parsed.effects },
      run: { ...fallback.run, ...parsed.run },
      lifetime: { ...fallback.lifetime, ...parsed.lifetime },
      enemy: { ...fallback.enemy, ...parsed.enemy },
      logs: parsed.logs.slice(0, 30),
      equippedModules: parsed.equippedModules.slice(0, 2),
    };
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
  const entropyGained = Math.floor(
    effectiveSeconds * stats.attack * stats.attackSpeed * stats.entropyMultiplier * 0.5,
  );
  state.entropy += entropyGained;
  state.run.entropyEarned += entropyGained;
  state.lifetime.entropyEarned += entropyGained;
  state.lastSavedAt = now;
  if (entropyGained > 0) pushLog(state, `离线回收完成：获得 ${entropyGained} 熵晶。`);
  return { elapsedSeconds, effectiveSeconds, entropyGained };
}
