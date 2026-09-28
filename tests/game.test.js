import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MODULE_DEFINITIONS,
  SKILL_DEFINITIONS,
  activateSkill,
  advanceGame,
  applyOfflineProgress,
  buyUpgrade,
  createGameState,
  deserializeGame,
  deriveStats,
  getReforgeGain,
  manualAttack,
  reforge,
  serializeGame,
  toggleModule,
} from '../src/game.js';

test('new game starts with the documented baseline combat stats', () => {
  const state = createGameState();
  const stats = deriveStats(state);

  assert.equal(stats.attack, 1);
  assert.equal(stats.attackSpeed, 1);
  assert.equal(stats.critChance, 0.05);
  assert.equal(stats.critDamage, 2);
  assert.equal(stats.entropyMultiplier, 1);
});

test('an upgrade purchase succeeds when entropy exactly matches its cost', () => {
  const state = createGameState();
  state.entropy = 10;

  const result = buyUpgrade(state, 'attack', 1);

  assert.equal(result.bought, 1);
  assert.equal(state.entropy, 0);
  assert.equal(state.upgrades.attack, 1);
  assert.equal(deriveStats(state).attack, 1.167);
});

test('automatic attacks damage the current law node', () => {
  const state = createGameState();
  const startingHealth = state.enemy.health;

  advanceGame(state, 1, [0.99]);

  assert.equal(state.enemy.health, startingHealth - 1);
  assert.equal(state.run.attacks, 1);
});

test('a manual pulse immediately performs one real attack', () => {
  const state = createGameState();
  const startingHealth = state.enemy.health;

  const result = manualAttack(state, [0.99]);

  assert.equal(state.enemy.health, startingHealth - 1);
  assert.equal(state.run.attacks, 1);
  assert.ok(result.events.some((event) => event.type === 'manualPulse' && event.damage === 1));
});

test('a critical roll applies the critical damage multiplier', () => {
  const state = createGameState();
  const startingHealth = state.enemy.health;

  advanceGame(state, 1, [0]);

  assert.equal(state.enemy.health, startingHealth - 2);
  assert.equal(state.run.criticalHits, 1);
});

test('destroying a node grants entropy and advances to the next node', () => {
  const state = createGameState();
  state.enemy.health = 1;

  advanceGame(state, 1, [0.99]);

  assert.equal(state.entropy, 5);
  assert.equal(state.node, 2);
  assert.equal(state.run.kills, 1);
  assert.ok(state.enemy.health > 1);
});

test('a single active simulation call caps excessive elapsed time', () => {
  const state = createGameState();

  const result = advanceGame(state, 86_400, []);

  assert.equal(result.simulatedSeconds, 600);
  assert.equal(state.run.activeSeconds, 600);
});

test('overload doubles attack speed for its active duration', () => {
  const state = createGameState();
  state.unlocked.skills = ['overload'];

  const result = activateSkill(state, 'overload');

  assert.equal(result.activated, true);
  assert.equal(deriveStats(state).attackSpeed, 2);
  assert.equal(state.effects.overload, SKILL_DEFINITIONS.overload.duration);
});

test('singularity cannon deals a burst based on skill power', () => {
  const state = createGameState();
  state.unlocked.skills = ['singularityCannon'];
  const result = activateSkill(state, 'singularityCannon');

  assert.equal(result.activated, true);
  assert.ok(result.events.some((event) => event.type === 'skillDamage' && event.damage === 10));
  assert.equal(state.node, 2);
});

test('time fold removes thirty percent of other remaining cooldowns', () => {
  const state = createGameState();
  state.unlocked.skills = ['timeFold'];
  state.skillCooldowns = { overload: 20, singularityCannon: 10, timeFold: 0 };

  activateSkill(state, 'timeFold');

  assert.equal(state.skillCooldowns.overload, 14);
  assert.equal(state.skillCooldowns.singularityCannon, 7);
});

test('only two modules can be equipped and every MVP module is defined', () => {
  const state = createGameState();
  state.unlocked.modules = Object.keys(MODULE_DEFINITIONS);

  assert.equal(Object.keys(MODULE_DEFINITIONS).length, 6);
  assert.equal(toggleModule(state, 'resonanceCore').equipped, true);
  assert.equal(toggleModule(state, 'fractureLens').equipped, true);
  assert.equal(toggleModule(state, 'timeCapacitor').equipped, false);
  assert.deepEqual(state.equippedModules, ['resonanceCore', 'fractureLens']);
});

test('resonance core gains a speed stack after ten attacks', () => {
  const state = createGameState();
  state.equippedModules = ['resonanceCore'];
  state.upgrades.speed = 13;

  advanceGame(state, 1, Array(10).fill(0.99));

  assert.equal(state.effects.resonanceStacks, 1);
  assert.ok(deriveStats(state).attackSpeed > 10);
});

test('fracture lens echoes critical damage and time capacitor reduces cooldowns', () => {
  const state = createGameState();
  state.equippedModules = ['fractureLens', 'timeCapacitor'];
  state.skillCooldowns = { overload: 10 };
  state.enemy.health = 100;

  const result = advanceGame(state, 1, [0, 0]);

  assert.equal(state.enemy.health, 96);
  assert.ok(result.events.some((event) => event.type === 'criticalEcho'));
  assert.equal(state.skillCooldowns.overload, 8.9);
});

test('overload amplifier converts uncapped attack speed into skill power', () => {
  const state = createGameState();
  state.equippedModules = ['overloadAmplifier'];
  state.upgrades.speed = 20;

  const stats = deriveStats(state);

  assert.equal(stats.attackSpeed, 10);
  assert.ok(stats.skillPower > 1);
});

test('singularity lens focuses every twelfth attack', () => {
  const state = createGameState();
  state.equippedModules = ['singularityLens'];
  state.upgrades.speed = 40;
  state.enemy.health = 1_000;

  const result = advanceGame(state, 1.2, Array(12).fill(0.99));

  assert.ok(result.events.some((event) => event.type === 'focusedAttack'));
  assert.equal(state.enemy.health, 969);
});

test('entropy recycler refunds cooldown when a skill destroys a node', () => {
  const state = createGameState();
  state.unlocked.skills = ['singularityCannon'];
  state.equippedModules = ['entropyRecycler'];
  state.enemy.health = 1;

  activateSkill(state, 'singularityCannon');

  assert.equal(state.skillCooldowns.singularityCannon, 14);
  assert.equal(state.node, 2);
});

test('clearing the three regions spawns and defeats the gravity guardian', () => {
  const state = createGameState();
  state.upgrades.attack = 30;
  state.upgrades.speed = 40;

  for (let step = 0; step < 40 && !state.enemy.isBoss; step += 1) {
    state.enemy.health = 1;
    advanceGame(state, 0.1, [0.99]);
  }

  assert.equal(state.enemy.isBoss, true);
  assert.equal(state.enemy.name, '重力守卫');
  state.enemy.health = 1;
  const result = advanceGame(state, 0.1, [0.99]);
  assert.equal(state.run.bosses, 1);
  assert.equal(state.completed, true);
  assert.ok(result.events.some((event) => event.type === 'bossDefeated'));
});

test('the gravity guardian gains vulnerability from sustained hits', () => {
  const state = createGameState();
  state.enemy = {
    id: 'gravity-guardian', name: '重力守卫', health: 1_000, maxHealth: 1_000,
    isBoss: true, aliveSeconds: 0, vulnerability: 0, pulseTimer: 12,
  };
  state.upgrades.speed = 10;

  advanceGame(state, 1, Array(5).fill(0.99));

  assert.ok(state.enemy.vulnerability >= 0.1);
  assert.ok(state.enemy.health < 995);
});

test('reforge preview and reset preserve permanent unlocks only', () => {
  const state = createGameState();
  state.highestNode = 31;
  state.run.bosses = 1;
  state.lifetime.bosses = 1;
  state.entropy = 999;
  state.upgrades.attack = 8;
  state.unlocked.skills = Object.keys(SKILL_DEFINITIONS);
  state.unlocked.modules = Object.keys(MODULE_DEFINITIONS);

  assert.equal(getReforgeGain(state), 10);
  const next = reforge(state);

  assert.equal(next.coreShards, 10);
  assert.equal(next.entropy, 0);
  assert.equal(next.upgrades.attack, 0);
  assert.deepEqual(next.unlocked.skills, Object.keys(SKILL_DEFINITIONS));
  assert.equal(next.unlocked.autoBuy, true);
  assert.equal(next.lifetime.reforges, 1);
});

test('save data round-trips game progress and receives a fresh object', () => {
  const state = createGameState();
  state.entropy = 12_345;
  state.upgrades.attack = 7;
  state.equippedModules = ['resonanceCore'];

  const restored = deserializeGame(serializeGame(state));

  assert.equal(restored.entropy, 12_345);
  assert.equal(restored.upgrades.attack, 7);
  assert.deepEqual(restored.equippedModules, ['resonanceCore']);
  assert.notEqual(restored, state);
});

test('corrupt save data safely starts a new game', () => {
  const restored = deserializeGame('{not-json');

  assert.equal(restored.entropy, 0);
  assert.equal(restored.region, 0);
  assert.equal(restored.node, 1);
  assert.ok(restored.logs[0].includes('存档'));
});

test('structurally corrupt save fields safely start a new game', () => {
  const brokenSaves = [
    { version: 1, unlocked: { skills: null } },
    { version: 1, lastSavedAt: 'broken' },
    { version: 1, upgrades: { attack: 'broken' } },
    { version: 1, region: 99 },
    { version: 1, unlocked: { skills: ['unknown-skill'] } },
  ];

  for (const broken of brokenSaves) {
    const restored = deserializeGame(JSON.stringify(broken));
    assert.equal(restored.region, 0);
    assert.equal(restored.entropy, 0);
    assert.deepEqual(restored.unlocked.skills, []);
    assert.ok(restored.logs[0].includes('存档'));
    assert.doesNotThrow(() => advanceGame(restored, 1));
  }
});

test('offline progress uses 80, 50, and 20 percent segments', () => {
  const state = createGameState();
  const now = 2_000_000_000_000;
  state.lastSavedAt = now - 25 * 60 * 60 * 1000;

  const result = applyOfflineProgress(state, now);

  assert.equal(result.elapsedSeconds, 25 * 60 * 60);
  assert.equal(result.effectiveSeconds, 14.6 * 60 * 60);
  assert.equal(result.entropyGained, 26_280);
  assert.equal(state.entropy, 26_280);
  assert.equal(state.lastSavedAt, now);
});

test('offline progress caps elapsed time at seventy-two hours', () => {
  const state = createGameState();
  const now = 2_000_000_000_000;
  state.lastSavedAt = now - 100 * 60 * 60 * 1000;

  const result = applyOfflineProgress(state, now);

  assert.equal(result.elapsedSeconds, 72 * 60 * 60);
  assert.equal(result.effectiveSeconds, 24 * 60 * 60);
});

test('large time steps match equivalent quarter-second steps', () => {
  const largeStep = createGameState();
  largeStep.unlocked.skills = ['overload'];
  largeStep.skillCooldowns.overload = 0;
  activateSkill(largeStep, 'overload');
  largeStep.enemy.health = 10_000;
  const smallSteps = deserializeGame(serializeGame(largeStep));

  advanceGame(largeStep, 30, Array(200).fill(0.5));
  for (let index = 0; index < 120; index += 1) advanceGame(smallSteps, 0.25, [0.5, 0.5]);

  assert.equal(largeStep.run.attacks, smallSteps.run.attacks);
  assert.equal(largeStep.run.damage, smallSteps.run.damage);
  assert.equal(largeStep.effects.overload, smallSteps.effects.overload);
});

test('gravity pulse timer stays within its twelve-second cycle after a large step', () => {
  const state = createGameState();
  state.enemy = {
    id: 'gravity-guardian', name: '重力守卫', health: 1e9, maxHealth: 1e9,
    isBoss: true, aliveSeconds: 0, vulnerability: 1, pulseTimer: 12,
  };

  advanceGame(state, 60, Array(100).fill(0.5));

  assert.ok(state.enemy.pulseTimer > 0 && state.enemy.pulseTimer <= 12);
});

test('resonance circuit increases the damage of each resonance trigger', () => {
  const baseline = createGameState();
  baseline.equippedModules = ['resonanceCore'];
  baseline.enemy.health = 1e9;
  baseline.upgrades.speed = 13;
  const upgraded = deserializeGame(serializeGame(baseline));
  upgraded.upgrades.resonance = 2;

  const baselineResult = advanceGame(baseline, 1, Array(20).fill(0.5));
  const upgradedResult = advanceGame(upgraded, 1, Array(20).fill(0.5));
  const baselineDamage = baselineResult.events.find((event) => event.type === 'resonanceDamage').damage;
  const upgradedDamage = upgradedResult.events.find((event) => event.type === 'resonanceDamage').damage;

  assert.ok(upgradedDamage > baselineDamage);
  assert.equal(upgradedDamage / baselineDamage, 2.25);
});
