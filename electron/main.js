const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const http = require('node:http');

const DEV_URL = process.env.ELECTRON_START_URL;
const SERVER_URL = 'http://localhost:3001';

let win;
let serverProcess;

function waitForServer(url, { timeout = 20000, interval = 300 } = {}) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(check, interval);
      });
    };
    check();
  });
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
  win = new BrowserWindow({
    width: 1280,
    height: 800,
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

  win.once('ready-to-show', () => win.show());

  win.on('maximize', () => win.webContents.send('win:maximized-changed', true));
  win.on('unmaximize', () => win.webContents.send('win:maximized-changed', false));

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('did-fail-load', code, desc, url);
  });

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
