'use strict';

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const Store = require('electron-store');

const store = new Store({ defaults: { enabled: true } });

let tray = null;
let setupWindow = null;
let botWorker = null;
let overlayWindows = [];
let isEnabled = store.get('enabled', true);
let botConnected = false;
let updateLabel = null;

// ─── Instance unique ──────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }
app.on('second-instance', () => {
  if (setupWindow) { setupWindow.show(); setupWindow.focus(); }
});

app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });

// ─── Icône ────────────────────────────────────────────────────────────────────
function getIconPath() {
  const fs = require('fs');
  const candidates = [
    path.join(process.resourcesPath || '', 'assets', 'icon.png'),
    path.join(__dirname, '..', 'assets', 'icon.png'),
    path.join(__dirname, 'assets', 'icon.png'),
  ];
  for (const p of candidates) { if (fs.existsSync(p)) return p; }
  return null;
}

// ─── Auto-updater ─────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    updateLabel = `⬇️ Téléchargement v${info.version}...`;
    refreshTrayMenu();
    showNotifOverlay(`⬇️ Mise à jour v${info.version} disponible, téléchargement...`);
  });

  autoUpdater.on('update-not-available', () => {
    updateLabel = null;
    refreshTrayMenu();
  });

  autoUpdater.on('download-progress', (p) => {
    updateLabel = `⬇️ MAJ ${Math.round(p.percent)}%`;
    refreshTrayMenu();
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateLabel = `✅ MAJ v${info.version} prête`;
    refreshTrayMenu();
    showNotifOverlay(`✅ MemeBlaster v${info.version} téléchargé !\nS'installera au prochain redémarrage.`);
  });

  autoUpdater.on('error', () => {
    updateLabel = null;
    refreshTrayMenu();
  });

  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }, 4000);
}

function showNotifOverlay(text) {
  const { bounds } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: bounds.width, height: bounds.height,
    x: bounds.x, y: bounds.y,
    frame: false, transparent: true,
    alwaysOnTop: true, skipTaskbar: true,
    resizable: false, focusable: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'overlay.html'));
  win.once('ready-to-show', () => {
    win.show();
    win.webContents.send('show-meme', {
      author: '🔄 MemeBlaster Update', avatar: null,
      text, mediaUrl: null, mediaType: 'text', timestamp: Date.now()
    });
  });
}

// ─── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = getIconPath();
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('MemeBlaster');
  tray.on('double-click', () => openSetupWindow());
  refreshTrayMenu();
}

function refreshTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  const config = store.get('config');
  const configured = !!(config?.botToken && config?.channelId);
  let statusLabel = '⚠️  Non configuré';
  if (configured) statusLabel = botConnected ? '🟢 Connecté' : '🔴 Déconnecté';

  const items = [
    { label: '🎉 MemeBlaster', enabled: false },
    { type: 'separator' },
    { label: isEnabled ? '✅ Notifications actives' : '⏸️  Notifications pausées', click() { toggleEnabled(); } },
    { type: 'separator' },
    { label: '⚙️  Paramètres', click() { openSetupWindow(); } },
    { type: 'separator' },
    { label: statusLabel, enabled: false },
  ];

  if (updateLabel) {
    items.push({ label: updateLabel, enabled: false });
  }

  items.push(
    { type: 'separator' },
    { label: `Version ${app.getVersion()}`, enabled: false },
    { type: 'separator' },
    { label: '❌ Quitter MemeBlaster', click() { app.exit(0); } }
  );

  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function toggleEnabled() {
  isEnabled = !isEnabled;
  store.set('enabled', isEnabled);
  refreshTrayMenu();
  if (botWorker && !botWorker.isDestroyed()) {
    botWorker.webContents.send('set-enabled', isEnabled);
  }
}

// ─── Fenêtre de config ────────────────────────────────────────────────────────
function openSetupWindow() {
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.show(); setupWindow.focus(); return;
  }
  setupWindow = new BrowserWindow({
    width: 600, height: 720,
    resizable: false,
    title: 'MemeBlaster – Configuration',
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#0f0f1a',
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  setupWindow.loadFile(path.join(__dirname, 'setup.html'));
  setupWindow.once('ready-to-show', () => { setupWindow.show(); setupWindow.focus(); });
  setupWindow.on('closed', () => { setupWindow = null; });
}

// ─── Overlay ─────────────────────────────────────────────────────────────────
function showMemeOverlay(data) {
  if (!isEnabled) return;
  const { bounds } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: bounds.width, height: bounds.height,
    x: bounds.x, y: bounds.y,
    frame: false, transparent: true,
    alwaysOnTop: true, skipTaskbar: true,
    resizable: false, movable: false, focusable: true,
    webPreferences: {
      nodeIntegration: true, contextIsolation: false,
      webSecurity: false, autoplayPolicy: 'no-user-gesture-required'
    }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'overlay.html'));
  win.once('ready-to-show', () => {
    win.show();
    win.webContents.send('show-meme', data);
    overlayWindows.push(win);
  });
  win.on('closed', () => { overlayWindows = overlayWindows.filter(w => w !== win); });
}

// ─── Bot worker ───────────────────────────────────────────────────────────────
function startBotWorker() {
  if (botWorker && !botWorker.isDestroyed()) { botWorker.close(); botWorker = null; }
  botWorker = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true, contextIsolation: false,
      webSecurity: false, backgroundThrottling: false
    }
  });
  botWorker.loadFile(path.join(__dirname, 'bot-worker.html'));
  botWorker.webContents.once('did-finish-load', () => {
    const config = store.get('config');
    if (config?.botToken && config?.channelId) {
      botWorker.webContents.send('start-bot', { ...config, enabled: isEnabled });
    }
  });
  botWorker.on('closed', () => { botWorker = null; botConnected = false; refreshTrayMenu(); });
}

// ─── IPC ──────────────────────────────────────────────────────────────────────
ipcMain.on('meme-received', (_e, data) => showMemeOverlay(data));
ipcMain.on('close-overlay', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win && !win.isDestroyed()) win.close();
});
ipcMain.on('bot-status', (_e, { connected, tag, error }) => {
  botConnected = connected;
  if (setupWindow && !setupWindow.isDestroyed()) setupWindow.webContents.send('bot-status', { connected, tag, error });
  refreshTrayMenu();
});
ipcMain.on('bot-log', (_e, msg) => {
  if (setupWindow && !setupWindow.isDestroyed()) setupWindow.webContents.send('bot-log', msg);
});
ipcMain.on('register-result', (_e, data) => {
  if (setupWindow && !setupWindow.isDestroyed()) setupWindow.webContents.send('register-result', data);
});
ipcMain.on('force-register-commands', () => {
  if (botWorker && !botWorker.isDestroyed()) botWorker.webContents.send('force-register-commands');
});
ipcMain.on('get-config', (e) => { e.reply('config-data', store.get('config') || {}); });
ipcMain.on('save-config', (e, config) => {
  store.set('config', config);
  e.reply('config-saved', true);
  startBotWorker();
});
ipcMain.on('send-test', () => {
  showMemeOverlay({
    author: 'MemeBlaster Test', avatar: null,
    text: '🎉 Ça marche ! Tes amis vont prendre cher.',
    mediaUrl: 'https://media.tenor.com/GfSX-u7VGM4AAAAC/rickroll.gif',
    mediaType: 'gif', timestamp: Date.now()
  });
});
ipcMain.on('open-url', (_e, url) => { shell.openExternal(url); });

// ─── Start ────────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createTray();
  const config = store.get('config');
  if (!config?.botToken || !config?.channelId) {
    openSetupWindow();
  } else {
    startBotWorker();
  }
  if (app.isPackaged) setupAutoUpdater();
});

app.on('window-all-closed', (e) => e.preventDefault());
app.on('before-quit', () => {
  if (botWorker && !botWorker.isDestroyed()) botWorker.destroy();
});
