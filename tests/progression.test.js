import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CORE_UPGRADE_DEFINITIONS,
  UPGRADE_DEFINITIONS,
  activateSkill,
  advanceGame,
  buyCoreUpgrade,
  buyTech,
  buyUpgrade,
  createGameState,
  getCoreUpgradeCost,
  getReforgeGain,
  getUpgradeCost,
  manualAttack,
  reforge,
} from '../src/game.js';

function simulateRun(state, maxSeconds, { manualEverySeconds = 0, metrics = null } = {}) {
  const ticks = maxSeconds * 4;
  for (let tick = 0; tick < ticks && !state.run.awaitingReforge; tick += 1) {
    for (const id of state.unlocked.skills) activateSkill(state, id);
    if (manualEverySeconds > 0 && tick % (manualEverySeconds * 4) === 0) manualAttack(state, [0.5, 0.5]);
    advanceGame(state, 0.25, [0.5, 0.5]);
    const cheapest = Object.entries(UPGRADE_DEFINITIONS)
      .filter(([, definition]) => definition.unlockNode <= state.highestNode)
      .sort(([left], [right]) => getUpgradeCost(state, left) - getUpgradeCost(state, right))[0];
    if (cheapest) buyUpgrade(state, cheapest[0], 'max');
    if (metrics && metrics.guardianReachedAt === null && state.enemy.isBoss) {
      metrics.guardianReachedAt = state.run.activeSeconds;
    }
  }
  return state;
}

function buyPermanentDamage(state) {
  while (buyTech(state, 'kineticTheory').bought) {
    // Deterministic pacing spends earned research instead of hoarding a combat resource.
  }
  while (true) {
    const id = ['damageMatrix', 'entropyLattice']
      .filter((candidate) => state.coreUpgrades[candidate] < CORE_UPGRADE_DEFINITIONS[candidate].maxLevel)
      .sort((left, right) => getCoreUpgradeCost(state, left) - getCoreUpgradeCost(state, right))[0];
    if (!id || !buyCoreUpgrade(state, id).bought) return;
  }
}

test('a fresh forge waits for active input instead of idling through the opening', () => {
  const state = simulateRun(createGameState(), 5 * 60);

  assert.equal(state.depth, 1);
  assert.equal(state.unlocked.autoAttack, false);
  assert.equal(state.run.attacks, 0);
});

test('active play unlocks automation through progress rather than elapsed time', () => {
  const active = simulateRun(createGameState(), 10 * 60, { manualEverySeconds: 0.5 });
  const slowTicks = createGameState();
  slowTicks.bestDepth = 12;
  advanceGame(slowTicks, 0.01);

  assert.ok(active.bestDepth >= 12, `active play only reached depth ${active.bestDepth}`);
  assert.equal(active.unlocked.autoAttack, true);
  assert.equal(slowTicks.unlocked.autoAttack, true);
});

test('deeper checkpoints fund permanent protocols without fixed twelve-shard repetition', () => {
  const gains = [30, 40, 50, 60, 80, 100].map((depth) => {
    const state = createGameState();
    state.depth = depth;
    state.bestDepth = depth;
    state.run.guardiansDefeated = 1;
    state.run.lockedDepth = depth;
    return getReforgeGain(state);
  });

  for (let index = 1; index < gains.length; index += 1) assert.ok(gains[index] > gains[index - 1]);
  assert.deepEqual(gains, [12, 19, 32, 53, 146, 399]);
});
