import test from 'node:test';
import assert from 'node:assert/strict';

import { createGameState, serializeGame } from '../src/game.js';

function createElement() {
  const listeners = new Map();
  return {
    textContent: '', innerHTML: '', hidden: false, checked: false, returnValue: '',
    style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatch(type) { listeners.get(type)?.({ target: this }); },
    setAttribute() {}, contains(node) { return node === this; },
    closest(selector) { return selector === 'button' ? this : null; },
    showModal() {},
    scrollIntoView() { this.scrollCount = (this.scrollCount ?? 0) + 1; },
  };
}

test('focused action lists refresh immediately after their user action', async () => {
  const elements = new Map();
  const selectors = [
    '#entropy-value', '#core-value', '#research-value', '#run-time', '#save-state', '#next-goal', '#mission-progress',
    '#region-label', '#node-label', '#enemy-name', '#enemy-type', '#enemy-health', '#enemy-percent',
    '#health-fill', '.health-track', '#enemy-timer', '#boss-rule', '#forge-visual', '#combat-callout',
    '#overdrive-meter', '#overdrive-fill', '#overdrive-label',
    '#skill-dock', '#upgrade-list', '#skill-list', '#module-list', '#core-list', '#module-count', '#build-label',
    '#stat-attack', '#stat-speed', '#stat-crit', '#stat-crit-damage', '#stat-skill', '#stat-resource',
    '#breakdown-list', '#automation-card', '#auto-buy-control', '#auto-buy-toggle', '#auto-skills-control',
    '#auto-buy-priority-control', '#auto-buy-priority', '#auto-skills-toggle', '#preset-control', '#automation-goal', '#highest-node', '#kill-count',
    '#damage-count', '#reforge-preview', '#reforge-hint', '#reforge-button', '#reforge-dialog',
    '#dialog-gain', '#confirm-reforge', '#event-log', '#log-count', '#battlefield', '#build-panel', '#stats-panel',
    '#guardian-decision', '#decision-summary', '#law-choices', '#continue-dive', '#decision-reforge', '#decision-builds',
    '#exploration-list', '#collection-list', '#journey-goals', '#expedition-notice', '#offline-summary', '#offline-message',
  ];
  for (const selector of selectors) elements.set(selector, createElement());

  const documentListeners = new Map();
  const initialState = createGameState();
  initialState.entropy = 10;
  initialState.coreShards = 5;
  initialState.research.points = 2;
  initialState.research.totalPoints = 2;
  initialState.depth = initialState.bestDepth = initialState.highestNode = 15;
  initialState.lifetime.bosses = 1;
  initialState.run.expedition = { depth: 15, choice: null };
  initialState.unlocked.skills = ['overload'];
  initialState.skillCooldowns = { overload: 0 };
  initialState.unlocked.modules = ['resonanceCore'];
  globalThis.document = {
    activeElement: null,
    hidden: false,
    querySelector: (selector) => elements.get(selector),
    querySelectorAll: () => [],
    addEventListener: (type, listener) => documentListeners.set(type, listener),
  };
  globalThis.localStorage = {
    getItem: () => serializeGame(initialState),
    setItem() {},
  };
  globalThis.window = {
    addEventListener() {},
    setTimeout() {},
    setInterval() {},
  };
  let nextFrame;
  globalThis.requestAnimationFrame = (callback) => { nextFrame = callback; return 0; };

  const originalRandom = Math.random;
  Math.random = () => 0.99;
  try {
    await import(`../src/app.js?interaction=${Date.now()}`);

    assert.equal(elements.get('#core-value').textContent, '5');
    assert.equal(elements.get('#research-value').textContent, '2');

    const manualButton = elements.get('#forge-visual');
    manualButton.dataset.manualAttack = '';
    documentListeners.get('click')({ target: manualButton });
    assert.equal(elements.get('#enemy-health').textContent, '6.65 / 8');
    assert.equal(elements.get('#overdrive-label').textContent, '5%');

    const upgradeButton = createElement();
    upgradeButton.dataset.upgrade = 'attack';
    document.activeElement = upgradeButton;
    elements.get('#upgrade-list').contains = (node) => node === upgradeButton;
    documentListeners.get('click')({ target: upgradeButton });

    assert.match(elements.get('#upgrade-list').innerHTML, /Lv\.1/);
    assert.match(elements.get('#upgrade-list').innerHTML, /data-upgrade="attack" disabled/);

    const skillButton = createElement();
    skillButton.dataset.skill = 'overload';
    document.activeElement = skillButton;
    elements.get('#skill-list').contains = (node) => node === skillButton;
    documentListeners.get('click')({ target: skillButton });

    assert.match(elements.get('#skill-list').innerHTML, /data-skill="overload" disabled/);
    assert.doesNotMatch(elements.get('#skill-list').innerHTML, />释放</);

    const challenge = createElement();
    challenge.dataset.challenge = 'silence';
    documentListeners.get('click')({ target: challenge });
    assert.match(elements.get('#skill-list').innerHTML, /法则封锁/);
    assert.match(elements.get('#skill-dock').innerHTML, /SEALED/);

    const moduleButton = createElement();
    moduleButton.dataset.module = 'resonanceCore';
    document.activeElement = moduleButton;
    elements.get('#module-list').contains = (node) => node === moduleButton;
    documentListeners.get('click')({ target: moduleButton });

    assert.match(elements.get('#module-list').innerHTML, /class="action-card equipped"/);
    assert.match(elements.get('#module-list').innerHTML, />卸下</);
    assert.equal(elements.get('#module-count').textContent, '1/2');

    const specialization = createElement();
    specialization.dataset.specialization = 'resonance';
    documentListeners.get('click')({ target: specialization });
    assert.match(elements.get('#exploration-list').innerHTML, /共振引擎/);
    assert.match(elements.get('#exploration-list').innerHTML, /data-specialization="resonance" disabled/);

    const expedition = createElement();
    expedition.dataset.expeditionReward = 'archive';
    documentListeners.get('click')({ target: expedition });
    assert.equal(elements.get('#core-value').textContent, '7');
    assert.match(elements.get('#exploration-list').innerHTML, /data-expedition-reward="archive" disabled/);
    assert.equal(elements.get('#expedition-notice').hidden, true);

    const achievement = createElement();
    achievement.dataset.achievement = 'firstGuardian';
    documentListeners.get('click')({ target: achievement });
    assert.equal(elements.get('#core-value').textContent, '10');
    assert.match(elements.get('#collection-list').innerHTML, /data-achievement="firstGuardian" disabled/);

    const collectionTab = createElement();
    collectionTab.dataset.tab = 'collection';
    documentListeners.get('click')({ target: collectionTab });
    assert.equal(elements.get('#collection-list').hidden, false);
    assert.equal(elements.get('#upgrade-list').hidden, true);
    assert.ok(elements.get('#journey-goals').innerHTML.includes('长期'));

    const mobileBuildButton = createElement();
    mobileBuildButton.dataset.mobileTarget = '#build-panel';
    documentListeners.get('click')({ target: mobileBuildButton });

    assert.equal(elements.get('#build-panel').scrollCount, 1);

    // 焦点保护不能让遥测沿用旧的可用状态：冷却结束时就地更新，不换掉按钮。
    documentListeners.get('click')({ target: challenge });
    const focusedSkill = createElement();
    focusedSkill.dataset.skill = 'overload';
    focusedSkill.disabled = true;
    elements.get('#skill-list').querySelectorAll = () => [focusedSkill];
    elements.get('#skill-list').contains = (node) => node === focusedSkill;
    document.activeElement = focusedSkill;
    const beforeMarkup = elements.get('#skill-list').innerHTML;
    for (let frame = 1; frame <= 130; frame++) nextFrame(performance.now() + frame * 250);
    assert.equal(elements.get('#skill-list').innerHTML, beforeMarkup);
    assert.equal(focusedSkill.disabled, false);
    localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    assert.doesNotThrow(() => documentListeners.get('click')({ target: mobileBuildButton }));
    assert.equal(elements.get('#save-state').textContent, '保存失败 · 请保留页面');
  } finally {
    Math.random = originalRandom;
    delete globalThis.document;
    delete globalThis.localStorage;
    delete globalThis.window;
    delete globalThis.requestAnimationFrame;
  }
});
