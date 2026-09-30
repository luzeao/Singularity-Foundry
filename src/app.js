import {
  CORE_UPGRADE_DEFINITIONS,
  CHALLENGE_DEFINITIONS,
  CHALLENGE_RANK_UNLOCKS,
  MODULE_DEFINITIONS,
  REGION_DEFINITIONS,
  SKILL_DEFINITIONS,
  TECH_DEFINITIONS,
  UPGRADE_DEFINITIONS,
  activateSkill,
  advanceGame,
  applyOfflineProgress,
  buyCoreUpgrade,
  buyTech,
  cancelChallenge,
  buyUpgrade,
  createGameState,
  deserializeGame,
  deriveStats,
  continueDeepDive,
  getAutomationGoal,
  getReforgeGain,
  getReforgeGainBreakdown,
  getCoreUpgradeCost,
  getBossRuleText,
  getModuleSlotCount,
  getTechCost,
  getUpgradeCost,
  manualAttack,
  loadBuildPreset,
  reforge,
  saveBuildPreset,
  SECTOR_LAW_DEFINITIONS,
  serializeGame,
  startChallenge,
  toggleModule,
  BUILD_DEFINITIONS, RELIC_DEFINITIONS, EXPEDITION_REWARDS, ACHIEVEMENT_DEFINITIONS,
  chooseSpecialization, chooseExpeditionReward, claimAchievement, getJourneyGoals, getMasteryRank, getRelicRank,
} from './game.js';

const SAVE_KEY = 'singularity-foundry-save-v1';
const $ = (selector) => document.querySelector(selector);
const elements = {
  entropy: $('#entropy-value'), coreShards: $('#core-value'), research: $('#research-value'), runTime: $('#run-time'), saveState: $('#save-state'),
  nextGoal: $('#next-goal'), missionProgress: $('#mission-progress'), region: $('#region-label'), node: $('#node-label'),
  enemyName: $('#enemy-name'), enemyType: $('#enemy-type'), enemyHealth: $('#enemy-health'), enemyPercent: $('#enemy-percent'),
  healthFill: $('#health-fill'), healthTrack: $('.health-track'), enemyTimer: $('#enemy-timer'), bossRule: $('#boss-rule'),
  visual: $('#forge-visual'), callout: $('#combat-callout'), skillDock: $('#skill-dock'), upgrades: $('#upgrade-list'),
  overdriveMeter: $('#overdrive-meter'), overdriveFill: $('#overdrive-fill'), overdriveLabel: $('#overdrive-label'),
  skills: $('#skill-list'), modules: $('#module-list'), corePanel: $('#core-list'), moduleCount: $('#module-count'), buildLabel: $('#build-label'),
  statAttack: $('#stat-attack'), statSpeed: $('#stat-speed'), statCrit: $('#stat-crit'), statCritDamage: $('#stat-crit-damage'),
  statSkill: $('#stat-skill'), statResource: $('#stat-resource'), breakdown: $('#breakdown-list'),
  automation: $('#automation-card'), autoBuyControl: $('#auto-buy-control'), autoBuy: $('#auto-buy-toggle'),
  autoBuyPriorityControl: $('#auto-buy-priority-control'), autoBuyPriority: $('#auto-buy-priority'),
  autoSkillsControl: $('#auto-skills-control'), autoSkills: $('#auto-skills-toggle'), highestNode: $('#highest-node'),
  presetControl: $('#preset-control'), automationGoal: $('#automation-goal'),
  killCount: $('#kill-count'), damageCount: $('#damage-count'), reforgePreview: $('#reforge-preview'),
  reforgeHint: $('#reforge-hint'), reforgeButton: $('#reforge-button'), dialog: $('#reforge-dialog'),
  dialogGain: $('#dialog-gain'), confirmReforge: $('#confirm-reforge'), log: $('#event-log'), logCount: $('#log-count'),
  guardianDecision: $('#guardian-decision'), decisionSummary: $('#decision-summary'), lawChoices: $('#law-choices'),
  continueDive: $('#continue-dive'), decisionReforge: $('#decision-reforge'),
  decisionBuilds: $('#decision-builds'),
  exploration: $('#exploration-list'), collection: $('#collection-list'), journeyGoals: $('#journey-goals'),
  expeditionNotice: $('#expedition-notice'), offlineSummary: $('#offline-summary'), offlineMessage: $('#offline-message'),
};

let offlineReturn = null;
let lastContentKey = '';
let lastLawChoicesKey = '';
let saveFailed = false;
let state = loadGame();
let activeTab = 'upgrades';
let lastFrame = performance.now();
let lastRender = 0;
let selectedLawId = null;

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  const loaded = raw ? deserializeGame(raw) : createGameState();
  const result = applyOfflineProgress(loaded);
  if (result.elapsedSeconds >= 60 && result.entropyGained > 0) offlineReturn = result;
  return loaded;
}

function saveGame() {
  state.lastSavedAt = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, serializeGame(state));
    saveFailed = false;
  } catch {
    // 隐私模式或存储额度不足不能打断战斗；明确提示本轮尚未持久化。
    saveFailed = true;
    elements.saveState.textContent = '保存失败 · 请保留页面';
    elements.callout.textContent = '浏览器无法保存进度，请保留页面并检查存储权限或剩余空间。';
    return false;
  }
  elements.saveState.textContent = '已保存';
  window.setTimeout(() => { if (!saveFailed) elements.saveState.textContent = '熔炉在线'; }, 900);
  return true;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return '∞';
  const absolute = Math.abs(value);
  if (absolute < 1_000) return value < 10 ? value.toFixed(2).replace(/\.00$/, '') : Math.floor(value).toLocaleString('zh-CN');
  const units = [['T', 1e12], ['B', 1e9], ['M', 1e6], ['K', 1e3]];
  for (const [suffix, size] of units) if (absolute >= size && absolute < 1e15) return `${(value / size).toFixed(2)}${suffix}`;
  return value.toExponential(2).replace('+', '');
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function nextUnlock() {
  if (state.run.awaitingDecision) {
    return { text: `深度 ${state.depth} 守卫已击破：选择下一法则或立即重铸`, progress: 1 };
  }
  const candidates = [
    ...Object.values(UPGRADE_DEFINITIONS).map((item) => ({ ...item, kind: '升级' })),
    ...Object.values(SKILL_DEFINITIONS).map((item) => ({ ...item, kind: '技能' })),
    ...Object.values(MODULE_DEFINITIONS).map((item) => ({ ...item, kind: '模块' })),
  ].filter((item) => item.unlockNode > state.highestNode).sort((a, b) => a.unlockNode - b.unlockNode);
  if (candidates[0]) return { text: `推进至节点 ${candidates[0].unlockNode}：解锁${candidates[0].kind}「${candidates[0].name}」`, progress: state.highestNode / candidates[0].unlockNode };
  if (!state.completed) return { text: '突破热寂边界，唤醒重力守卫', progress: Math.min(1, state.highestNode / 31) };
  if (state.challenges.active) {
    const rank = state.challenges.ranks[state.challenges.active] ?? 0;
    return {
      text: `${CHALLENGE_DEFINITIONS[state.challenges.active].name} ${rank + 1}阶：${state.challenges.progress}/${rank + 1} 名守卫`,
      progress: state.challenges.progress / (rank + 1),
    };
  }
  const availableTrial = Object.keys(CHALLENGE_DEFINITIONS).find((id) => {
    const rank = state.challenges.ranks[id] ?? 0;
    return rank < 5 && state.research.totalPoints >= CHALLENGE_RANK_UNLOCKS[id][rank];
  });
  if (availableTrial) {
    const rank = state.challenges.ranks[availableTrial] ?? 0;
    return { text: `可挑战：${CHALLENGE_DEFINITIONS[availableTrial].name} ${rank + 1}阶`, progress: 1 };
  }
  const nextMilestone = Object.keys(CHALLENGE_DEFINITIONS).map((id) => {
    const rank = state.challenges.ranks[id] ?? 0;
    return rank < 5 ? { id, rank, requirement: CHALLENGE_RANK_UNLOCKS[id][rank] } : null;
  }).filter(Boolean).sort((a, b) => a.requirement - b.requirement)[0];
  if (nextMilestone) {
    return {
      text: `击败 Lv.${state.research.totalPoints + 1} 法则守卫：${nextMilestone.requirement} 研究点解锁${CHALLENGE_DEFINITIONS[nextMilestone.id].name} ${nextMilestone.rank + 1}阶`,
      progress: state.research.totalPoints / nextMilestone.requirement,
    };
  }
  return { text: `挑战 Lv.${state.research.totalPoints + 1} 永续法则守卫`, progress: 1 - state.enemy.health / state.enemy.maxHealth };
}

function buildName(stats) {
  const specialization = BUILD_DEFINITIONS[state.journey.specialization];
  if (specialization && state.equippedModules.includes(specialization.module)) return specialization.name;
  const scores = [
    ['共振流', stats.attackSpeed / 3 + (state.equippedModules.includes('resonanceCore') ? 4 : 0)],
    ['断裂流', stats.critChance * 5 + (state.equippedModules.includes('fractureLens') ? 4 : 0)],
    ['过载流', stats.skillPower * 1.5 + state.unlocked.skills.length + (state.equippedModules.includes('timeCapacitor') ? 3 : 0)],
  ].sort((a, b) => b[1] - a[1]);
  return state.highestNode < 6 ? '未定型' : buildNameLabel(scores);
}

function buildNameLabel(scores) {
  if (scores[0][1] - scores[1][1] < 1.4) return '混合引擎';
  return scores[0][0];
}

function renderStats(stats) {
  elements.statAttack.textContent = formatNumber(stats.attack);
  elements.statSpeed.textContent = `${formatNumber(stats.attackSpeed)}/s`;
  elements.statCrit.textContent = `${formatNumber(stats.critChance * 100)}%`;
  elements.statCritDamage.textContent = `${formatNumber(stats.critDamage * 100)}%`;
  elements.statSkill.textContent = `×${formatNumber(stats.skillPower)}`;
  elements.statResource.textContent = `×${formatNumber(stats.entropyMultiplier)}`;
  elements.buildLabel.textContent = buildName(stats);
  const coreDamage = 1.35 ** state.coreUpgrades.damageMatrix;
  elements.breakdown.innerHTML = [
    ['基础脉冲', stats.attack / coreDamage],
    ['炉心协议', coreDamage],
    ['多重攻击', stats.multiStrike],
    ['预计 DPS', stats.attack * stats.attackSpeed * stats.multiStrike],
  ].map(([label, value]) => `<div class="breakdown-row"><span>${label}</span><strong>×${formatNumber(value)}</strong></div>`).join('');
}

function renderBattle() {
  const healthPercent = Math.max(0, Math.min(100, state.enemy.health / state.enemy.maxHealth * 100));
  elements.region.textContent = `区域 ${String(state.region + 1).padStart(2, '0')} · ${REGION_DEFINITIONS[state.region].name}`;
  elements.node.textContent = state.run.awaitingDecision
    ? `DEPTH ${state.depth} // 等待决策`
    : state.enemy.isBoss ? `DEPTH ${state.depth} // 法则守卫 Lv.${state.enemy.level ?? 1}` : `DEPTH ${state.depth} // NODE ${String(state.node).padStart(2, '0')}`;
  elements.enemyType.textContent = state.run.awaitingDecision ? '守卫已击破' : state.enemy.isBoss ? '法则守卫' : '法则节点';
  elements.enemyName.textContent = state.enemy.name;
  elements.enemyHealth.textContent = `${formatNumber(Math.max(0, state.enemy.health))} / ${formatNumber(state.enemy.maxHealth)}`;
  elements.enemyPercent.textContent = `${healthPercent.toFixed(1)}%`;
  elements.healthFill.style.width = `${healthPercent}%`;
  elements.healthTrack.setAttribute('aria-valuenow', String(Math.round(healthPercent)));
  elements.enemyTimer.textContent = `交战 ${state.enemy.aliveSeconds.toFixed(1)}s`;
  elements.bossRule.hidden = !state.enemy.isBoss;
  if (state.enemy.isBoss) {
    elements.bossRule.textContent = state.run.awaitingDecision
      ? '本轮收益已锁定 · 可继续深潜或立即重铸'
      : getBossRuleText(state.enemy);
  }
  elements.visual.disabled = state.run.awaitingDecision;
  elements.visual.dataset.region = REGION_DEFINITIONS[state.region].id;
  if (state.run.currentLaw && !state.enemy.isBoss) {
    elements.bossRule.hidden = false;
    elements.bossRule.textContent = `本段法则：${SECTOR_LAW_DEFINITIONS[state.run.currentLaw].name}`;
  }
  const overdriveActive = (state.effects.overdriveTime ?? 0) > 0;
  const overdriveValue = overdriveActive ? 100 : state.effects.overdriveCharge ?? 0;
  elements.overdriveFill.style.width = `${overdriveValue}%`;
  elements.overdriveLabel.textContent = overdriveActive ? `${state.effects.overdriveTime.toFixed(1)}s` : `${overdriveValue}%`;
  elements.overdriveMeter.classList.toggle('active', overdriveActive);
  elements.overdriveMeter.setAttribute('aria-valuenow', String(Math.round(overdriveValue)));
}

function renderDecision() {
  elements.guardianDecision.hidden = !state.run.awaitingDecision;
  if (!state.run.awaitingDecision) {
    selectedLawId = null;
    lastLawChoicesKey = '';
    return;
  }
  const gain = getReforgeGainBreakdown(state);
  const nextDepth = state.depth + 10;
  elements.decisionSummary.innerHTML = [
    ['当前深度', state.depth],
    ['守卫连胜', state.run.guardiansDefeated],
    ['立即收益', `${formatNumber(gain.total)} 炉心`],
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');
  const choicesKey = `${state.depth}:${state.run.lawChoices.join(',')}`;
  // 遥测刷新不重建选项 DOM；键盘和触屏选中的按钮保持原来的焦点。
  if (choicesKey !== lastLawChoicesKey) elements.lawChoices.innerHTML = state.run.lawChoices.map((id) => {
    const law = SECTOR_LAW_DEFINITIONS[id];
    return `<button type="button" class="law-card" role="radio" aria-checked="${selectedLawId === id}" data-sector-law="${id}"><strong>${law.name}</strong><span>${law.limitation}</span><em>${law.bonus} · 风险 ×${law.riskMultiplier}</em></button>`;
  }).join('');
  lastLawChoicesKey = choicesKey;
  for (const button of elements.lawChoices.querySelectorAll?.('[data-sector-law]') ?? []) {
    button.setAttribute('aria-checked', String(button.dataset.sectorLaw === selectedLawId));
  }
  elements.continueDive.disabled = !selectedLawId;
  elements.continueDive.textContent = selectedLawId ? `继续至深度 ${state.depth + 1}` : '先选择区段法则';
  elements.decisionReforge.textContent = `立即重铸 · +${formatNumber(gain.total)}`;
  const buildKey = `${state.journey.specialization}:${Object.values(state.journey.mastery).join(',')}`;
  if (elements.decisionBuilds.dataset.key !== buildKey) {
    elements.decisionBuilds.dataset.key = buildKey;
    elements.decisionBuilds.innerHTML = Object.entries(BUILD_DEFINITIONS).map(([id, build]) =>
      `<button type="button" data-specialization="${id}" ${state.journey.specialization === id ? 'disabled' : ''}>${build.name}${state.journey.specialization === id ? ' · 当前' : ''}</button>`).join('');
  }
  elements.reforgeHint.textContent = `下一守卫深度 ${nextDepth} · 深潜收益随深度、连胜和风险增长`;
}

function purchaseLabel(id) {
  const amount = state.settings.buyAmount;
  const numeric = amount === 'max' ? 1 : amount;
  return amount === 'max' ? `MAX · ${formatNumber(getUpgradeCost(state, id, 1))}+` : `×${amount} · ${formatNumber(getUpgradeCost(state, id, numeric))}`;
}

function renderUpgrades() {
  elements.upgrades.innerHTML = Object.entries(UPGRADE_DEFINITIONS).map(([id, item]) => {
    const unlocked = state.highestNode >= item.unlockNode;
    const amount = state.settings.buyAmount === 'max' ? 'max' : Number(state.settings.buyAmount);
    const required = getUpgradeCost(state, id, amount === 'max' ? 1 : amount);
    const nextMilestone = Math.ceil(((state.upgrades[id] ?? 0) + 1) / 10) * 10;
    const milestone = id === 'attack' ? ` · Lv.${nextMilestone} 获得额外 ×2` : '';
    return `<article class="action-card ${unlocked ? '' : 'locked'}">
      <div><h3>${unlocked ? item.name : `节点 ${item.unlockNode} 解锁`} ${unlocked ? `<span class="level">Lv.${state.upgrades[id]}</span>` : ''}</h3><p>${unlocked ? `${item.description}${milestone}` : '继续推进以解析该熔炉协议'}</p></div>
      <button type="button" data-upgrade="${id}" ${!unlocked || state.entropy < required ? 'disabled' : ''}>${unlocked ? purchaseLabel(id) : '锁定'}</button>
    </article>`;
  }).join('');
}

function renderSkills() {
  if (!state.unlocked.skills.length) {
    elements.skills.innerHTML = '<div class="empty-state">推进至区域 2，首个主动技能将被熔炉解析。</div>';
    elements.skillDock.innerHTML = '';
    return;
  }
  const sealed = state.run.currentLaw === 'silenceProtocol' || state.challenges.active === 'silence';
  const cards = state.unlocked.skills.map((id) => {
    const skill = SKILL_DEFINITIONS[id];
    const cooldown = state.skillCooldowns[id] ?? 0;
    const disabled = state.run.awaitingDecision || sealed || cooldown > 0;
    return `<article class="action-card"><div><h3>${skill.name}</h3><p>${skill.description}</p></div><button type="button" data-skill="${id}" ${disabled ? 'disabled' : ''}>${state.run.awaitingDecision ? '等待决策' : sealed ? '法则封锁' : cooldown > 0 ? `${cooldown.toFixed(1)}s` : '释放'}</button></article>`;
  }).join('');
  elements.skills.innerHTML = cards;
  elements.skillDock.innerHTML = state.unlocked.skills.map((id) => {
    const cooldown = state.skillCooldowns[id] ?? 0;
    const disabled = state.run.awaitingDecision || sealed || cooldown > 0;
    return `<button type="button" data-skill="${id}" ${disabled ? 'disabled' : ''}>${SKILL_DEFINITIONS[id].name}<br>${state.run.awaitingDecision ? 'DECIDE' : sealed ? 'SEALED' : cooldown > 0 ? `${cooldown.toFixed(1)}s` : 'READY'}</button>`;
  }).join('');
}

function renderModules() {
  const moduleSlots = getModuleSlotCount(state);
  elements.moduleCount.textContent = `${state.equippedModules.length}/${moduleSlots}`;
  if (!state.unlocked.modules.length) {
    elements.modules.innerHTML = '<div class="empty-state">Boss 与区域首破会留下规则模块。推进至节点 12 获得第一枚。</div>';
    return;
  }
  elements.modules.innerHTML = state.unlocked.modules.map((id) => {
    const item = MODULE_DEFINITIONS[id];
    const equipped = state.equippedModules.includes(id);
    const full = state.equippedModules.length >= moduleSlots && !equipped;
    return `<article class="action-card ${equipped ? 'equipped' : ''}"><div><h3>${item.name}</h3><p>${item.description}</p></div><button type="button" data-module="${id}" ${full ? 'disabled' : ''}>${equipped ? '卸下' : '装备'}</button></article>`;
  }).join('');
}

function renderCoreUpgrades() {
  const coreCards = Object.entries(CORE_UPGRADE_DEFINITIONS).map(([id, item]) => {
    const level = state.coreUpgrades[id];
    const maxed = level >= item.maxLevel;
    const cost = getCoreUpgradeCost(state, id);
    return `<article class="action-card ${maxed ? 'equipped' : ''}">
      <div><h3>${item.name} <span class="level">Lv.${level}/${item.maxLevel}</span></h3><p>${item.description}</p></div>
      <button type="button" data-core-upgrade="${id}" ${maxed || state.coreShards < cost ? 'disabled' : ''}>${maxed ? '已满级' : `${formatNumber(cost)} 碎片`}</button>
    </article>`;
  }).join('');
  const technologyUnlocked = state.totalCoreShards >= 25 || state.research.totalPoints > 0;
  const techCards = technologyUnlocked
    ? Object.entries(TECH_DEFINITIONS).map(([id, item]) => {
      const level = state.techs[id];
      const maxed = level >= item.maxLevel;
      const cost = getTechCost(state, id);
      return `<article class="action-card ${maxed ? 'equipped' : ''}">
        <div><h3>${item.branch} · ${item.name} <span class="level">Lv.${level}/${item.maxLevel}</span></h3><p>${item.description}</p></div>
        <button type="button" data-tech="${id}" ${maxed || state.research.points < cost ? 'disabled' : ''}>${maxed ? '已掌握' : `${cost} 研究点`}</button>
      </article>`;
    }).join('')
    : '<div class="empty-state">累计获得 25 炉心碎片或击败首名守卫后，开放三分支科技树。</div>';
  const challengeCards = Object.entries(CHALLENGE_DEFINITIONS).map(([id, item]) => {
    const rank = state.challenges.ranks[id] ?? 0;
    const completed = rank >= 5;
    const requiredResearch = CHALLENGE_RANK_UNLOCKS[id]?.[rank] ?? item.unlockResearch;
    const unlocked = !completed && state.research.totalPoints >= requiredResearch;
    const active = state.challenges.active === id;
    const disabled = !unlocked || completed || (state.challenges.active && !active);
    return `<article class="action-card ${completed ? 'equipped' : ''}">
      <div><h3>${completed || unlocked ? `${item.name} Rank ${rank}/5` : `${requiredResearch} 总研究点解锁 ${rank + 1}阶`}</h3><p>${completed || unlocked ? `${item.rule}；奖励逐阶强化：${item.reward}` : '继续击败永久递进的法则守卫以解析试炼'}</p></div>
      <button type="button" data-challenge="${id}" ${disabled ? 'disabled' : ''}>${completed ? '已精通' : active ? `连续完成 ${state.challenges.progress}/${rank + 1} 轮 · 退出` : `挑战 ${rank + 1} 阶`}</button>
    </article>`;
  }).join('');
  elements.corePanel.innerHTML = `${coreCards}<div class="section-title progression-divider"><h3>三分支科技</h3><span>${state.research.points} 点可用</span></div>${techCards}<div class="section-title progression-divider"><h3>法则试炼</h3><span>试炼跨重铸保留</span></div>${challengeCards}`;
}

function listHasFocus(...containers) {
  return containers.some((container) => container.contains(document.activeElement));
}

function syncFocusedControls(container) {
  // 保留实际按钮与焦点，只更新实时属性；焦点保护不应冻结价格、冷却或禁用状态。
  for (const button of container.querySelectorAll?.('button') ?? []) {
    const { upgrade, skill, module, coreUpgrade, tech } = button.dataset;
    if (upgrade) {
      const amount = state.settings.buyAmount === 'max' ? 1 : state.settings.buyAmount;
      const unlocked = state.highestNode >= UPGRADE_DEFINITIONS[upgrade].unlockNode;
      button.disabled = !unlocked || state.entropy < getUpgradeCost(state, upgrade, amount);
      button.textContent = unlocked ? purchaseLabel(upgrade) : '锁定';
    }
    if (skill) {
      const cooldown = state.skillCooldowns[skill] ?? 0;
      const sealed = state.run.currentLaw === 'silenceProtocol' || state.challenges.active === 'silence';
      button.disabled = state.run.awaitingDecision || sealed || cooldown > 0;
      button.textContent = state.run.awaitingDecision ? '等待决策' : sealed ? '法则封锁' : cooldown > 0 ? `${cooldown.toFixed(1)}s` : '释放';
    }
    if (module) {
      const equipped = state.equippedModules.includes(module);
      button.disabled = !equipped && state.equippedModules.length >= getModuleSlotCount(state);
      button.textContent = equipped ? '卸下' : '装备';
    }
    if (coreUpgrade) {
      const cost = getCoreUpgradeCost(state, coreUpgrade);
      button.disabled = state.coreShards < cost || !Number.isFinite(cost);
      button.textContent = Number.isFinite(cost) ? `${formatNumber(cost)} 碎片` : '已满级';
    }
    if (tech) {
      const cost = getTechCost(state, tech);
      button.disabled = state.research.points < cost || !Number.isFinite(cost);
      button.textContent = Number.isFinite(cost) ? `${cost} 研究点` : '已掌握';
    }
  }
}

function renderMeta() {
  const goal = nextUnlock();
  const gainBreakdown = getReforgeGainBreakdown(state);
  const gain = gainBreakdown.total;
  const automationGoal = getAutomationGoal(state);
  elements.entropy.textContent = formatNumber(state.entropy);
  elements.coreShards.textContent = formatNumber(state.coreShards);
  elements.research.textContent = formatNumber(state.research.points);
  elements.runTime.textContent = formatTime(state.run.activeSeconds);
  elements.nextGoal.textContent = goal.text;
  elements.missionProgress.style.width = `${Math.min(100, goal.progress * 100)}%`;
  elements.highestNode.textContent = String(state.bestDepth).padStart(2, '0');
  elements.killCount.textContent = formatNumber(state.run.kills + state.run.bosses);
  elements.damageCount.textContent = formatNumber(state.run.damage);
  elements.reforgePreview.textContent = `预计获得 ${gain} 炉心碎片`;
  elements.reforgeHint.textContent = gain > 0
    ? `深度 ${state.bestDepth} × 连胜 ${gainBreakdown.streakMultiplier.toFixed(2)} × 风险 ${gainBreakdown.riskMultiplier.toFixed(2)}`
    : '击破深度 30 守卫后开始积累';
  elements.reforgeButton.disabled = gain < 1;
  elements.dialogGain.textContent = `${gain} 炉心碎片`;
  elements.automationGoal.textContent = automationGoal.unlocked
    ? '脉冲无人机 · 已上线'
    : `${automationGoal.label} · 深度 ${automationGoal.current}/${automationGoal.target}`;
  elements.automation.hidden = !state.unlocked.autoBuy && !state.unlocked.autoSkills && state.lifetime.reforges < 1;
  elements.autoBuyControl.hidden = !state.unlocked.autoBuy;
  elements.autoBuyPriorityControl.hidden = !state.unlocked.autoBuy;
  elements.autoSkillsControl.hidden = !state.unlocked.autoSkills;
  elements.presetControl.hidden = state.lifetime.reforges < 1;
  elements.autoBuy.checked = state.settings.autoBuy;
  elements.autoSkills.checked = state.settings.autoSkills;
  elements.autoBuyPriority.value = state.settings.autoBuyPriority;
  elements.log.innerHTML = state.logs.map((message) => `<li>${message}</li>`).join('');
  elements.logCount.textContent = state.logs.length;
}

function renderJourney() {
  elements.journeyGoals.innerHTML = getJourneyGoals(state).map((goal) =>
    `<div><span>${goal.label}</span><strong>${goal.text}</strong></div>`).join('');
  elements.expeditionNotice.hidden = !state.run.expedition || Boolean(state.run.expedition.choice) || state.run.awaitingDecision;
  elements.offlineSummary.hidden = !offlineReturn;
  if (offlineReturn) elements.offlineMessage.textContent = `离线 ${formatTime(offlineReturn.elapsedSeconds)} · 回收 ${formatNumber(offlineReturn.entropyGained)} 熵晶（已到账）；接下来：${getJourneyGoals(state)[2].text}`;
  // 图鉴与构筑卡只在状态变更时生成，避免给战斗帧增加大量 DOM 工作。
  const key = JSON.stringify([state.journey, state.run.expedition, state.run.buildCommitted, state.run.awaitingDecision,
    state.bestDepth, state.equippedModules, state.unlocked.autoAttack, state.lifetime.reforges, state.lifetime.bosses, state.research.discoveredGuardians]);
  if (key === lastContentKey) return;
  lastContentKey = key;
  const canChoose = (state.unlocked.autoAttack || state.bestDepth >= 12) && (!state.run.buildCommitted || state.run.awaitingDecision);
  const builds = Object.entries(BUILD_DEFINITIONS).map(([id, build]) => {
    const selected = state.journey.specialization === id;
    const xp = state.journey.mastery[id];
    const rank = getMasteryRank(xp);
    const target = [1, 5, 15][rank];
    const moduleName = MODULE_DEFINITIONS[build.module].name;
    return `<article class="action-card ${selected ? 'equipped' : ''}"><div><h3>${build.name} · 精通 ${rank}/3</h3><p>需要 ${moduleName} · ${build.rule}。${build.tradeoff}。</p><small>${target ? `使用对应模块击破守卫：${xp}/${target}` : '已精通'} · ${selected && !state.equippedModules.includes(build.module) ? '尚未装备对应模块，专精未生效' : '守卫决策时可换流派'}</small></div><button type="button" data-specialization="${id}" ${!canChoose || selected ? 'disabled' : ''}>${selected ? '当前流派' : canChoose ? '选择' : state.bestDepth < 12 && !state.unlocked.autoAttack ? '深度 12 解锁' : '本段已锁定'}</button></article>`;
  }).join('');
  const expedition = state.run.expedition;
  const rewards = expedition ? Object.entries(EXPEDITION_REWARDS).map(([id, reward]) =>
    `<article class="action-card ${expedition.choice === id ? 'equipped' : ''}"><div><h3>${reward.name}</h3><p>${reward.description}</p></div><button type="button" data-expedition-reward="${id}" ${expedition.choice || state.run.awaitingDecision ? 'disabled' : ''}>${expedition.choice === id ? '已领取' : expedition.choice ? '已放弃' : '选择'}</button></article>`).join('')
    : '<div class="empty-state">深度 15 起，每 10 层发现一处补给。不会打断战斗，随时来选择；未领取将在下一处刷新。</div>';
  elements.exploration.innerHTML = `<div class="section-title progression-divider"><h3>流派专精</h3><span>构筑改变循环</span></div>${builds}<div class="section-title progression-divider"><h3>途中补给${expedition ? ` · 深度 ${expedition.depth}` : ''}</h3><span>三选一</span></div>${rewards}`;
  const guardianNames = { 'gravity-guardian': '重力', 'mirror-guardian': '镜像', 'time-guardian': '时间', 'entropy-guardian': '熵' };
  const relics = Object.entries(RELIC_DEFINITIONS).map(([id, relic]) => {
    const count = state.journey.relics[id];
    const rank = getRelicRank(count);
    const threshold = [1, 3, 7, 15, 31][rank];
    return `<article class="action-card ${rank ? 'equipped' : 'locked'}"><div><h3>${relic.name} · ${rank}/5 阶</h3><p>${relic.effect} · 击破${guardianNames[id]}守卫保证掉落</p><small>${rank ? '已观测' : '待发现'} · ${threshold ? `${count}/${threshold} 次击破后强化` : '遗物已完全解析'}</small></div></article>`;
  }).join('');
  const achievements = Object.entries(ACHIEVEMENT_DEFINITIONS).map(([id, item]) => {
    const claimed = state.journey.claimedAchievements.includes(id);
    const progress = item.progress(state);
    return `<article class="action-card ${claimed ? 'equipped' : ''}"><div><h3>${item.name}</h3><p>${Math.min(item.target, progress)}/${item.target} · 奖励 ${item.reward} 炉心</p></div><button type="button" data-achievement="${id}" ${claimed || progress < item.target ? 'disabled' : ''}>${claimed ? '已领取' : progress >= item.target ? '领取' : '未达成'}</button></article>`;
  }).join('');
  const laws = Object.entries(SECTOR_LAW_DEFINITIONS).map(([id, law]) => `<article class="action-card ${state.journey.completedLaws.includes(id) ? 'equipped' : 'locked'}"><div><h3>${law.name} · ${state.journey.completedLaws.includes(id) ? '已征服' : '待征服'}</h3><p>${law.limitation}；${law.bonus}</p></div></article>`).join('');
  elements.collection.innerHTML = `<div class="section-title progression-divider"><h3>永久成就</h3><span>跨重铸保留</span></div>${achievements}<div class="section-title progression-divider"><h3>守卫遗物</h3><span>保证掉落 · 重复强化</span></div>${relics}<div class="section-title progression-divider"><h3>法则图鉴</h3><span>完成整段才记录</span></div>${laws}`;
}

function render({ forceUpgrades = false, forceSkills = false, forceModules = false, forceCore = false } = {}) {
  const stats = deriveStats(state);
  renderStats(stats);
  renderBattle();
  renderMeta();
  renderDecision();
  renderJourney();
  // Telemetry preserves focus, while direct actions force their affected controls to reflect the new state immediately.
  if (forceUpgrades || !listHasFocus(elements.upgrades)) renderUpgrades();
  else syncFocusedControls(elements.upgrades);
  if (forceSkills || !listHasFocus(elements.skills, elements.skillDock)) renderSkills();
  else {
    syncFocusedControls(elements.skills);
    syncFocusedControls(elements.skillDock);
  }
  if (forceModules || !listHasFocus(elements.modules)) renderModules();
  else syncFocusedControls(elements.modules);
  if (forceCore || !listHasFocus(elements.corePanel)) renderCoreUpgrades();
  else syncFocusedControls(elements.corePanel);
}

function flashEvents(events) {
  const notable = [...events].reverse().find((event) => ['bossDefeated', 'kill', 'criticalEcho', 'focusedAttack', 'resonance', 'skillDamage', 'manualPulse', 'overdriveStarted'].includes(event.type));
  if (!notable) return;
  elements.visual.classList.remove('hit', 'critical');
  void elements.visual.offsetWidth;
  elements.visual.classList.add('hit');
  if (notable.criticalTier > 0 || notable.type === 'criticalEcho' || notable.type === 'focusedAttack') elements.visual.classList.add('critical');
  const messages = {
    bossDefeated: '法则守卫崩解 · 选择继续深潜或重铸', kill: `节点摧毁 · +${formatNumber(notable.reward)} 熵晶`,
    criticalEcho: '裂变镜片 · 暴击回响', focusedAttack: '奇点透镜 · 聚焦脉冲 ×20',
    resonance: `共振叠层 ${notable.stacks}`, skillDamage: `${SKILL_DEFINITIONS[notable.skill]?.name ?? '技能'}释放`,
    manualPulse: `主动脉冲 · ${formatNumber(notable.damage)} 伤害`,
    overdriveStarted: '熔炉超载 · 10 秒爆发启动',
  };
  elements.callout.textContent = messages[notable.type];
  window.setTimeout(() => elements.visual.classList.remove('hit', 'critical'), 180);
}

function gameLoop(now) {
  const elapsed = Math.min(.25, (now - lastFrame) / 1000);
  lastFrame = now;
  const result = advanceGame(state, elapsed, [Math.random(), Math.random()]);
  flashEvents(result.events);
  if (now - lastRender > 100) {
    render();
    lastRender = now;
  }
  requestAnimationFrame(gameLoop);
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  let forceUpgrades = false;
  let forceSkills = false;
  let forceModules = false;
  let forceCore = false;
  if (button.dataset.specialization) chooseSpecialization(state, button.dataset.specialization);
  if (button.dataset.expeditionReward) chooseExpeditionReward(state, button.dataset.expeditionReward);
  if (button.dataset.achievement) claimAchievement(state, button.dataset.achievement);
  if (button.dataset.dismissOffline !== undefined) offlineReturn = null;
  if (button.dataset.mobileTarget) {
    const target = $(button.dataset.mobileTarget);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // The mobile dock keeps primary areas one tap away without changing the desktop three-column workspace.
    target?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    document.querySelectorAll('[data-mobile-target]').forEach((item) => {
      if (item === button) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    });
  }
  if (button.dataset.manualAttack !== undefined) {
    flashEvents(manualAttack(state, [Math.random(), Math.random()], { repeated: Boolean(event.repeat) }).events);
  }
  if (button.dataset.buyAmount) {
    state.settings.buyAmount = button.dataset.buyAmount === 'max' ? 'max' : Number(button.dataset.buyAmount);
    document.querySelectorAll('[data-buy-amount]').forEach((item) => item.classList.toggle('active', item === button));
  }
  if (button.dataset.upgrade) {
    buyUpgrade(state, button.dataset.upgrade, state.settings.buyAmount);
    forceUpgrades = true;
  }
  if (button.dataset.skill) {
    flashEvents(activateSkill(state, button.dataset.skill).events);
    forceSkills = true;
  }
  if (button.dataset.module) {
    toggleModule(state, button.dataset.module);
    forceModules = true;
  }
  if (button.dataset.coreUpgrade) {
    buyCoreUpgrade(state, button.dataset.coreUpgrade);
    // 炉心协议可能立即改变模块容量和自动化入口，相关面板必须同步刷新。
    forceCore = true;
    forceModules = true;
  }
  if (button.dataset.tech) {
    buyTech(state, button.dataset.tech);
    forceCore = true;
    forceModules = true;
  }
  if (button.dataset.challenge) {
    if (state.challenges.active === button.dataset.challenge) cancelChallenge(state);
    else startChallenge(state, button.dataset.challenge);
    forceCore = true;
    forceSkills = true;
  }
  if (button.dataset.sectorLaw) {
    selectedLawId = button.dataset.sectorLaw;
  }
  if (button.id === 'continue-dive' && selectedLawId) {
    continueDeepDive(state, selectedLawId);
    selectedLawId = null;
  }
  if (button.id === 'decision-reforge') {
    elements.dialog.returnValue = '';
    elements.dialog.showModal();
  }
  if (button.dataset.savePreset !== undefined) saveBuildPreset(state, Number(button.dataset.savePreset));
  if (button.dataset.loadPreset !== undefined) {
    loadBuildPreset(state, Number(button.dataset.loadPreset));
    forceModules = true;
  }
  if (button.dataset.tab || button.dataset.openTab) {
    activeTab = button.dataset.tab ?? button.dataset.openTab;
    document.querySelectorAll('[role="tab"]').forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.tab === activeTab)));
    const panels = { upgrades: elements.upgrades, skills: elements.skills, modules: elements.modules, core: elements.corePanel,
      exploration: elements.exploration, collection: elements.collection };
    for (const [name, panel] of Object.entries(panels)) panel.hidden = name !== activeTab;
    if (button.dataset.openTab) $('#build-panel').scrollIntoView({ behavior: 'auto', block: 'start' });
  }
  // 跨面板奖励与流派操作也会改变可购买状态，直接操作后同步刷新受影响按钮。
  if (button.dataset.specialization || button.dataset.expeditionReward || button.dataset.achievement || button.dataset.loadPreset !== undefined) {
    forceUpgrades = forceSkills = forceModules = forceCore = true;
  }
  render({ forceUpgrades, forceSkills, forceModules, forceCore });
  saveGame();
});

elements.autoBuy.addEventListener('change', () => { state.settings.autoBuy = elements.autoBuy.checked; });
elements.autoSkills.addEventListener('change', () => { state.settings.autoSkills = elements.autoSkills.checked; });
elements.autoBuyPriority.addEventListener('change', () => { state.settings.autoBuyPriority = elements.autoBuyPriority.value; });
elements.reforgeButton.addEventListener('click', () => {
  elements.dialog.returnValue = '';
  elements.dialog.showModal();
});
elements.dialog.addEventListener('close', () => {
  if (elements.dialog.returnValue === 'confirm') {
    state = reforge(state);
    saveGame();
    render();
  }
});

window.addEventListener('beforeunload', saveGame);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    saveGame();
    return;
  }
  const offline = applyOfflineProgress(state, Date.now());
  lastFrame = performance.now();
  if (offline.entropyGained > 0) elements.callout.textContent = `后台回收 · +${formatNumber(offline.entropyGained)} 熵晶`;
  if (offline.elapsedSeconds >= 60 && offline.entropyGained > 0) offlineReturn = offline;
  render();
});
window.setInterval(() => {
  if (!document.hidden) saveGame();
}, 5_000);
render();
requestAnimationFrame(gameLoop);
