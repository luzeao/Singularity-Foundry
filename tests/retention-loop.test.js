import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SECTOR_LAW_DEFINITIONS,
  advanceGame,
  continueDeepDive,
  createGameState,
  getReforgeGain,
  getReforgeGainBreakdown,
  getSectorModifiers,
  loadBuildPreset,
  manualAttack,
  saveBuildPreset,
} from '../src/game.js';

function guardianReadyState() {
  const state = createGameState();
  state.depth = 30;
  state.bestDepth = 30;
  state.region = 2;
  state.node = 11;
  state.enemy = {
    id: 'gravity-guardian', name: '重力守卫', health: 1, maxHealth: 1,
    isBoss: true, level: 1, aliveSeconds: 0, vulnerability: 0, pulseTimer: 12,
  };
  return state;
}

test('guardian decision locks combat and accepts exactly one law choice', () => {
  const state = guardianReadyState();
  manualAttack(state, [0.99]);

  assert.equal(state.run.awaitingDecision, true);
  assert.equal(state.run.guardiansDefeated, 1);
  assert.equal(state.run.lawChoices.length, 3);
  assert.equal(new Set(state.run.lawChoices).size, 3);
  assert.ok(state.run.lawChoices.every((id) => SECTOR_LAW_DEFINITIONS[id]));
  assert.equal(manualAttack(state, [0.99]).attacked, false);

  const selected = state.run.lawChoices[0];
  const lockedGain = getReforgeGain(state);
  assert.equal(continueDeepDive(state, 'unknown').continued, false);
  assert.equal(continueDeepDive(state, selected).continued, true);
  assert.equal(state.depth, 31);
  assert.equal(state.run.currentLaw, selected);
  assert.equal(getReforgeGain(state), lockedGain);
  assert.equal(continueDeepDive(state, selected).continued, false);
});

test('all five sector laws change a build decision and add finite core risk', () => {
  for (const lawId of Object.keys(SECTOR_LAW_DEFINITIONS)) {
    const state = createGameState();
    state.run.currentLaw = lawId;
    const modifiers = getSectorModifiers(state);
    assert.ok(modifiers.core > 1, `${lawId} needs a core reward`);
    assert.equal(Number.isFinite(modifiers.core), true);
  }

  const silence = createGameState();
  silence.run.currentLaw = 'silenceProtocol';
  assert.equal(getSectorModifiers(silence).skillsDisabled, true);
  const absolute = createGameState();
  absolute.run.currentLaw = 'absoluteSequence';
  assert.equal(getSectorModifiers(absolute).attackSpeedCap, 1);
  const mirror = createGameState();
  mirror.run.currentLaw = 'mirrorCircuit';
  assert.equal(getSectorModifiers(mirror).mirrorGuardian, true);
  const entropy = createGameState();
  entropy.run.currentLaw = 'entropyAdaptation';
  assert.equal(getSectorModifiers(entropy).entropyAdaptation, true);
});

test('continuing from the first guardian reaches the next endless guardian at depth forty', () => {
  const state = guardianReadyState();
  manualAttack(state, [0.99]);
  continueDeepDive(state, state.run.lawChoices[0]);
  state.upgrades.attack = 100;

  while (state.depth < 40 && !state.run.awaitingDecision) {
    state.enemy.health = 1;
    manualAttack(state, [0.99]);
    advanceGame(state, 0.13);
  }

  assert.equal(state.depth, 40);
  assert.equal(state.enemy.isBoss, true);
  assert.equal(state.run.awaitingDecision, false);
});

test('reforge gain grows with depth, guardian streak, and selected risk', () => {
  const expected = new Map([[30, 12], [40, 19], [50, 32], [60, 53]]);
  for (const [depth, total] of expected) {
    const state = createGameState();
    state.depth = depth;
    state.bestDepth = depth;
    state.run.guardiansDefeated = 1;
    state.run.lockedDepth = depth;
    assert.equal(getReforgeGain(state), total);
  }

  const state = createGameState();
  state.depth = 50;
  state.bestDepth = 50;
  state.run.guardiansDefeated = 3;
  state.run.lockedDepth = 50;
  state.run.riskProduct = 1.4;
  const breakdown = getReforgeGainBreakdown(state);
  assert.equal(breakdown.streakMultiplier, 1.16);
  assert.equal(breakdown.riskMultiplier, 1.4);
  assert.ok(breakdown.total > 32);
  assert.equal(Number.isFinite(breakdown.total), true);
});

test('automation priorities and the first build preset never copy progression', () => {
  const state = createGameState();
  state.unlocked.autoBuy = true;
  state.settings.autoBuy = true;
  state.settings.autoBuyPriority = 'damage';
  state.highestNode = 30;
  state.entropy = 1_000;
  advanceGame(state, 0.25);
  assert.equal(state.upgrades.attack, 1);

  state.lifetime.reforges = 1;
  state.unlocked.modules = ['resonanceCore'];
  state.equippedModules = ['resonanceCore'];
  state.settings.autoBuyPriority = 'economy';
  assert.equal(saveBuildPreset(state, 0).saved, true);
  const entropy = state.entropy;
  state.equippedModules = [];
  state.settings.autoBuyPriority = 'cheapest';
  assert.equal(loadBuildPreset(state, 0).loaded, true);
  assert.deepEqual(state.equippedModules, ['resonanceCore']);
  assert.equal(state.settings.autoBuyPriority, 'economy');
  assert.equal(state.entropy, entropy);
});
