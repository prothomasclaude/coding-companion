const { app, BrowserWindow, screen, Tray, Menu, ipcMain, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");

const STATUS_FILE = path.join(__dirname, "status.json");
const CONFIG_FILE = path.join(__dirname, "config.json");
const SPRITES_DIR = path.join(__dirname, "sprites");
const WIN_WIDTH = 420;
const WIN_HEIGHT = 280;

let mainWindow;
let configWindow;
let tray;

// ===== Config =====
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return { selectedSprite: "jotaro" };
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ===== Sprite Pack Discovery =====
function scanSpritePacks() {
  const packs = [];
  try {
    const dirs = fs.readdirSync(SPRITES_DIR);
    for (const dir of dirs) {
      const manifestPath = path.join(SPRITES_DIR, dir, "manifest.json");
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        packs.push({
          id: dir,
          name: manifest.name,
          author: manifest.author,
          preview: "file://" + path.join(SPRITES_DIR, dir, manifest.preview),
        });
      }
    }
  } catch {
    // sprites dir might not exist yet
  }
  return packs;
}

// ===== Main Sprite Window =====
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    x: width - WIN_WIDTH - 40,
    y: height - WIN_HEIGHT - 20,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    focusable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  mainWindow.loadFile("index.html");

  // Init sprite after page loads
  const config = loadConfig();
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.executeJavaScript(
      `window.initCompanion && window.initCompanion("${config.selectedSprite}")`,
    );
  });

  ensureStatusFile();
  watchStatus();
}

// ===== Config Window =====
function createConfigWindow() {
  if (configWindow && !configWindow.isDestroyed()) {
    configWindow.show();
    configWindow.focus();
    return;
  }

  configWindow = new BrowserWindow({
    width: 480,
    height: 400,
    frame: true,
    resizable: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    title: "Coding Companion - Select Character",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  configWindow.setMenuBarVisibility(false);
  configWindow.loadFile("config.html");

  configWindow.on("closed", () => {
    configWindow = null;
  });
}

// ===== Tray Icon =====
function createTray() {
  // Try to use the first frame of selected sprite as tray icon
  const config = loadConfig();
  const previewPath = path.join(SPRITES_DIR, config.selectedSprite, "manifest.json");
  let trayIcon;

  try {
    const manifest = JSON.parse(fs.readFileSync(previewPath, "utf8"));
    const imgPath = path.join(SPRITES_DIR, config.selectedSprite, manifest.preview);
    trayIcon = nativeImage.createFromPath(imgPath).resize({ width: 22, height: 22 });
  } catch {
    // Fallback: create a simple icon
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip("Coding Companion");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Select Character...",
      click: () => createConfigWindow(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// ===== IPC Handlers =====
ipcMain.handle("get-sprite-packs", () => {
  return scanSpritePacks();
});

ipcMain.handle("get-config", () => {
  return loadConfig();
});

ipcMain.handle("select-sprite", (event, spriteId) => {
  const config = { selectedSprite: spriteId };
  saveConfig(config);

  // Hot-reload the sprite in the main window
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(
      `window.reloadSprite && window.reloadSprite("${spriteId}")`,
    );
  }

  return { success: true };
});

// ===== Status File =====
function ensureStatusFile() {
  if (!fs.existsSync(STATUS_FILE)) {
    fs.writeFileSync(
      STATUS_FILE,
      JSON.stringify({ state: "idle", timestamp: Date.now() }),
    );
  }
}

function watchStatus() {
  let lastState = "idle";

  const checkStatus = () => {
    try {
      const data = JSON.parse(fs.readFileSync(STATUS_FILE, "utf8"));
      if (data.state !== lastState) {
        lastState = data.state;
        mainWindow?.webContents?.executeJavaScript(
          `window.updateState && window.updateState("${data.state}")`,
        );
      }
    } catch {
      // File might be mid-write, ignore
    }
  };

  setInterval(checkStatus, 300);
  checkStatus();
}

// ===== App Lifecycle =====
app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on("window-all-closed", () => app.quit());

process.on("SIGTERM", () => app.quit());
process.on("SIGINT", () => app.quit());
