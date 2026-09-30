# Singularity Foundry Phase Two Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and implement each task with RED-GREEN tests.

**Goal:** Extend the validated MVP into a replayable 10-hour second stage that forms the foundation of the 200-hour roadmap.

**Architecture:** Keep the deterministic engine in `src/game.js` data-driven and backward-compatible. UI rendering remains in `src/app.js`; all long-term state is merged through version-1 save defaults so existing players retain progress.

**Tech Stack:** Browser ES modules, HTML/CSS, Node.js test runner.

**Spec:** `.md` and `docs/ROADMAP-200H.md`

## Global Constraints

- Never extend playtime with mandatory idle walls.
- Every permanent layer changes choices or automation.
- Existing version-1 saves remain readable.
- Desktop and mobile controls expose every new system.

## Review Focus

- Extreme attack throughput must not exhaust the browser stack or event memory.
- A spent permanent currency must not reduce the player's effective power.
- Boss transitions must preserve deterministic combat order.
- Challenge restrictions must apply to manual and automatic actions equally.
- Reset layers must preserve exactly the progress their descriptions promise.

### Task 1: Permanent Core Matrix

- [x] Add six core upgrades, purchasing, persistence, automation and UI.
- [x] Add pressure regression coverage for high-throughput combat.

### Task 2: Law Guardian Rotation

- [x] Add Gravity, Mirror, Time and Entropy guardian definitions and mechanics.
- [x] Show the active guardian rule in the battle UI.
- [x] Cover rotation and each rule with deterministic tests.

### Task 3: Three-Branch Technology Tree

- [x] Award research points from guardian clears and track unique discoveries.
- [x] Add mutually meaningful combat, economy and rules technologies.
- [x] Add purchasing and responsive UI with save compatibility.

### Task 4: Introductory Law Trials

- [x] Add Silence and Absolute Time rule changes.
- [x] Add start, completion, reward and exit flow.
- [x] Verify persistence and restrictions through deterministic tests.

### Task 5: Phase Balance and Regression

- [ ] Simulate milestone pacing through ten hours.
- [ ] Run syntax, full test, layout contract and save migration checks.
