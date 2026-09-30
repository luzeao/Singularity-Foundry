export const DEPTHS_PER_SECTOR = 10;
export const FIRST_GUARDIAN_DEPTH = 30;

const THEME_DEPTHS = 30;
const MAX_HEALTH_SCALE = 1e200;

export const SECTOR_LAW_DEFINITIONS = {
  massCollapse: {
    name: '质量坍缩', limitation: '敌人生命 ×1.7', bonus: '炉心 ×1.35', riskMultiplier: 1.35,
  },
  silenceProtocol: {
    name: '静默协议', limitation: '主动技能禁用', bonus: '主动脉冲 ×1.6 · 炉心 ×1.3', riskMultiplier: 1.3,
  },
  absoluteSequence: {
    name: '绝对时序', limitation: '自动攻速上限 1/s', bonus: '暴击率提高 · 炉心 ×1.25', riskMultiplier: 1.25,
  },
  mirrorCircuit: {
    name: '镜面回路', limitation: '守卫交替抵抗攻击与技能', bonus: '模块共鸣 · 炉心 ×1.2', riskMultiplier: 1.2,
  },
  entropyAdaptation: {
    name: '熵适应', limitation: '重复伤害来源逐步衰减', bonus: '切换来源 · 炉心 ×1.4', riskMultiplier: 1.4,
  },
};

function normalizeDepth(depth) {
  return Math.max(1, Math.floor(Number.isFinite(depth) ? depth : 1));
}

export function getDepthRegion(depth) {
  return Math.floor(((normalizeDepth(depth) - 1) % THEME_DEPTHS) / DEPTHS_PER_SECTOR);
}

export function getDepthNode(depth) {
  return ((normalizeDepth(depth) - 1) % DEPTHS_PER_SECTOR) + 1;
}

export function isGuardianDepth(depth) {
  const normalized = normalizeDepth(depth);
  return normalized >= FIRST_GUARDIAN_DEPTH && normalized % DEPTHS_PER_SECTOR === 0;
}

export function getDepthHealthScale(depth) {
  const completedThemeCycles = Math.floor((normalizeDepth(depth) - 1) / THEME_DEPTHS);
  // Deep runs must grow for years of play without ever producing Infinity in a save.
  return Math.min(MAX_HEALTH_SCALE, 1.9 ** completedThemeCycles);
}

export function getSectorLawChoices(depth) {
  const ids = Object.keys(SECTOR_LAW_DEFINITIONS);
  const offset = Math.floor(normalizeDepth(depth) / DEPTHS_PER_SECTOR) % ids.length;
  return [0, 1, 2].map((index) => ids[(offset + index * 2) % ids.length]);
}

export function getSectorModifiers(state) {
  const lawId = state?.run?.currentLaw;
  const base = {
    health: 1, core: 1, manual: 1, attackSpeedCap: Number.POSITIVE_INFINITY,
    critChance: 0, research: 1, mirrorGuardian: false, entropyAdaptation: false,
  };
  if (lawId === 'massCollapse') return { ...base, health: 1.7, core: 1.35 };
  if (lawId === 'silenceProtocol') return { ...base, core: 1.3, manual: 1.6, skillsDisabled: true };
  if (lawId === 'absoluteSequence') return { ...base, core: 1.25, attackSpeedCap: 1, critChance: 0.15, research: 2 };
  if (lawId === 'mirrorCircuit') return { ...base, core: 1.2, mirrorGuardian: true };
  if (lawId === 'entropyAdaptation') return { ...base, core: 1.4, entropyAdaptation: true };
  return base;
}
