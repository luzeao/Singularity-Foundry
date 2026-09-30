import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CORE_UPGRADE_DEFINITIONS,
  CHALLENGE_DEFINITIONS,
  CHALLENGE_RANK_UNLOCKS,
  MODULE_DEFINITIONS,
  SKILL_DEFINITIONS,
  TECH_DEFINITIONS,
  activateSkill,
  advanceGame,
  applyOfflineProgress,
  buyCoreUpgrade,
  buyTech,
  buyUpgrade,
  cancelChallenge,
  createGameState,
  deserializeGame,
  deriveStats,
  getBossRuleText,
  getReforgeGain,
  getUpgradeCost,
  manualAttack,
  reforge,
  serializeGame,
  startChallenge,
  toggleModule,
} from '../src/game.js';
import {
  getDepthHealthScale,
  getDepthNode,
  getDepthRegion,
  isGuardianDepth,
} from '../src/progression.js';

test('new game starts with the documented baseline combat stats', () => {
  const state = createGameState();
  const stats = deriveStats(state);

  assert.equal(stats.attack, 1);
  assert.equal(stats.attackSpeed, 1);
  assert.equal(stats.critChance, 0.05);
  assert.equal(stats.critDamage, 2);
  assert.equal(stats.entropyMultiplier, 1);
});

test('continuous depth starts at the first finite themed node', () => {
  const state = createGameState();

  assert.equal(state.depth, 1);
  assert.equal(state.bestDepth, 1);
  assert.equal(state.region, 0);
  assert.equal(state.node, 1);
  assert.equal(Number.isFinite(state.enemy.health), true);
});

test('depth mapping cycles the three themes and marks endless guardian boundaries', () => {
  assert.deepEqual([1, 10, 11, 20, 21, 30, 31].map((depth) => [
    getDepthRegion(depth), getDepthNode(depth), isGuardianDepth(depth),
  ]), [
    [0, 1, false], [0, 10, false], [1, 1, false], [1, 10, false],
    [2, 1, false], [2, 10, true], [0, 1, false],
  ]);
  assert.equal(isGuardianDepth(40), true);
  assert.equal(isGuardianDepth(50), true);
});

test('extreme depth scaling remains finite', () => {
  assert.equal(Number.isFinite(getDepthHealthScale(10_000)), true);
  assert.ok(getDepthHealthScale(10_000) > 1);
});

test('an upgrade purchase succeeds when entropy exactly matches its cost', () => {
  const state = createGameState();
  state.entropy = getUpgradeCost(state, 'attack');

  const result = buyUpgrade(state, 'attack', 1);

  assert.equal(result.bought, 1);
  assert.equal(state.entropy, 0);
  assert.equal(state.upgrades.attack, 1);
  assert.equal(deriveStats(state).attack, 1.167);
});

test('core upgrades spend shards and permanently reshape combat stats', () => {
  const state = createGameState();
  state.coreShards = 20;

  assert.equal(buyCoreUpgrade(state, 'damageMatrix').bought, true);
  assert.equal(state.coreShards, 15);
  assert.equal(state.coreUpgrades.damageMatrix, 1);
  assert.equal(deriveStats(state).attack, 1.35);
  assert.equal(buyCoreUpgrade(state, 'damageMatrix').cost, 10);
});

test('reforge milestones accelerate cleared nodes without weakening new guardians', () => {
  const state = createGameState();
  state.lifetime.reforges = 1;

  assert.equal(deriveStats(state).attack, 2);

  state.enemy.isBoss = true;
  assert.equal(deriveStats(state).attack, 1);
});

test('unspent lifetime shards do not bypass permanent upgrade choices', () => {
  const state = createGameState();
  state.totalCoreShards = 1_000_000;
  state.coreShards = 1_000_000;

  assert.equal(deriveStats(state).attack, 1);
  assert.equal(deriveStats(state).entropyMultiplier, 1);
});

test('core upgrade caps and locked automation cannot consume shards', () => {
  const state = createGameState();
  state.coreShards = 1_000;
  state.coreUpgrades.autoSkills = CORE_UPGRADE_DEFINITIONS.autoSkills.maxLevel;

  const capped = buyCoreUpgrade(state, 'autoSkills');
  const unknown = buyCoreUpgrade(state, 'unknown');

  assert.equal(capped.bought, false);
  assert.equal(capped.reason, 'maxed');
  assert.equal(unknown.bought, false);
  assert.equal(state.coreShards, 1_000);
});

test('progressive automation keeps a new forge manual until the pulse drone unlocks', () => {
  const state = createGameState();
  const startingHealth = state.enemy.health;

  advanceGame(state, 1, [0.99]);

  assert.equal(state.enemy.health, startingHealth);
  assert.equal(state.unlocked.autoAttack, false);

  state.bestDepth = 12;
  advanceGame(state, 1, [0.99]);

  assert.equal(state.unlocked.autoAttack, true);
  assert.ok(state.enemy.health < startingHealth);
});

test('a manual pulse immediately performs one boosted real attack', () => {
  const state = createGameState();
  const startingHealth = state.enemy.health;

  const result = manualAttack(state, [0.99]);

  assert.equal(state.enemy.health, startingHealth - 1.35);
  assert.equal(state.run.attacks, 1);
  assert.ok(result.events.some((event) => event.type === 'manualPulse' && event.damage === 1.35));
});

test('manual pulse deals a bounded burst and charges overdrive', () => {
  const state = createGameState();
  state.enemy.health = 1_000;
  state.enemy.maxHealth = 1_000;
  const automaticDamage = deriveStats(state).attack;

  const result = manualAttack(state, [0.99]);
  const pulse = result.events.find((event) => event.type === 'manualPulse');

  assert.equal(result.attacked, true);
  assert.ok(pulse.damage > automaticDamage);
  assert.ok(Number.isFinite(pulse.damage));
  assert.equal(state.effects.overdriveCharge, 5);
});

test('repeated manual input cannot attack or charge overdrive', () => {
  const state = createGameState();

  const result = manualAttack(state, [0.99], { repeated: true });

  assert.equal(result.attacked, false);
  assert.equal(state.run.attacks, 0);
  assert.equal(state.effects.overdriveCharge, 0);
});

test('rapid manual inputs are rate-limited until game time advances', () => {
  const state = createGameState();
  state.enemy.health = 1_000;
  state.enemy.maxHealth = 1_000;

  const first = manualAttack(state, [0.99]);
  const immediate = manualAttack(state, [0.99]);
  advanceGame(state, 0.15, [0.99]);
  const later = manualAttack(state, [0.99]);

  assert.equal(first.attacked, true);
  assert.equal(immediate.attacked, false);
  assert.equal(later.attacked, true);
  assert.equal(state.effects.overdriveCharge, 10);
});

test('full overdrive charge creates a ten-second damage and entropy burst', () => {
  const state = createGameState();
  state.unlocked.autoAttack = true;
  state.effects.overdriveCharge = 95;
  state.enemy.health = 1_000;
  state.enemy.maxHealth = 1_000;

  manualAttack(state, [0.99]);

  assert.equal(state.effects.overdriveCharge, 0);
  assert.equal(state.effects.overdriveTime, 10);
  assert.equal(deriveStats(state).attack, 2);

  state.enemy.health = 1;
  advanceGame(state, 1, [0.99]);
  assert.equal(state.entropy, 8);
  assert.equal(state.effects.overdriveTime, 9);
});

test('reforge clears temporary overdrive state', () => {
  const state = createGameState();
  state.highestNode = 31;
  state.run.bosses = 1;
  state.effects.overdriveCharge = 60;
  state.effects.overdriveTime = 4;

  const next = reforge(state);

  assert.equal(next.effects.overdriveCharge, 0);
  assert.equal(next.effects.overdriveTime, 0);
});

test('attack upgrades gain an extra multiplier every ten levels', () => {
  const state = createGameState();
  state.upgrades.attack = 9;
  const levelNine = deriveStats(state).attack;
  state.upgrades.attack = 10;
  const levelTen = deriveStats(state).attack;

  assert.ok(levelTen / levelNine > 2.3);
  assert.ok(Math.abs(levelTen - 1.167 ** 10 * 2) < 1e-9);
});

test('a critical roll applies the critical damage multiplier', () => {
  const state = createGameState();
  state.unlocked.autoAttack = true;
  const startingHealth = state.enemy.health;

  advanceGame(state, 1, [0]);

  assert.equal(state.enemy.health, startingHealth - 2);
  assert.equal(state.run.criticalHits, 1);
});

test('destroying a node grants entropy and advances to the next node', () => {
  const state = createGameState();
  state.unlocked.autoAttack = true;
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

test('permanent module bay upgrades expand the equipped module limit', () => {
  const state = createGameState();
  state.unlocked.modules = Object.keys(MODULE_DEFINITIONS);
  state.coreUpgrades.moduleBay = 1;

  assert.equal(toggleModule(state, 'resonanceCore').equipped, true);
  assert.equal(toggleModule(state, 'fractureLens').equipped, true);
  assert.equal(toggleModule(state, 'timeCapacitor').equipped, true);
  assert.equal(toggleModule(state, 'entropyRecycler').full, true);
});

test('resonance core gains a speed stack after ten attacks', () => {
  const state = createGameState();
  state.unlocked.autoAttack = true;
  state.equippedModules = ['resonanceCore'];
  state.upgrades.speed = 13;

  advanceGame(state, 1, Array(10).fill(0.99));

  assert.equal(state.effects.resonanceStacks, 1);
  assert.ok(deriveStats(state).attackSpeed > 10);
});

test('resonance core bounds realtime attack simulation while preserving excess speed', () => {
  const state = createGameState();
  state.unlocked.autoAttack = true;
  state.upgrades.speed = 70;
  state.upgrades.multiStrike = 20;
  state.unlocked.modules = ['resonanceCore'];
  state.equippedModules = ['resonanceCore'];
  state.enemy.health = 1e300;
  state.enemy.maxHealth = 1e300;

  const stats = deriveStats(state);
  advanceGame(state, 0.25, [0.99]);

  assert.ok(stats.rawAttackSpeed > 300_000);
  assert.equal(stats.attackSpeed, 120);
  assert.equal(state.run.attacks, 180);
});

test('fracture lens echoes critical damage and time capacitor reduces cooldowns', () => {
  const state = createGameState();
  state.unlocked.autoAttack = true;
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
  state.unlocked.autoAttack = true;
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
  state.unlocked.autoAttack = true;
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
  assert.equal(state.enemy.name, '重力守卫');
  assert.equal(state.run.awaitingReforge, true);
  assert.match(state.logs[0], /重力守卫被击溃/);
});

test('the gravity guardian gains vulnerability from sustained hits', () => {
  const state = createGameState();
  state.unlocked.autoAttack = true;
  state.enemy = {
    id: 'gravity-guardian', name: '重力守卫', health: 1_000, maxHealth: 1_000,
    isBoss: true, aliveSeconds: 0, vulnerability: 0, pulseTimer: 12,
  };
  state.upgrades.speed = 10;

  advanceGame(state, 1, Array(5).fill(0.99));

  assert.ok(state.enemy.vulnerability >= 0.1);
  assert.ok(state.enemy.health < 995);
});

test('the mirror guardian alternates attack and skill vulnerability windows', () => {
  const state = createGameState();
  state.unlocked.autoAttack = true;
  state.enemy = {
    id: 'mirror-guardian', name: '镜像守卫', health: 1_000, maxHealth: 1_000,
    isBoss: true, level: 2, aliveSeconds: 0, vulnerability: 0, pulseTimer: 8, phase: 'attack',
  };
  state.unlocked.skills = ['singularityCannon'];
  state.skillCooldowns.singularityCannon = 0;

  manualAttack(state, [0.99]);
  assert.equal(state.enemy.health, 997.975);
  assert.match(getBossRuleText(state.enemy), /普通攻击/);

  advanceGame(state, 8, Array(40).fill(0.99));
  assert.equal(state.enemy.phase, 'skill');
  const beforeSkill = state.enemy.health;
  activateSkill(state, 'singularityCannon');
  assert.equal(beforeSkill - state.enemy.health, 15);
  assert.match(getBossRuleText(state.enemy), /技能/);
});

test('entropy guardian adaptation remains a soft wall for single-source builds', () => {
  const state = createGameState();
  state.unlocked.autoAttack = true;
  state.enemy = {
    id: 'entropy-guardian', name: '熵守卫', health: 10_000, maxHealth: 10_000,
    isBoss: true, level: 4, aliveSeconds: 0, vulnerability: 0, pulseTimer: 10,
    lastDamageSource: null, entropyResistance: 0,
  };

  for (let index = 0; index < 20; index += 1) {
    manualAttack(state, [0.99]);
    advanceGame(state, 0.12, [0.99]);
  }

  assert.equal(state.enemy.entropyResistance, 0.5);
  assert.ok(state.enemy.health < 9_990);
});

test('guardian ladder rotates through four distinct law mechanics', () => {
  let state = createGameState();
  state.enemy = {
    id: 'gravity-guardian', name: '重力守卫', health: 1, maxHealth: 1,
    isBoss: true, level: 1, aliveSeconds: 0, vulnerability: 0, pulseTimer: 12,
  };

  const names = [];
  for (let index = 0; index < 4; index += 1) {
    names.push(state.enemy.name);
    state.enemy.health = 1;
    manualAttack(state, [0.99]);
    if (index < 3) {
      state = reforge(state);
      state.region = 2;
      state.node = 10;
      state.highestNode = 30;
      state.enemy = { id: 'entropy-10', name: '热力节点', health: 1, maxHealth: 1, isBoss: false, aliveSeconds: 0 };
      manualAttack(state, [0.99]);
      advanceGame(state, 0.12, [0.99]);
    }
  }

  assert.deepEqual(names, ['重力守卫', '镜像守卫', '时间守卫', '熵守卫']);
  assert.equal(state.research.points, 4);
  assert.equal(state.research.discoveredGuardians.length, 4);
});

test('guardian ladder continues from permanent progress after a reforge', () => {
  const state = createGameState();
  state.research.totalPoints = 4;
  state.region = 2;
  state.node = 10;
  state.highestNode = 30;
  state.enemy.health = 1;

  manualAttack(state, [0.99]);

  assert.equal(state.enemy.level, 5);
  assert.equal(state.enemy.name, '重力守卫');
  assert.ok(state.enemy.maxHealth > 500_000);
  assert.ok(state.enemy.maxHealth < 1_000_000);
});

test('early guardian health uses a smooth finite curve instead of a hard exponential wall', () => {
  const state = createGameState();
  state.research.totalPoints = 9;
  state.region = 2;
  state.node = 10;
  state.highestNode = 30;
  state.enemy.health = 1;

  manualAttack(state, [0.99]);

  assert.equal(state.enemy.level, 10);
  assert.ok(state.enemy.maxHealth >= 1_000_000);
  assert.ok(state.enemy.maxHealth <= 10_000_000);
});

test('one guardian per run prevents an extreme attack batch from skipping levels', () => {
  const state = createGameState();
  state.upgrades.attack = 5_000;
  state.upgrades.multiStrike = 3_300;
  state.enemy = {
    id: 'gravity-guardian', name: '重力守卫', health: 1, maxHealth: 1,
    isBoss: true, level: 1, aliveSeconds: 0, vulnerability: 0, pulseTimer: 12,
  };

  manualAttack(state, [0.99]);

  assert.equal(state.research.totalPoints, 1);
  assert.equal(state.run.bosses, 1);
  assert.equal(state.run.awaitingReforge, true);
  assert.equal(state.enemy.name, '重力守卫');
  assert.equal(state.enemy.health, 0);
});

test('awaiting reforge blocks every combat path', () => {
  const state = createGameState();
  state.unlocked.skills = ['singularityCannon'];
  state.skillCooldowns.singularityCannon = 0;
  state.enemy = {
    id: 'gravity-guardian', name: '重力守卫', health: 1, maxHealth: 1,
    isBoss: true, level: 1, aliveSeconds: 0, vulnerability: 0, pulseTimer: 12,
  };
  manualAttack(state, [0.99]);
  const attacks = state.run.attacks;
  const damage = state.run.damage;

  manualAttack(state, [0.99]);
  advanceGame(state, 10, [0.99]);
  const skill = activateSkill(state, 'singularityCannon');

  assert.equal(state.run.attacks, attacks);
  assert.equal(state.run.damage, damage);
  assert.equal(skill.activated, false);
  assert.equal(state.research.totalPoints, 1);
});

test('guardian defeat grants research but no exponential run entropy', () => {
  const state = createGameState();
  state.entropy = 123;
  state.enemy = {
    id: 'gravity-guardian', name: '重力守卫', health: 1, maxHealth: 1,
    isBoss: true, level: 30, aliveSeconds: 0, vulnerability: 0, pulseTimer: 12,
  };

  manualAttack(state, [0.99]);

  assert.equal(state.entropy, 123);
  assert.equal(state.research.points, 1);
});

test('reforge begins a new run that leads to the next permanent guardian', () => {
  let state = createGameState();
  state.highestNode = 31;
  state.enemy = {
    id: 'gravity-guardian', name: '重力守卫', health: 1, maxHealth: 1,
    isBoss: true, level: 1, aliveSeconds: 0, vulnerability: 0, pulseTimer: 12,
  };
  manualAttack(state, [0.99]);

  state = reforge(state);
  state.region = 2;
  state.node = 10;
  state.highestNode = 30;
  state.enemy = { id: 'entropy-10', name: '热力节点', health: 1, maxHealth: 1, isBoss: false, aliveSeconds: 0 };
  manualAttack(state, [0.99]);

  assert.equal(state.run.awaitingReforge, false);
  assert.equal(state.enemy.isBoss, true);
  assert.equal(state.enemy.level, 2);
  assert.equal(state.enemy.name, '镜像守卫');
});

test('technology purchases create persistent branch-specific bonuses', () => {
  const state = createGameState();
  state.research.points = 5;

  const purchase = buyTech(state, 'kineticTheory');

  assert.equal(purchase.bought, true);
  assert.equal(state.research.points, 4);
  assert.equal(state.techs.kineticTheory, 1);
  assert.equal(deriveStats(state).attack, 1.25);
  assert.equal(Object.keys(TECH_DEFINITIONS).length, 6);

  state.highestNode = 31;
  const next = reforge(state);
  assert.equal(next.techs.kineticTheory, 1);
  assert.equal(next.research.points, 4);
});

test('law technology can add a module slot without spending core shards', () => {
  const state = createGameState();
  state.research.points = 20;
  state.unlocked.modules = Object.keys(MODULE_DEFINITIONS);

  assert.equal(buyTech(state, 'spatialWeave').bought, true);
  assert.equal(toggleModule(state, 'resonanceCore').equipped, true);
  assert.equal(toggleModule(state, 'fractureLens').equipped, true);
  assert.equal(toggleModule(state, 'timeCapacitor').equipped, true);
});

test('silence trial disables skills until the next guardian falls', () => {
  const state = createGameState();
  state.research.totalPoints = 2;
  state.unlocked.skills = ['singularityCannon'];
  state.skillCooldowns.singularityCannon = 0;

  assert.equal(startChallenge(state, 'silence').started, true);
  assert.equal(activateSkill(state, 'singularityCannon').activated, false);

  state.enemy = {
    id: 'gravity-guardian', name: '重力守卫', health: 1, maxHealth: 1,
    isBoss: true, level: 1, aliveSeconds: 0, vulnerability: 0, pulseTimer: 12,
  };
  manualAttack(state, [0.99]);

  assert.equal(state.challenges.active, null);
  assert.equal(state.challenges.ranks.silence, 1);
  assert.deepEqual(state.challenges.completed, []);
  assert.equal(Object.keys(CHALLENGE_DEFINITIONS).length, 2);
});

test('higher trial ranks require multiple consecutive guardian defeats', () => {
  let state = createGameState();
  state.research.totalPoints = 10;
  state.challenges.ranks.silence = 1;

  assert.equal(startChallenge(state, 'silence').started, true);
  state.enemy = {
    id: 'gravity-guardian', name: '重力守卫', health: 1, maxHealth: 1,
    isBoss: true, level: 11, aliveSeconds: 0, vulnerability: 0, pulseTimer: 12,
  };
  manualAttack(state, [0.99]);

  assert.equal(state.challenges.active, 'silence');
  assert.equal(state.challenges.progress, 1);

  state = reforge(state);
  assert.equal(state.challenges.active, 'silence');
  assert.equal(state.challenges.progress, 1);
  assert.equal(activateSkill(state, 'singularityCannon').activated, false);

  state.enemy = {
    id: 'mirror-guardian', name: '镜像守卫', health: 1, maxHealth: 1,
    isBoss: true, level: 12, aliveSeconds: 0, vulnerability: 0, pulseTimer: 8, phase: 'attack',
  };
  manualAttack(state, [0.99]);

  assert.equal(state.challenges.active, null);
  assert.equal(state.challenges.ranks.silence, 2);
  assert.equal(state.challenges.progress, 0);
});

test('both trials can advance through rank five without a reforge softlock', () => {
  for (const challengeId of Object.keys(CHALLENGE_DEFINITIONS)) {
    let state = createGameState();
    state.research.totalPoints = 100;

    for (let rank = 1; rank <= 5; rank += 1) {
      assert.equal(startChallenge(state, challengeId).started, true);
      for (let progress = 1; progress <= rank; progress += 1) {
        state.enemy = {
          id: 'gravity-guardian', name: '重力守卫', health: 1, maxHealth: 1,
          isBoss: true, level: state.research.totalPoints + 1, aliveSeconds: 0,
          vulnerability: 0, pulseTimer: 12, lastDamageSource: null, entropyResistance: 0,
        };
        manualAttack(state, [0.99]);
        assert.equal(Number.isFinite(state.enemy.maxHealth), true);
        assert.equal(state.run.awaitingReforge, true);
        if (progress < rank) {
          state = reforge(state);
          assert.equal(state.challenges.active, challengeId);
          assert.equal(state.challenges.progress, progress);
        }
      }
      assert.equal(state.challenges.ranks[challengeId], rank);
      assert.equal(state.challenges.active, null);
      if (rank < 5) state = reforge(state);
    }
  }
});

test('cancelling a persistent trial clears its consecutive run progress', () => {
  const state = createGameState();
  state.research.totalPoints = 10;
  state.challenges.active = 'silence';
  state.challenges.progress = 1;

  cancelChallenge(state);

  assert.equal(state.challenges.active, null);
  assert.equal(state.challenges.progress, 0);
});

test('trial ranks unlock at spaced permanent guardian milestones', () => {
  const state = createGameState();
  state.research.totalPoints = 5;
  state.challenges.ranks.silence = 1;

  const locked = startChallenge(state, 'silence');

  assert.equal(locked.started, false);
  assert.equal(locked.reason, 'locked');
  assert.equal(locked.requiredResearch, 6);
  assert.deepEqual(CHALLENGE_RANK_UNLOCKS.silence, [2, 6, 14, 26, 42]);

  state.research.totalPoints = 6;
  assert.equal(startChallenge(state, 'silence').started, true);
});

test('absolute time trial fixes attack speed and unlocks speed conversion', () => {
  const state = createGameState();
  state.research.totalPoints = 4;
  state.upgrades.speed = 10;

  assert.equal(startChallenge(state, 'absoluteTime').started, true);
  assert.equal(deriveStats(state).attackSpeed, 1);

  state.challenges.active = null;
  state.challenges.ranks.absoluteTime = 1;
  assert.ok(deriveStats(state).attack > 1);
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
  state.coreUpgrades.damageMatrix = 2;

  assert.equal(getReforgeGain(state), 12);
  const next = reforge(state);

  assert.equal(next.coreShards, 12);
  assert.equal(next.entropy, 0);
  assert.equal(next.upgrades.attack, 0);
  assert.deepEqual(next.unlocked.skills, Object.keys(SKILL_DEFINITIONS));
  assert.equal(next.unlocked.autoBuy, true);
  assert.equal(next.lifetime.reforges, 1);
  assert.equal(next.coreUpgrades.damageMatrix, 2);
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

test('save data preserves all five legitimately unlocked module slots', () => {
  const state = createGameState();
  state.coreUpgrades.moduleBay = 2;
  state.techs.spatialWeave = 1;
  state.unlocked.modules = Object.keys(MODULE_DEFINITIONS);
  state.equippedModules = Object.keys(MODULE_DEFINITIONS).slice(0, 5);

  const restored = deserializeGame(serializeGame(state));

  assert.equal(restored.equippedModules.length, 5);
  assert.equal(restored.coreUpgrades.moduleBay, 2);
  assert.equal(restored.techs.spatialWeave, 1);
});

test('old single-tier trial saves migrate to first-rank progress', () => {
  const legacy = createGameState();
  legacy.challenges = { active: null, completed: ['silence'] };

  const restored = deserializeGame(JSON.stringify(legacy));

  assert.equal(restored.challenges.ranks.silence, 1);
  assert.equal(restored.challenges.ranks.absoluteTime, 0);
  assert.equal(restored.challenges.progress, 0);
  assert.deepEqual(restored.challenges.completed, []);
});

test('extreme combat values remain finite after a guardian attack batch', () => {
  const state = createGameState();
  state.research.totalPoints = 2;
  state.upgrades.attack = 5_000;
  state.upgrades.multiStrike = 3_300;
  state.region = 2;
  state.node = 10;
  state.highestNode = 30;
  state.enemy.health = 1;

  manualAttack(state, [0.99]);

  assert.equal(Number.isFinite(deriveStats(state).attack), true);
  assert.equal(Number.isFinite(state.enemy.maxHealth), true);
  assert.equal(Number.isFinite(state.enemy.health), true);
  assert.equal(Number.isFinite(state.entropy), true);
});

test('invalid legacy guardian values recover without losing permanent progress', () => {
  const legacy = createGameState();
  delete legacy.depth;
  delete legacy.bestDepth;
  legacy.region = 2;
  legacy.node = 11;
  legacy.highestNode = 31;
  legacy.completed = true;
  legacy.run.awaitingReforge = true;
  legacy.research.totalPoints = 42;
  legacy.research.points = 7;
  legacy.techs.kineticTheory = 3;
  legacy.coreUpgrades.damageMatrix = 2;
  legacy.enemy = {
    id: 'gravity-guardian', name: '重力守卫', maxHealth: null, health: null,
    isBoss: true, level: 801, aliveSeconds: 0, vulnerability: 0, pulseTimer: 12,
  };

  const restored = deserializeGame(JSON.stringify(legacy));

  assert.equal(restored.research.totalPoints, 42);
  assert.equal(restored.research.points, 7);
  assert.equal(restored.techs.kineticTheory, 3);
  assert.equal(restored.coreUpgrades.damageMatrix, 2);
  assert.equal(restored.depth, 30);
  assert.equal(restored.bestDepth, 30);
  assert.equal(restored.run.awaitingReforge, true);
  assert.equal(restored.enemy.level, 43);
  assert.equal(Number.isFinite(restored.enemy.health), true);
  assert.equal(restored.enemy.health, restored.enemy.maxHealth);
});

test('serialization repairs non-finite combat values instead of writing null', () => {
  const state = createGameState();
  state.enemy.health = Number.POSITIVE_INFINITY;
  state.enemy.maxHealth = Number.POSITIVE_INFINITY;
  state.run.damage = Number.POSITIVE_INFINITY;

  const raw = serializeGame(state);
  const saved = JSON.parse(raw);

  assert.equal(Number.isFinite(saved.enemy.health), true);
  assert.equal(Number.isFinite(saved.enemy.maxHealth), true);
  assert.equal(Number.isFinite(saved.run.damage), true);
});

test('serialization rebuilds an overflowed guardian at the permanent frontier', () => {
  const state = createGameState();
  state.research.totalPoints = 42;
  state.enemy = {
    id: 'gravity-guardian', name: '重力守卫', maxHealth: Number.POSITIVE_INFINITY,
    health: Number.POSITIVE_INFINITY, isBoss: true, level: 801, aliveSeconds: 0,
    vulnerability: 0, pulseTimer: 12,
  };

  const saved = JSON.parse(serializeGame(state));

  assert.equal(saved.enemy.level, 43);
  assert.ok(saved.enemy.health > 0);
  assert.equal(saved.enemy.health, saved.enemy.maxHealth);
  assert.equal(Number.isFinite(saved.enemy.health), true);
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

test('offline progress keeps extreme resources finite', () => {
  const state = createGameState();
  state.entropy = 1e300;
  state.run.entropyEarned = 1e300;
  state.lifetime.entropyEarned = 1e300;
  state.upgrades.attack = 5_000;
  state.upgrades.entropy = 5_000;
  state.lastSavedAt = 0;

  applyOfflineProgress(state, 72 * 60 * 60 * 1000);

  assert.equal(Number.isFinite(state.entropy), true);
  assert.equal(Number.isFinite(state.run.entropyEarned), true);
  assert.equal(Number.isFinite(state.lifetime.entropyEarned), true);
});

test('large time steps match equivalent quarter-second steps', () => {
  const largeStep = createGameState();
  largeStep.unlocked.autoAttack = true;
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

test('extreme attack throughput does not overflow the event reporting stack', () => {
  const state = createGameState();
  state.unlocked.autoAttack = true;
  state.upgrades.speed = 70;
  state.upgrades.multiStrike = 8;
  state.unlocked.modules = ['resonanceCore'];
  state.equippedModules = ['resonanceCore'];
  state.enemy.health = 1e300;
  state.enemy.maxHealth = 1e300;

  assert.doesNotThrow(() => advanceGame(state, 0.25, [0.99]));
  assert.equal(state.run.attacks, 90);
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
  baseline.unlocked.autoAttack = true;
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
