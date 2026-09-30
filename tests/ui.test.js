import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('game page exposes the complete playable workspace', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  for (const marker of [
    '<main',
    'id="enemy-name"',
    'id="enemy-health"',
    'id="upgrade-list"',
    'id="skill-list"',
    'id="module-list"',
    'id="reforge-button"',
    'aria-live="polite"',
    'src/app.js',
  ]) {
    assert.ok(html.includes(marker), `missing required interface marker: ${marker}`);
  }
});

test('page metadata and embedded favicon identify Singularity Foundry', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.ok(html.includes('<title>奇点熔炉 · Singularity Foundry</title>'));
  assert.ok(html.includes('rel="icon"'));
  assert.ok(html.includes('data:image/svg+xml'));
});

test('page exposes the noncommercial use restriction to every player', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /class="copyright-notice"[^>]*role="note"/);
  assert.ok(html.includes('禁止转售'));
  assert.ok(html.includes('禁止任何形式的私人盈利'));
  assert.ok(html.includes('依法追究法律责任'));
});

test('hidden tab panels are removed from layout', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});

test('desktop uses a viewport-locked shell while mobile keeps document scrolling', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(css, /body\s*\{[^}]*height:\s*100(?:d)?vh[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.game-shell\s*\{[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(css, /@media\s*\(max-width:\s*720px\)[\s\S]*?body\s*\{[^}]*height:\s*auto[^}]*overflow-y:\s*auto/s);
});

test('mobile page exposes a fixed quick navigator for battle, build, and stats', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(html, /class="mobile-view-switcher"[^>]*aria-label="移动端快捷导航"/);
  for (const target of ['#battlefield', '#build-panel', '#stats-panel']) {
    assert.ok(html.includes(`data-mobile-target="${target}"`));
  }
  assert.match(css, /@media\s*\(max-width:\s*720px\)[\s\S]*?\.mobile-view-switcher\s*\{[^}]*position:\s*fixed/s);
});

test('post-MVP interface exposes permanent core progression controls', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(html, /data-tab="core"/);
  assert.match(html, /id="core-list"/);
  assert.match(html, /id="auto-skills-toggle"/);
  assert.match(html, /id="research-value"/);
  assert.match(app, /data-tech=/);
  assert.match(app, /data-challenge=/);
});

test('guardian decisions and persistent trials expose their next action clearly', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(html, /id="guardian-decision"/);
  assert.match(html, /id="law-choices"/);
  assert.match(html, /id="continue-dive"[^>]*disabled/);
  assert.match(app, /state\.run\.awaitingDecision/);
  assert.match(app, /选择下一法则/);
  assert.doesNotMatch(app, /RUN COMPLETE/);
  assert.match(app, /连续完成/);
});

test('mobile guardian settlement stays inside the viewport with sticky actions', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(css, /\.decision-card\s*\{[^}]*max-height:[^;}]*100svh[^}]*overflow:\s*auto/s);
  assert.match(css, /\.decision-actions\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /@media\s*\(max-width:\s*720px\)[\s\S]*?\.guardian-decision\s*\{[^}]*position:\s*fixed/s);
});

test('battlefield exposes the active overdrive meter without adding a new panel', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(html, /id="overdrive-meter"/);
  assert.match(html, /id="overdrive-fill"/);
  assert.match(html, /id="overdrive-label"/);
  assert.match(css, /\.overdrive-meter/);
});

test('touch controls prevent double-tap side effects and respect mobile safe areas', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(html, /name="viewport" content="[^"]*viewport-fit=cover/);
  assert.doesNotMatch(html, /user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
  assert.match(css, /button[^\{]*\{[^}]*touch-action:\s*manipulation[^}]*user-select:\s*none/s);
  assert.match(css, /-webkit-touch-callout:\s*none/);
  assert.match(css, /overscroll-behavior-y:\s*none/);
  assert.match(css, /@media\s*\(max-width:\s*720px\)[\s\S]*?button[^\{]*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /padding-bottom:\s*calc\([^)]*env\(safe-area-inset-bottom\)/);
});

test('controller preserves focused list controls and safely resumes background progress', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.ok(source.includes('listHasFocus'));
  assert.ok(source.includes("document.addEventListener('visibilitychange'"));
  assert.ok(source.includes('document.hidden'));
});

test('reforge dialog clears a prior confirmation before every opening', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /returnValue\s*=\s*['"]['"]/);
});
