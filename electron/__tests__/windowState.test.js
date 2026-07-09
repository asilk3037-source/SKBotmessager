const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  DEFAULT_STATE,
  loadWindowState,
  saveWindowState,
  clampToDisplays,
} = require('../windowState.js');

function tempFile(name) {
  return path.join(os.tmpdir(), `skbot-window-state-${name}-${Date.now()}-${Math.random()}.json`);
}

test('loadWindowState returns the defaults when the file does not exist', () => {
  const state = loadWindowState(tempFile('missing'));
  assert.deepEqual(state, DEFAULT_STATE);
});

test('loadWindowState returns the defaults when the file is corrupt', () => {
  const file = tempFile('corrupt');
  fs.writeFileSync(file, 'not json');
  const state = loadWindowState(file);
  assert.deepEqual(state, DEFAULT_STATE);
  fs.unlinkSync(file);
});

test('saveWindowState then loadWindowState round-trips the saved bounds', () => {
  const file = tempFile('roundtrip');
  const saved = { width: 1000, height: 700, x: 50, y: 60, isMaximized: true };

  saveWindowState(file, saved);
  const loaded = loadWindowState(file);

  assert.equal(loaded.width, 1000);
  assert.equal(loaded.height, 700);
  assert.equal(loaded.x, 50);
  assert.equal(loaded.y, 60);
  assert.equal(loaded.isMaximized, true);

  fs.unlinkSync(file);
});

test('clampToDisplays keeps the saved position when it fits inside a display', () => {
  const displays = [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }];
  const result = clampToDisplays(
    { width: 1280, height: 800, x: 100, y: 100, isMaximized: false },
    displays
  );
  assert.equal(result.x, 100);
  assert.equal(result.y, 100);
  assert.equal(result.width, 1280);
});

test('clampToDisplays drops the position when no connected display contains it', () => {
  // Simulates a saved position from a monitor that is no longer plugged in.
  const displays = [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }];
  const result = clampToDisplays(
    { width: 1280, height: 800, x: 5000, y: 5000, isMaximized: false },
    displays
  );
  assert.equal(result.x, undefined);
  assert.equal(result.y, undefined);
  assert.equal(result.width, 1280);
  assert.equal(result.height, 800);
});

test('clampToDisplays passes through untouched when there is no saved position', () => {
  const result = clampToDisplays({ ...DEFAULT_STATE }, [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }]);
  assert.equal(result.x, undefined);
  assert.equal(result.y, undefined);
  assert.equal(result.width, DEFAULT_STATE.width);
});
