const { app, BrowserWindow, screen, Tray, Menu, ipcMain, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const { liveSessions, digest } = require("./sessions");

const STATUS_FILE = path.join(__dirname, "status.json");
const CONFIG_FILE = path.join(__dirname, "config.json");
const SPRITES_DIR = path.join(__dirname, "sprites");
const IS_MAC = process.platform === "darwin";

let mainWindow;
let configWindow;
let tray;
let savePositionTimer;

// Call a renderer function. Arguments go through JSON: session names and Tempo titles are
// text written by others, and the renderer has nodeIntegration.
function call(win, fn, ...args) {
  if (!win || win.isDestroyed()) return;
  win.webContents.executeJavaScript(`window.${fn} && window.${fn}(...${JSON.stringify(args)})`).catch(() => {});
}

// ===== Config =====
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return { selectedSprite: "peon", lang: "en" };
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
        let manifest;
        // one broken manifest must not hide the packs after it
        try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch { continue; }
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
  let startX, startY;
  if (config.posX !== undefined && config.posY !== undefined) {
    // Clamp restored position to the nearest display so the sprite isn't split across screens
    const centerX = config.posX + Math.round(winWidth / 2);
    const centerY = config.posY + Math.round(winHeight / 2);
    const nearest = screen.getDisplayNearestPoint({ x: centerX, y: centerY });
    const { x: dx, y: dy, width: dw, height: dh } = nearest.workArea;
    startX = Math.max(dx, Math.min(config.posX, dx + dw - winWidth));
    startY = Math.max(dy, Math.min(config.posY, dy + dh - winHeight));
  } else {
    startX = width - winWidth - 40;
    startY = height - winHeight - 20;
  }

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
    call(mainWindow, "initCompanion", config.selectedSprite, config.lang || "en");
    ensureStatusFile();
    watchStatus();
  });

  // Save position when window moves (debounced)
  // On Linux/X11, "moved" doesn't fire for -webkit-app-region drag,
  // so we also poll position periodically as a fallback.
  const savePosition = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [x, y] = mainWindow.getPosition();
    const cfg = loadConfig();
    if (cfg.posX === x && cfg.posY === y) return;
    cfg.posX = x;
    cfg.posY = y;
    saveConfig(cfg);
  };
  mainWindow.on("moved", () => {
    if (savePositionTimer) clearTimeout(savePositionTimer);
    savePositionTimer = setTimeout(savePosition, 500);
  });
  // Fallback: poll position every 2s (cheap on resources)
  const positionPollInterval = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      clearInterval(positionPollInterval);
      return;
    }
    savePosition();
  }, 2000);

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

function buildContextMenu() {
  const config = loadConfig();
  const lang = config.lang || "en";

  return Menu.buildFromTemplate([
    {
      label: "Select Character...",
      click: () => createConfigWindow(),
    },
    { type: "separator" },
    {
      label: "Language",
      submenu: [
        {
          label: "English",
          type: "radio",
          checked: lang === "en",
          click: () => {
            const c = loadConfig();
            c.lang = "en";
            saveConfig(c);
            call(mainWindow, "setLang", "en");
            call(configWindow, "onLangChanged", "en");
            tray.setContextMenu(buildContextMenu());
          },
        },
        {
          label: "Français",
          type: "radio",
          checked: lang === "fr",
          click: () => {
            const c = loadConfig();
            c.lang = "fr";
            saveConfig(c);
            call(mainWindow, "setLang", "fr");
            call(configWindow, "onLangChanged", "fr");
            tray.setContextMenu(buildContextMenu());
          },
        },
      ],
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => app.quit(),
    },
  ]);
}

function createTray() {
  const trayIcon = createTrayIcon();
  tray = new Tray(trayIcon);
  tray.setToolTip("Coding Companion");
  tray.setContextMenu(buildContextMenu());
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

    call(mainWindow, "reloadSprite", spriteId);
  }
  return { success: true };
});

ipcMain.handle("set-lang", (_event, lang) => {
  const config = loadConfig();
  config.lang = lang;
  saveConfig(config);
  call(mainWindow, "setLang", lang);
  // Rebuild tray to update radio state
  if (tray) tray.setContextMenu(buildContextMenu());
  // Notify config window
  call(configWindow, "onLangChanged", lang);
  return { success: true };
});

// Manual window drag via IPC — absolute coordinates anchored at drag start.
// Relative deltas drift on X11: setPosition is async, so getPosition returns
// stale values during fast moves and the window falls behind the cursor.
let dragOrigin = null;
ipcMain.on("drag-start", (_event, cursorX, cursorY) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const [winX, winY] = mainWindow.getPosition();
  dragOrigin = { winX, winY, cursorX, cursorY };
});
ipcMain.on("drag-move", (_event, cursorX, cursorY) => {
  if (!mainWindow || mainWindow.isDestroyed() || !dragOrigin) return;
  mainWindow.setPosition(
    dragOrigin.winX + (cursorX - dragOrigin.cursorX),
    dragOrigin.winY + (cursorY - dragOrigin.cursorY),
  );
});
ipcMain.on("drag-end", () => {
  dragOrigin = null;
});

// ===== Status File =====
function ensureStatusFile() {
  if (!fs.existsSync(STATUS_FILE)) {
    fs.writeFileSync(STATUS_FILE, JSON.stringify({ state: "idle", timestamp: Date.now() }));
  }
}

const TEXT = {
  en: { waiting: n => `${n} needs you`, done: n => `${n} is done` },
  fr: { waiting: n => `${n} t'attend`, done: n => `${n} a fini` },
};

// The state comes from Claude Code's own session files, so every open session counts:
// the sprite works while any of them works and asks for you when one is blocked.
// status.json stays as a manual override (hooks/set-status.sh), held for a few seconds.
function watchStatus() {
  let prev = new Map();
  let lastState = null;
  let lastNote = "";
  let lastForced = fs.statSync(STATUS_FILE).mtimeMs; // what was written before we started is stale
  let forcedUntil = 0;
  let emptySince = null;
  const tempoFile = path.join(app.getPath("appData"), "tempo", "notifications.json");
  let tempoAt = 0;
  const tempoSeen = new Set();
  let tempoPrimed = false;

  const tick = () => {
    const text = TEXT[loadConfig().lang] || TEXT.en;

    try {
      const at = fs.statSync(STATUS_FILE).mtimeMs;
      if (at !== lastForced) {
        lastForced = at;
        const data = JSON.parse(fs.readFileSync(STATUS_FILE, "utf8"));
        forcedUntil = Date.now() + 10000;
        lastState = null;
        call(mainWindow, "updateState", String(data.state), String(data.context || ""));
      }
    } catch {}

    const sessions = liveSessions();
    if (sessions) {
      // nobody left: leave, the SessionStart hook brings the sprite back
      emptySince = sessions.length ? null : emptySince ?? Date.now();
      if (emptySince && Date.now() - emptySince > 60000) return app.quit();

      const d = digest(sessions, prev);
      prev = d.next;
      const note = d.waiting ? text.waiting(d.waiting) : "";
      if (Date.now() > forcedUntil && (d.state !== lastState || note !== lastNote)) {
        lastState = d.state;
        lastNote = note;
        call(mainWindow, "updateState", d.state, "", note);
      }
      for (const e of d.events) {
        // a waiting session already shows in the sticky bubble of the waiting state
        if (e.kind === "done" && d.state !== "idle") call(mainWindow, "say", text.done(e.name), "finished");
      }
    }

    // Tempo, when it runs: its notifications (review asked, CI red, run finished) become bubbles.
    // Tempo holds them back during a focus or do-not-disturb, and so does the sprite.
    try {
      const at = fs.statSync(tempoFile).mtimeMs;
      if (at !== tempoAt) {
        tempoAt = at;
        for (const n of JSON.parse(fs.readFileSync(tempoFile, "utf8"))) {
          if (n.held || tempoSeen.has(n.id)) continue;
          tempoSeen.add(n.id);
          // shortcut: matched on Tempo's wording, the session files already announce that one
          if (tempoPrimed && !n.read && !/Claude t'attend/.test(n.title)) call(mainWindow, "say", [n.title, n.body].filter(Boolean).join(" : "), "idle");
        }
        tempoPrimed = true;
      }
    } catch {}
  };
  setInterval(tick, 500);
  tick();
}

// ===== App Lifecycle =====
// two sessions starting together must not give two sprites
if (!app.requestSingleInstanceLock()) app.quit();

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on("window-all-closed", () => app.quit());
// the sprite now quits by itself: leave no pid behind for start-sprite.sh, unless it is another instance's
app.on("quit", () => {
  const pidFile = path.join(__dirname, "sprite.pid");
  try { if (fs.readFileSync(pidFile, "utf8").trim() === String(process.pid)) fs.unlinkSync(pidFile); } catch {}
});
process.on("SIGTERM", () => app.quit());
process.on("SIGINT", () => app.quit());
