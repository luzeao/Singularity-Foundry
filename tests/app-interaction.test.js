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
  };
}

test('focused action lists refresh immediately after their user action', async () => {
  const elements = new Map();
  const selectors = [
    '#entropy-value', '#core-value', '#run-time', '#save-state', '#next-goal', '#mission-progress',
    '#region-label', '#node-label', '#enemy-name', '#enemy-type', '#enemy-health', '#enemy-percent',
    '#health-fill', '.health-track', '#enemy-timer', '#boss-rule', '#forge-visual', '#combat-callout',
    '#skill-dock', '#upgrade-list', '#skill-list', '#module-list', '#module-count', '#build-label',
    '#stat-attack', '#stat-speed', '#stat-crit', '#stat-crit-damage', '#stat-skill', '#stat-resource',
    '#breakdown-list', '#automation-card', '#auto-buy-toggle', '#highest-node', '#kill-count',
    '#damage-count', '#reforge-preview', '#reforge-hint', '#reforge-button', '#reforge-dialog',
    '#dialog-gain', '#confirm-reforge', '#event-log', '#log-count',
  ];
  for (const selector of selectors) elements.set(selector, createElement());

  const documentListeners = new Map();
  const initialState = createGameState();
  initialState.entropy = 10;
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
  globalThis.requestAnimationFrame = () => 0;

  const originalRandom = Math.random;
  Math.random = () => 0.99;
  try {
    await import(`../src/app.js?interaction=${Date.now()}`);

    const manualButton = elements.get('#forge-visual');
    manualButton.dataset.manualAttack = '';
    documentListeners.get('click')({ target: manualButton });
    assert.equal(elements.get('#enemy-health').textContent, '7 / 8');

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

    const moduleButton = createElement();
    moduleButton.dataset.module = 'resonanceCore';
    document.activeElement = moduleButton;
    elements.get('#module-list').contains = (node) => node === moduleButton;
    documentListeners.get('click')({ target: moduleButton });

    assert.match(elements.get('#module-list').innerHTML, /class="action-card equipped"/);
    assert.match(elements.get('#module-list').innerHTML, />卸下</);
    assert.equal(elements.get('#module-count').textContent, '1/2');
  } finally {
    Math.random = originalRandom;
    delete globalThis.document;
    delete globalThis.localStorage;
    delete globalThis.window;
    delete globalThis.requestAnimationFrame;
  }
});
