import {
  MODULE_DEFINITIONS,
  REGION_DEFINITIONS,
  SKILL_DEFINITIONS,
  UPGRADE_DEFINITIONS,
  activateSkill,
  advanceGame,
  applyOfflineProgress,
  buyUpgrade,
  createGameState,
  deserializeGame,
  deriveStats,
  getReforgeGain,
  getUpgradeCost,
  manualAttack,
  reforge,
  serializeGame,
  toggleModule,
} from './game.js';

const SAVE_KEY = 'singularity-foundry-save-v1';
const $ = (selector) => document.querySelector(selector);
const elements = {
  entropy: $('#entropy-value'), core: $('#core-value'), runTime: $('#run-time'), saveState: $('#save-state'),
  nextGoal: $('#next-goal'), missionProgress: $('#mission-progress'), region: $('#region-label'), node: $('#node-label'),
  enemyName: $('#enemy-name'), enemyType: $('#enemy-type'), enemyHealth: $('#enemy-health'), enemyPercent: $('#enemy-percent'),
  healthFill: $('#health-fill'), healthTrack: $('.health-track'), enemyTimer: $('#enemy-timer'), bossRule: $('#boss-rule'),
  visual: $('#forge-visual'), callout: $('#combat-callout'), skillDock: $('#skill-dock'), upgrades: $('#upgrade-list'),
  skills: $('#skill-list'), modules: $('#module-list'), moduleCount: $('#module-count'), buildLabel: $('#build-label'),
  statAttack: $('#stat-attack'), statSpeed: $('#stat-speed'), statCrit: $('#stat-crit'), statCritDamage: $('#stat-crit-damage'),
  statSkill: $('#stat-skill'), statResource: $('#stat-resource'), breakdown: $('#breakdown-list'),
  automation: $('#automation-card'), autoBuy: $('#auto-buy-toggle'), highestNode: $('#highest-node'),
  killCount: $('#kill-count'), damageCount: $('#damage-count'), reforgePreview: $('#reforge-preview'),
  reforgeHint: $('#reforge-hint'), reforgeButton: $('#reforge-button'), dialog: $('#reforge-dialog'),
  dialogGain: $('#dialog-gain'), confirmReforge: $('#confirm-reforge'), log: $('#event-log'), logCount: $('#log-count'),
};

let state = loadGame();
let activeTab = 'upgrades';
let lastFrame = performance.now();
let lastRender = 0;

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  const loaded = raw ? deserializeGame(raw) : createGameState();
  applyOfflineProgress(loaded);
  return loaded;
}

function saveGame() {
  state.lastSavedAt = Date.now();
  localStorage.setItem(SAVE_KEY, serializeGame(state));
  elements.saveState.textContent = '已保存';
  window.setTimeout(() => { elements.saveState.textContent = '熔炉在线'; }, 900);
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
  const candidates = [
    ...Object.values(UPGRADE_DEFINITIONS).map((item) => ({ ...item, kind: '升级' })),
    ...Object.values(SKILL_DEFINITIONS).map((item) => ({ ...item, kind: '技能' })),
    ...Object.values(MODULE_DEFINITIONS).map((item) => ({ ...item, kind: '模块' })),
  ].filter((item) => item.unlockNode > state.highestNode).sort((a, b) => a.unlockNode - b.unlockNode);
  if (candidates[0]) return { text: `推进至节点 ${candidates[0].unlockNode}：解锁${candidates[0].kind}「${candidates[0].name}」`, progress: state.highestNode / candidates[0].unlockNode };
  if (!state.completed) return { text: '突破热寂边界，唤醒重力守卫', progress: Math.min(1, state.highestNode / 31) };
  return { text: '重铸熔炉，让下一轮增长发生质变', progress: 1 };
}

function buildName(stats) {
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
  elements.breakdown.innerHTML = [
    ['基础脉冲', stats.attack / (1 + state.coreShards * .15)],
    ['炉心增幅', 1 + state.coreShards * .15],
    ['多重攻击', stats.multiStrike],
    ['预计 DPS', stats.attack * stats.attackSpeed * stats.multiStrike],
  ].map(([label, value]) => `<div class="breakdown-row"><span>${label}</span><strong>×${formatNumber(value)}</strong></div>`).join('');
}

function renderBattle() {
  const healthPercent = Math.max(0, Math.min(100, state.enemy.health / state.enemy.maxHealth * 100));
  elements.region.textContent = `区域 ${String(state.region + 1).padStart(2, '0')} · ${REGION_DEFINITIONS[state.region].name}`;
  elements.node.textContent = state.enemy.isBoss ? 'BOSS // 法则守卫' : `NODE ${String(state.node).padStart(2, '0')} / 10`;
  elements.enemyType.textContent = state.enemy.isBoss ? '法则守卫' : '法则节点';
  elements.enemyName.textContent = state.enemy.name;
  elements.enemyHealth.textContent = `${formatNumber(Math.max(0, state.enemy.health))} / ${formatNumber(state.enemy.maxHealth)}`;
  elements.enemyPercent.textContent = `${healthPercent.toFixed(1)}%`;
  elements.healthFill.style.width = `${healthPercent}%`;
  elements.healthTrack.setAttribute('aria-valuenow', String(Math.round(healthPercent)));
  elements.enemyTimer.textContent = `交战 ${state.enemy.aliveSeconds.toFixed(1)}s`;
  elements.bossRule.hidden = !state.enemy.isBoss;
  if (state.enemy.isBoss) elements.bossRule.textContent = `重力裂隙 +${formatNumber(state.enemy.vulnerability * 100)}% · ${state.enemy.pulseTimer.toFixed(1)} 秒后脉冲收束`;
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
    return `<article class="action-card ${unlocked ? '' : 'locked'}">
      <div><h3>${unlocked ? item.name : `节点 ${item.unlockNode} 解锁`} ${unlocked ? `<span class="level">Lv.${state.upgrades[id]}</span>` : ''}</h3><p>${unlocked ? item.description : '继续推进以解析该熔炉协议'}</p></div>
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
  const cards = state.unlocked.skills.map((id) => {
    const skill = SKILL_DEFINITIONS[id];
    const cooldown = state.skillCooldowns[id] ?? 0;
    return `<article class="action-card"><div><h3>${skill.name}</h3><p>${skill.description}</p></div><button type="button" data-skill="${id}" ${cooldown > 0 ? 'disabled' : ''}>${cooldown > 0 ? `${cooldown.toFixed(1)}s` : '释放'}</button></article>`;
  }).join('');
  elements.skills.innerHTML = cards;
  elements.skillDock.innerHTML = state.unlocked.skills.map((id) => {
    const cooldown = state.skillCooldowns[id] ?? 0;
    return `<button type="button" data-skill="${id}" ${cooldown > 0 ? 'disabled' : ''}>${SKILL_DEFINITIONS[id].name}<br>${cooldown > 0 ? `${cooldown.toFixed(1)}s` : 'READY'}</button>`;
  }).join('');
}

function renderModules() {
  elements.moduleCount.textContent = `${state.equippedModules.length}/2`;
  if (!state.unlocked.modules.length) {
    elements.modules.innerHTML = '<div class="empty-state">Boss 与区域首破会留下规则模块。推进至节点 12 获得第一枚。</div>';
    return;
  }
  elements.modules.innerHTML = state.unlocked.modules.map((id) => {
    const item = MODULE_DEFINITIONS[id];
    const equipped = state.equippedModules.includes(id);
    const full = state.equippedModules.length >= 2 && !equipped;
    return `<article class="action-card ${equipped ? 'equipped' : ''}"><div><h3>${item.name}</h3><p>${item.description}</p></div><button type="button" data-module="${id}" ${full ? 'disabled' : ''}>${equipped ? '卸下' : '装备'}</button></article>`;
  }).join('');
}

function listHasFocus(...containers) {
  return containers.some((container) => container.contains(document.activeElement));
}

function renderMeta() {
  const goal = nextUnlock();
  const gain = getReforgeGain(state);
  elements.entropy.textContent = formatNumber(state.entropy);
  elements.core.textContent = formatNumber(state.coreShards);
  elements.runTime.textContent = formatTime(state.run.activeSeconds);
  elements.nextGoal.textContent = goal.text;
  elements.missionProgress.style.width = `${Math.min(100, goal.progress * 100)}%`;
  elements.highestNode.textContent = String(state.highestNode).padStart(2, '0');
  elements.killCount.textContent = formatNumber(state.run.kills + state.run.bosses);
  elements.damageCount.textContent = formatNumber(state.run.damage);
  elements.reforgePreview.textContent = `预计获得 ${gain} 炉心碎片`;
  elements.reforgeHint.textContent = gain > 0 ? `重启后伤害 ×${formatNumber(1 + (state.coreShards + gain) * .15)}` : '推进至区域 2 后开始积累';
  elements.reforgeButton.disabled = gain < 1;
  elements.dialogGain.textContent = `${gain} 炉心碎片`;
  elements.automation.hidden = !state.unlocked.autoBuy;
  elements.autoBuy.checked = state.settings.autoBuy;
  elements.log.innerHTML = state.logs.map((message) => `<li>${message}</li>`).join('');
  elements.logCount.textContent = state.logs.length;
}

function render({ forceUpgrades = false, forceSkills = false, forceModules = false } = {}) {
  const stats = deriveStats(state);
  renderStats(stats);
  renderBattle();
  renderMeta();
  // Telemetry preserves focus, while direct actions force their affected controls to reflect the new state immediately.
  if (forceUpgrades || !listHasFocus(elements.upgrades)) renderUpgrades();
  if (forceSkills || !listHasFocus(elements.skills, elements.skillDock)) renderSkills();
  if (forceModules || !listHasFocus(elements.modules)) renderModules();
}

function flashEvents(events) {
  const notable = [...events].reverse().find((event) => ['bossDefeated', 'kill', 'criticalEcho', 'focusedAttack', 'resonance', 'skillDamage', 'manualPulse'].includes(event.type));
  if (!notable) return;
  elements.visual.classList.remove('hit', 'critical');
  void elements.visual.offsetWidth;
  elements.visual.classList.add('hit');
  if (notable.criticalTier > 0 || notable.type === 'criticalEcho' || notable.type === 'focusedAttack') elements.visual.classList.add('critical');
  const messages = {
    bossDefeated: '法则守卫崩解 · 重铸已就绪', kill: `节点摧毁 · +${formatNumber(notable.reward)} 熵晶`,
    criticalEcho: '裂变镜片 · 暴击回响', focusedAttack: '奇点透镜 · 聚焦脉冲 ×20',
    resonance: `共振叠层 ${notable.stacks}`, skillDamage: `${SKILL_DEFINITIONS[notable.skill]?.name ?? '技能'}释放`,
    manualPulse: `主动脉冲 · ${formatNumber(notable.damage)} 伤害`,
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
  if (!button) return;
  let forceUpgrades = false;
  let forceSkills = false;
  let forceModules = false;
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
    flashEvents(manualAttack(state, [Math.random(), Math.random()]).events);
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
  if (button.dataset.tab) {
    activeTab = button.dataset.tab;
    document.querySelectorAll('[role="tab"]').forEach((tab) => tab.setAttribute('aria-selected', String(tab === button)));
    for (const name of ['upgrades', 'skills', 'modules']) $(`#${name === 'upgrades' ? 'upgrade' : name.slice(0, -1)}-list`).hidden = name !== activeTab;
  }
  render({ forceUpgrades, forceSkills, forceModules });
});

elements.autoBuy.addEventListener('change', () => { state.settings.autoBuy = elements.autoBuy.checked; });
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
  render();
});
window.setInterval(() => {
  if (!document.hidden) saveGame();
}, 5_000);
render();
requestAnimationFrame(gameLoop);
