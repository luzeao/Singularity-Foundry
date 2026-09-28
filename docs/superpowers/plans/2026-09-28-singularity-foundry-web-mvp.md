# Singularity Foundry Web MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dependency-free, browser-playable MVP of Singularity Foundry covering the first three regions, one Boss, build crafting, automation, save/offline progress, and first reforge.

**Architecture:** A deterministic ES-module game engine owns all simulation state and rules. A thin browser controller advances time, persists state, and renders a responsive single-screen interface. Node's built-in test runner imports the same engine used by the browser.

**Tech Stack:** HTML5, CSS, JavaScript ES modules, Node.js built-in test runner

**Spec:** `docs/superpowers/specs/2026-09-28-singularity-foundry-web-mvp-design.md`

## Global Constraints

- Do not create or modify environment, secret, CI/CD, package, or hosting configuration files.
- Do not commit, push, delete files, or publish the game.
- Keep the MVP dependency-free and runnable through any static HTTP server.
- Add concise comments only for non-obvious business rules, state transitions, and compatibility branches.
- Keep future systems such as tech, law rewrite, challenges, and leaderboards out of scope.

## Review Focus

- Large elapsed times must not freeze the page or skip progression.
- Corrupt save data must start a new game without crashing.
- Purchases at exact-cost boundaries must succeed without negative resources.
- Reforge must preserve only documented permanent state and unlocks.
- Responsive layout must remain usable at 375 px width and 200% text scaling.

---

### Task 1: Deterministic Economy and Combat Engine

**Files:**
- Create: `src/game.js`
- Create: `tests/game.test.js`

**Interfaces:**
- Produces: `createGameState()`, `deriveStats(state)`, `buyUpgrade(state, id, amount)`, `advanceGame(state, seconds, randomValues)`

- [ ] Write failing tests for initial derived stats, exact-cost purchase, automatic attacks, critical damage, node rewards, and bounded large elapsed times.
- [ ] Run `node --test tests/game.test.js` and confirm the missing module/API failure.
- [ ] Implement the minimum deterministic engine and concise comments for time-step capping and critical tiers.
- [ ] Run `node --test tests/game.test.js` and confirm all Task 1 tests pass.

### Task 2: Skills, Modules, Boss, Progression, and Reforge

**Files:**
- Modify: `src/game.js`
- Modify: `tests/game.test.js`

**Interfaces:**
- Consumes: Task 1 game state and simulation API.
- Produces: `toggleModule(state, id)`, `activateSkill(state, id)`, `getReforgeGain(state)`, `reforge(state)`, region/Boss progression events.

- [ ] Add failing behavior tests for three skills, six modules' defining effects, Boss mechanics, region completion, reforge preview, and documented reset/preservation.
- [ ] Run the focused tests and confirm expected behavior failures.
- [ ] Implement the smallest rule set satisfying the tests and MVP pacing.
- [ ] Run `node --test tests/game.test.js` and confirm the full engine suite passes.

### Task 3: Save, Offline Progress, and Browser Controller

**Files:**
- Modify: `src/game.js`
- Create: `src/app.js`
- Modify: `tests/game.test.js`

**Interfaces:**
- Consumes: Task 2 state and actions.
- Produces: `serializeGame(state)`, `deserializeGame(raw)`, `applyOfflineProgress(state, now)`, browser autosave and action dispatch.

- [ ] Add failing tests for save round-trip, corrupt save fallback, capped segmented offline rewards, and saved timestamp handling.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement persistence and the browser controller without external libraries.
- [ ] Run `node --test tests/game.test.js` and confirm the suite passes.

### Task 4: Responsive Game Interface

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Modify: `src/app.js`

**Interfaces:**
- Consumes: Task 3 browser controller and all engine selectors/actions.
- Produces: immediately playable game workspace, tabs, upgrade/skill/module actions, reforge dialog, logs, accessibility states.

- [ ] Create a structural smoke test that loads the HTML and verifies the required gameplay landmarks and controls.
- [ ] Run the smoke test and confirm it fails before the interface exists.
- [ ] Implement the three-column desktop and single-column mobile interface, embedded favicon, visible focus states, and motion-reduction behavior.
- [ ] Run the full Node test suite and JavaScript syntax checks.
- [ ] Serve locally, verify a non-error HTTP response, and inspect desktop/mobile rendering.

### Task 5: Final Balance and Requirements Verification

**Files:**
- Modify only files directly implicated by failed verification.

**Interfaces:**
- Consumes: the complete MVP.
- Produces: verified gameplay loop and an explicit report of remaining runtime limitations.

- [ ] Simulate enough progression to prove region, Boss, and reforge paths are reachable.
- [ ] Run `node --test tests/*.test.js` and syntax checks with fresh output.
- [ ] Review every MVP requirement against the implementation and document any deliberate exclusions.
- [ ] Perform a final code review; fix Critical/Important findings with RED→GREEN tests and defer minor polish explicitly.

