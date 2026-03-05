const { app, BrowserWindow, screen, Tray, Menu, ipcMain, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");

const STATUS_FILE = path.join(__dirname, "status.json");
const CONFIG_FILE = path.join(__dirname, "config.json");
const SPRITES_DIR = path.join(__dirname, "sprites");
const IS_MAC = process.platform === "darwin";

let mainWindow;
let configWindow;
let tray;
let savePositionTimer;

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

// ===== Get sprite display size from manifest =====
function getSpriteSize(spriteName) {
  try {
    const manifestPath = path.join(SPRITES_DIR, spriteName, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return manifest.display || { width: 384, height: 224 };
  } catch {
    return { width: 384, height: 224 };
  }
}

// ===== Main Sprite Window =====
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const config = loadConfig();
  const spriteSize = getSpriteSize(config.selectedSprite);

  // Window = sprite size + padding for speech bubble above
  const winWidth = spriteSize.width + 40;
  const winHeight = spriteSize.height + 80;

  // Restore saved position or default to bottom-right
  const startX = config.posX !== undefined ? config.posX : width - winWidth - 40;
  const startY = config.posY !== undefined ? config.posY : height - winHeight - 20;

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: startX,
    y: startY,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile("index.html");

  // Init sprite after page loads
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.executeJavaScript(
      `window.initCompanion && window.initCompanion("${config.selectedSprite}")`,
    );
  });

  // Save position when window moves (debounced)
  mainWindow.on("moved", () => {
    if (savePositionTimer) clearTimeout(savePositionTimer);
    savePositionTimer = setTimeout(() => {
      const [x, y] = mainWindow.getPosition();
      const cfg = loadConfig();
      cfg.posX = x;
      cfg.posY = y;
      saveConfig(cfg);
    }, 500);
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
function createTrayIcon() {
  const size = 22;
  const buf = Buffer.alloc(size * size * 4, 0);

  const px = (x, y, r, g, b, a = 255) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = a;
  };

  for (let x = 7; x <= 14; x++) for (let y = 3; y <= 5; y++) px(x, y, 123, 104, 238);
  for (let x = 6; x <= 15; x++) for (let y = 6; y <= 10; y++) px(x, y, 123, 104, 238);
  for (let x = 7; x <= 14; x++) px(x, 11, 123, 104, 238);
  px(9, 8, 255, 255, 255); px(12, 8, 255, 255, 255);
  for (let x = 8; x <= 13; x++) for (let y = 12; y <= 17; y++) px(x, y, 90, 75, 200);
  for (let y = 13; y <= 15; y++) { px(7, y, 90, 75, 200); px(14, y, 90, 75, 200); }
  for (let y = 18; y <= 20; y++) { px(9, y, 70, 55, 180); px(12, y, 70, 55, 180); }

  const img = nativeImage.createFromBuffer(buf, { width: size, height: size });
  if (IS_MAC) img.setTemplateImage(true);
  return img;
}

function createTray() {
  const trayIcon = createTrayIcon();
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
ipcMain.handle("get-sprite-packs", () => scanSpritePacks());
ipcMain.handle("get-config", () => loadConfig());

ipcMain.handle("select-sprite", (_event, spriteId) => {
  const config = loadConfig();
  config.selectedSprite = spriteId;
  saveConfig(config);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(
      `window.reloadSprite && window.reloadSprite("${spriteId}")`,
    );
  }
  return { success: true };
});

// Manual window drag via IPC
ipcMain.on("drag-move", (_event, dx, dy) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const [x, y] = mainWindow.getPosition();
  mainWindow.setPosition(x + dx, y + dy);
});

// ===== Status File =====
function ensureStatusFile() {
  if (!fs.existsSync(STATUS_FILE)) {
    fs.writeFileSync(STATUS_FILE, JSON.stringify({ state: "idle", timestamp: Date.now() }));
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
    } catch {}
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
