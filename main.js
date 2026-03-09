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

// ===== Get sprite manifest info =====
function getSpriteManifest(spriteName) {
  try {
    const manifestPath = path.join(SPRITES_DIR, spriteName, "manifest.json");
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    return { display: { width: 384, height: 224 } };
  }
}

// ===== Main Sprite Window =====
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const config = loadConfig();
  const manifest = getSpriteManifest(config.selectedSprite);
  const spriteSize = manifest.display || { width: 384, height: 224 };

  // Window = sprite size + padding for speech bubble above
  const winWidth = Math.max(spriteSize.width, 350);
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

  // Make the entire window visible — click-through is handled by the
  // transparent background; drag is handled by -webkit-app-region on #drag-handle
  mainWindow.setShape([{ x: 0, y: 0, width: winWidth, height: winHeight }]);

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
    width: 520,
    height: 440,
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

  const rect = (x1, y1, x2, y2, r, g, b, a) => {
    for (let x = x1; x <= x2; x++) for (let y = y1; y <= y2; y++) px(x, y, r, g, b, a);
  };

  // Outer glow ring
  const glowPx = [
    [7,0],[8,0],[9,0],[10,0],[11,0],[12,0],[13,0],[14,0],
    [5,1],[6,1],[15,1],[16,1],
    [4,2],[17,2],
    [3,3],[18,3],
    [3,4],[18,4],
  ];
  for (const [x, y] of glowPx) { px(x, y, 123, 104, 238, 100); px(x, 21-y, 123, 104, 238, 100); }

  // Head — bright purple, filled round shape
  rect(7, 1, 14, 2, 157, 130, 255);  // top of head
  rect(6, 3, 15, 8, 140, 115, 245);  // main head
  rect(5, 4, 16, 7, 140, 115, 245);  // wider middle

  // Eyes — bright white with pupils
  px(8, 6, 255, 255, 255); px(9, 6, 255, 255, 255);
  px(12, 6, 255, 255, 255); px(13, 6, 255, 255, 255);
  px(9, 6, 30, 20, 60); px(13, 6, 30, 20, 60); // pupils

  // Mouth — small smile
  px(9, 8, 180, 100, 220); px(10, 8, 180, 100, 220); px(11, 8, 180, 100, 220); px(12, 8, 180, 100, 220);

  // Body
  rect(7, 9, 14, 10, 100, 80, 210); // neck/shoulders
  rect(6, 11, 15, 15, 90, 70, 200);  // torso
  rect(5, 12, 6, 14, 90, 70, 200);   // left arm
  rect(15, 12, 16, 14, 90, 70, 200); // right arm

  // Legs
  rect(7, 16, 9, 19, 75, 55, 180);   // left leg
  rect(12, 16, 14, 19, 75, 55, 180); // right leg

  // Feet
  rect(6, 20, 10, 20, 60, 45, 160);  // left foot
  rect(11, 20, 15, 20, 60, 45, 160); // right foot

  // Code brackets on torso — bright accent
  px(8, 12, 255, 220, 100); px(8, 13, 255, 220, 100); px(8, 14, 255, 220, 100); // <
  px(13, 12, 255, 220, 100); px(13, 13, 255, 220, 100); px(13, 14, 255, 220, 100); // >
  px(10, 12, 255, 220, 100); px(11, 13, 255, 220, 100); // /

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
    const manifest = getSpriteManifest(spriteId);
    const spriteSize = manifest.display || { width: 384, height: 224 };
    const winWidth = Math.max(spriteSize.width, 350);
    const winHeight = spriteSize.height + 80;

    // On X11, resizable:false locks min/max size hints so setSize is ignored.
    // Temporarily enable resizable, resize, then lock again.
    mainWindow.setResizable(true);
    mainWindow.setSize(winWidth, winHeight);
    mainWindow.setResizable(false);

    mainWindow.setShape([{ x: 0, y: 0, width: winWidth, height: winHeight }]);

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
