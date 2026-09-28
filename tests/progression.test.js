import test from 'node:test';
import assert from 'node:assert/strict';

import {
  UPGRADE_DEFINITIONS,
  activateSkill,
  advanceGame,
  buyUpgrade,
  createGameState,
  getReforgeGain,
  getUpgradeCost,
} from '../src/game.js';

function simulateFocusedPlayer(maxSeconds) {
  const state = createGameState();
  const ticks = maxSeconds * 4;
  for (let tick = 0; tick < ticks && !state.completed; tick += 1) {
    for (const id of state.unlocked.skills) activateSkill(state, id);
    advanceGame(state, 0.25, [0.5, 0.5]);
    const cheapest = Object.entries(UPGRADE_DEFINITIONS)
      .filter(([, definition]) => definition.unlockNode <= state.highestNode)
      .sort(([left], [right]) => getUpgradeCost(state, left) - getUpgradeCost(state, right))[0];
    if (cheapest) buyUpgrade(state, cheapest[0], 'max');
  }
  return state;
}

test('a focused first run reaches reforge in twenty to ninety minutes', () => {
  const state = simulateFocusedPlayer(90 * 60);

  assert.equal(state.completed, true);
  assert.ok(state.run.activeSeconds >= 20 * 60, `completed too quickly in ${state.run.activeSeconds}s`);
  assert.ok(state.run.activeSeconds <= 90 * 60, `did not complete in time: ${state.run.activeSeconds}s`);
  assert.ok(getReforgeGain(state) >= 10);
});

