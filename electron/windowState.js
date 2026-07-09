const fs = require('node:fs');

const DEFAULT_STATE = { width: 1280, height: 800, x: undefined, y: undefined, isMaximized: false };

function loadWindowState(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    // No saved state yet, or the file is missing/corrupt - fall back to defaults.
    return { ...DEFAULT_STATE };
  }
}

function saveWindowState(filePath, state) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(state));
  } catch {
    // Best-effort only - failing to persist window position shouldn't crash the app.
  }
}

// Only trust a saved position if it still lands inside a currently connected
// display's work area. Without this, unplugging a monitor (or opening on a
// different machine's profile) could leave the window permanently off-screen
// with no way to reach it.
function clampToDisplays(state, displays) {
  const { width, height, isMaximized } = state;
  if (state.x == null || state.y == null || !Array.isArray(displays) || displays.length === 0) {
    return { width, height, isMaximized };
  }

  const fits = displays.some(({ workArea }) => {
    const { x, y, width: w, height: h } = workArea;
    return state.x >= x && state.y >= y && state.x < x + w && state.y < y + h;
  });

  if (!fits) return { width, height, isMaximized };
  return { width, height, x: state.x, y: state.y, isMaximized };
}

module.exports = { DEFAULT_STATE, loadWindowState, saveWindowState, clampToDisplays };
