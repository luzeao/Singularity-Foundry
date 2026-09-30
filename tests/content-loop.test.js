import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/game.js';

function prepared() {
  const state = game.createGameState();
  state.depth = state.bestDepth = state.highestNode = 15;
  state.unlocked.modules = ['resonanceCore', 'fractureLens', 'timeCapacitor'];
  state.unlocked.skills = ['singularityCannon', 'timeFold'];
  state.enemy.health = state.enemy.maxHealth = 1e9;
  return state;
}

test('specialization requires depth 12 and cannot be swapped mid-sector', () => {
  assert.equal(typeof game.chooseSpecialization, 'function');
  const state = game.createGameState();
  assert.equal(game.chooseSpecialization(state, 'resonance').chosen, false);
  state.bestDepth = 12;
  assert.equal(game.chooseSpecialization(state, 'resonance').chosen, true);
  assert.equal(game.chooseSpecialization(state, 'fracture').chosen, false);
  state.run.awaitingDecision = true;
  assert.equal(game.chooseSpecialization(state, 'fracture').chosen, true);
});

test('resonance specialization strengthens its tenth-attack burst only with the core', () => {
  assert.equal(typeof game.chooseSpecialization, 'function');
  const state = prepared();
  game.chooseSpecialization(state, 'resonance');
  state.equippedModules = ['resonanceCore'];
  state.run.attacks = 9;
  const burst = game.manualAttack(state, [0.99]).events.find((e) => e.type === 'resonanceDamage');
  assert.equal(burst.damage, 6);
});

test('fracture specialization creates a reliable 50-percent echo', () => {
  assert.equal(typeof game.chooseSpecialization, 'function');
  const state = prepared();
  state.equippedModules = ['fractureLens'];
  game.chooseSpecialization(state, 'fracture');
  const events = game.manualAttack(state, [0, 0.4]).events;
  assert.ok(events.some((e) => e.type === 'criticalEcho'));
});

test('singularity specialization strengthens cannon and fold resets its cooldown', () => {
  assert.equal(typeof game.chooseSpecialization, 'function');
  const state = prepared();
  state.equippedModules = ['timeCapacitor'];
  game.chooseSpecialization(state, 'singularity');
  assert.equal(game.activateSkill(state, 'singularityCannon').events[0].damage, 18);
  game.activateSkill(state, 'timeFold');
  assert.equal(state.skillCooldowns.singularityCannon, 0);
});

test('deep dive spawns a midway event with single-use resource choice', () => {
  assert.equal(typeof game.chooseExpeditionReward, 'function');
  const state = prepared();
  state.depth = 14;
  state.node = 4;
  state.enemy.health = 1;
  game.manualAttack(state, [0.99]);
  assert.equal(state.depth, 15);
  assert.equal(state.run.expedition.depth, 15);
  assert.equal(game.chooseExpeditionReward(state, 'archive').chosen, true);
  assert.equal(state.coreShards, 2);
  assert.equal(game.chooseExpeditionReward(state, 'archive').chosen, false);
  assert.equal(state.coreShards, 2);
});

test('sector damage choice expires on guardian defeat', () => {
  assert.equal(typeof game.chooseExpeditionReward, 'function');
  const state = prepared();
  state.run.expedition = { depth: 15, choice: null };
  game.chooseExpeditionReward(state, 'assault');
  assert.equal(game.deriveStats(state).attack, 1.4);
  state.depth = 30;
  state.enemy = { ...state.enemy, isBoss: true, id: 'gravity-guardian', health: 1, vulnerability: 0 };
  game.manualAttack(state, [0.99]);
  assert.equal(game.deriveStats(state).attack, 1);
  assert.equal(state.run.expedition, null);
});

test('guardian drops grow deterministically and mastery requires a matching module', () => {
  assert.equal(typeof game.chooseSpecialization, 'function');
  const state = prepared();
  game.chooseSpecialization(state, 'resonance');
  for (let index = 0; index < 3; index++) {
    state.effects.manualPulseCooldown = 0;
    state.run.awaitingDecision = state.run.awaitingReforge = false;
    state.depth = 30 + index * 10;
    state.enemy = { ...state.enemy, isBoss: true, id: 'gravity-guardian', health: 1, vulnerability: 0 };
    game.manualAttack(state, [0.99]);
  }
  assert.equal(state.journey.relics['gravity-guardian'], 3);
  assert.equal(state.journey.mastery.resonance, 0);
  assert.equal(state.journey.peakDepth, 50);
  assert.ok(game.deriveStats(state).bossDamageMultiplier > 1);
});

test('equipped specialization earns persistent guardian mastery', () => {
  assert.equal(typeof game.chooseSpecialization, 'function');
  const state = prepared();
  state.equippedModules = ['resonanceCore'];
  game.chooseSpecialization(state, 'resonance');
  state.depth = 30;
  state.enemy = { ...state.enemy, isBoss: true, id: 'gravity-guardian', health: 1, vulnerability: 0 };
  game.manualAttack(state, [0.99]);
  assert.equal(state.journey.mastery.resonance, 1);
  const next = game.reforge(state);
  assert.equal(next.journey.mastery.resonance, 1);
  assert.equal(next.journey.specialization, 'resonance');
  assert.equal(next.journey.relics['gravity-guardian'], 1);
  assert.equal(next.run.sectorBuff, null);
});

test('achievement rewards are claimable once and survive save and reforge', () => {
  assert.equal(typeof game.claimAchievement, 'function');
  const state = prepared();
  assert.equal(game.claimAchievement(state, 'firstGuardian').claimed, false);
  state.lifetime.bosses = 1;
  state.run.lockedDepth = state.depth = state.bestDepth = 30;
  state.run.guardiansDefeated = 1;
  assert.equal(game.claimAchievement(state, 'firstGuardian').claimed, true);
  assert.equal(state.coreShards, 3);
  assert.equal(game.claimAchievement(state, 'firstGuardian').claimed, false);
  const restored = game.deserializeGame(game.serializeGame(game.reforge(state)));
  assert.deepEqual(restored.journey.claimedAchievements, ['firstGuardian']);
});

test('legacy guardian decision restores valid choices without discarding resources', () => {
  const state = prepared();
  state.entropy = 1234;
  state.depth = state.bestDepth = 30;
  state.run.awaitingReforge = true;
  delete state.run.awaitingDecision;
  delete state.run.lawChoices;
  const restored = game.deserializeGame(JSON.stringify(state));
  assert.equal(restored.entropy, 1234);
  assert.equal(restored.run.lawChoices.length, 3);
  assert.equal(game.continueDeepDive(restored, restored.run.lawChoices[0]).continued, true);
});

test('malformed optional journey fields are locally repaired, not a save reset', () => {
  const state = prepared();
  state.entropy = 987;
  state.journey = { specialization: 'unknown', mastery: null, relics: [], claimedAchievements: ['unknown'] };
  const restored = game.deserializeGame(JSON.stringify(state));
  assert.equal(restored.entropy, 987);
  assert.equal(restored.journey.specialization, null);
  assert.equal(restored.journey.mastery.resonance, 0);
  assert.deepEqual(restored.journey.claimedAchievements, []);
});

test('decision reading pauses cooldowns and temporary burst effects', () => {
  const state = prepared();
  state.run.awaitingDecision = state.run.awaitingReforge = true;
  state.skillCooldowns.singularityCannon = 10;
  state.effects.overdriveTime = 8;
  game.advanceGame(state, 20);
  assert.equal(state.skillCooldowns.singularityCannon, 10);
  assert.equal(state.effects.overdriveTime, 8);
});

test('build preset restores specialization at reforge but cannot bypass sector lock', () => {
  const state = prepared();
  state.lifetime.reforges = 1;
  game.chooseSpecialization(state, 'resonance');
  state.equippedModules = ['resonanceCore'];
  game.saveBuildPreset(state);
  state.run.awaitingDecision = true;
  game.chooseSpecialization(state, 'fracture');
  state.run.awaitingDecision = false;
  assert.equal(game.loadBuildPreset(state).loaded, false);
  state.run.buildCommitted = false;
  assert.equal(game.loadBuildPreset(state).loaded, true);
  assert.equal(state.journey.specialization, 'resonance');
});

test('mirror sector alternates all guardian phases, including non-mirror guardians', () => {
  const state = prepared();
  state.run.currentLaw = 'mirrorCircuit';
  state.depth = 39;
  state.node = 9;
  state.enemy.health = 1;
  game.manualAttack(state, [0.99]);
  assert.equal(state.enemy.isBoss, true);
  assert.equal(state.enemy.phase, 'attack');
  game.advanceGame(state, 8);
  assert.equal(state.enemy.phase, 'skill');
});

test('guardian reward upgrades have a real effect on locked core payout', () => {
  const state = prepared();
  state.depth = state.bestDepth = state.run.lockedDepth = 30;
  state.run.guardiansDefeated = 1;
  state.upgrades.bossReward = 1;
  state.coreUpgrades.guardianLens = 1;
  assert.equal(game.getReforgeGain(state), 25);
});

test('invalid inherited achievement ids cannot throw or grant rewards', () => {
  const state = prepared();
  assert.deepEqual(game.claimAchievement(state, 'constructor'), { claimed: false });
  assert.equal(state.coreShards, 0);
});

test('legacy mirror-sector guardian restores phase and timer locally', () => {
  const state = prepared();
  state.depth = state.bestDepth = state.highestNode = 40;
  state.node = 11;
  state.run.currentLaw = 'mirrorCircuit';
  state.enemy = { ...state.enemy, id: 'gravity-guardian', isBoss: true, phase: null, vulnerability: 0, pulseTimer: 12 };
  const restored = game.deserializeGame(JSON.stringify(state));
  assert.equal(restored.enemy.phase, 'attack');
  game.advanceGame(restored, 8);
  assert.equal(restored.enemy.phase, 'skill');
});
