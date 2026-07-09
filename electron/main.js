const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { waitForServer } = require('./waitForServer.js');
const { loadWindowState, saveWindowState, clampToDisplays } = require('./windowState.js');

const DEV_URL = process.env.ELECTRON_START_URL;
const SERVER_URL = 'http://localhost:3001';

let win;
let serverProcess;
let windowStateFile;

function debounce(fn, delayMs) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

function startBackend() {
  serverProcess = spawn(process.execPath, ['src/index.js'], {
    cwd: path.join(__dirname, '..', 'server'),
    stdio: 'inherit',
    // process.execPath here is the Electron binary itself. Without this,
    // it would try to boot a second full Electron/GUI instance instead of
    // just running the server script as plain Node.
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
}

function createWindow() {
  const saved = clampToDisplays(loadWindowState(windowStateFile), screen.getAllDisplays());

  win = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    x: saved.x,
    y: saved.y,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    show: false,
    backgroundColor: '#12261d',
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (saved.isMaximized) win.maximize();

  win.once('ready-to-show', () => win.show());

  win.on('maximize', () => win.webContents.send('win:maximized-changed', true));
  win.on('unmaximize', () => win.webContents.send('win:maximized-changed', false));

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('did-fail-load', code, desc, url);
  });

  const persistStateNow = () => {
    if (!win || win.isDestroyed()) return;
    const isMaximized = win.isMaximized();
    const bounds = isMaximized ? win.getNormalBounds() : win.getBounds();
    saveWindowState(windowStateFile, { ...bounds, isMaximized });
  };
  const persistStateDebounced = debounce(persistStateNow, 400);

  win.on('resize', persistStateDebounced);
  win.on('move', persistStateDebounced);
  // Not debounced: the process can exit shortly after 'close', so the final
  // size/position needs to be written immediately, not after a delay.
  win.on('close', persistStateNow);

  if (DEV_URL) {
    win.loadURL(DEV_URL);
  } else {
    win.loadURL(SERVER_URL);
  }
}

ipcMain.handle('win:minimize', () => win?.minimize());
ipcMain.handle('win:toggle-maximize', () => {
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.handle('win:close', () => win?.close());
ipcMain.handle('win:is-maximized', () => Boolean(win?.isMaximized()));

app.whenReady().then(async () => {
  windowStateFile = path.join(app.getPath('userData'), 'window-state.json');

  if (!DEV_URL) {
    startBackend();
    await waitForServer(`${SERVER_URL}/api/health`);
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((err) => {
  console.error('startup failed', err);
  // console.error alone is invisible in a packaged app with no terminal
  // attached - show a real dialog so the user knows why nothing opened.
  dialog.showErrorBox('SKBotmessager não conseguiu iniciar', String(err.message || err));
  app.quit();
});

app.on('window-all-closed', () => {
  console.log('window-all-closed event fired');
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', (_e, exitCode) => {
  console.log('app quit event, exitCode', exitCode);
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});
