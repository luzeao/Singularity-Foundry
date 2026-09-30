import test from 'node:test';
import assert from 'node:assert/strict';

import {
  UPGRADE_DEFINITIONS,
  advanceGame,
  buyUpgrade,
  createGameState,
  getUpgradeCost,
  manualAttack,
} from '../src/game.js';

function simulateOpening(step = 0.25, limitSeconds = 10 * 60) {
  const state = createGameState();
  const moments = { firstUpgrade: null, secondType: null, attackDouble: null, drone: null };
  for (let elapsed = 0; elapsed < limitSeconds && !state.run.awaitingDecision; elapsed += step) {
    // Standard active play estimates one deliberate pulse every half second, independent of simulation step size.
    if (Math.round(elapsed / step) % Math.max(1, Math.round(0.5 / step)) === 0) manualAttack(state, [0.99, 0.99]);
    advanceGame(state, step, [0.99, 0.99]);
    const affordable = Object.entries(UPGRADE_DEFINITIONS)
      .filter(([, item]) => item.unlockNode <= state.highestNode)
      .sort(([left], [right]) => getUpgradeCost(state, left) - getUpgradeCost(state, right));
    if (affordable[0]) buyUpgrade(state, affordable[0][0], 1);
    if (moments.firstUpgrade === null && Object.values(state.upgrades).some(Boolean)) moments.firstUpgrade = elapsed + step;
    if (moments.secondType === null && Object.values(state.upgrades).filter(Boolean).length >= 2) moments.secondType = elapsed + step;
    if (moments.attackDouble === null && state.upgrades.attack >= 10) moments.attackDouble = elapsed + step;
    if (moments.drone === null && state.unlocked.autoAttack) moments.drone = elapsed + step;
  }
  return { state, moments };
}

test('opening pacing delivers repeated progress feedback before the drone takeover', () => {
  const { state, moments } = simulateOpening();

  assert.ok(moments.firstUpgrade <= 15, JSON.stringify(moments));
  assert.ok(moments.secondType <= 30, JSON.stringify(moments));
  assert.ok(moments.attackDouble <= 120, JSON.stringify(moments));
  assert.ok(moments.drone >= 3 * 60 && moments.drone <= 5 * 60, JSON.stringify(moments));
  assert.ok(state.bestDepth >= 12);
});

test('pulse drone unlock depends on depth and not simulation step size', () => {
  const fastTicks = simulateOpening(0.25).state;
  const slowTicks = simulateOpening(0.5).state;

  assert.equal(fastTicks.unlocked.autoAttack, true);
  assert.equal(slowTicks.unlocked.autoAttack, true);
  assert.ok(fastTicks.bestDepth >= 12);
  assert.ok(slowTicks.bestDepth >= 12);
});
