# Coding Companion

## Project Overview

**Coding Companion** - Electron desktop overlay that shows an animated sprite reacting to Claude Code activity (idle, thinking, pose).

- **Stack:** Electron 33, vanilla JS, HTML/CSS
- **Package Manager:** npm
- **Platform:** Linux (X11), macOS

## Architecture

```
coding-companion/
├── main.js          # Electron main process (window, tray, IPC, status watcher)
├── index.html       # Renderer (manifest-driven animation engine)
├── config.html      # Character selection UI
├── config.json      # Persisted selection + position (gitignored)
├── hooks/           # Shell scripts for Claude Code integration
│   ├── start-sprite.sh
│   ├── stop-sprite.sh
│   └── set-status.sh
└── sprites/
    └── <character>/
        ├── manifest.json
        └── *.png frames
```

### Key Concepts

- **Sprite Pack Manifest** - Each character is a folder in `sprites/` with a `manifest.json` defining animations, states, messages, and effects
- **File-based IPC** - Communication via `status.json` polled every 300ms
- **Claude Code Hooks** - `SessionStart`, `UserPromptSubmit`, `Stop`, `SessionEnd` trigger status changes

## Commands

```bash
# Install
npm install

# Start/Stop (via hooks)
./hooks/start-sprite.sh
./hooks/stop-sprite.sh

# Force a state
./hooks/set-status.sh thinking
./hooks/set-status.sh idle
```

## Git & Commits

### Commit Convention

- **Format:** `<gitmoji> <message>` — max **50 caracteres** au total (emoji inclus)
- **Langue :** anglais
- **Gitmoji :** Utiliser le gitmoji le plus pertinent selon [gitmoji.dev](https://gitmoji.dev)
  - ✨ Feature | 🐛 Bug fix | ♻️ Refactor | 💄 UI/style | 🔥 Remove code/files
  - 🔧 Config | 🎨 Structure/format | 📝 Docs | ⬆️ Upgrade deps | 🎉 Init

### Regles Git

- **Ne jamais commit sans demande explicite** de l'utilisateur
- **Ne jamais push** sans demande explicite
- **Ne jamais force push** sur `main`
- **Ne jamais skip les hooks** (`--no-verify`) sauf demande explicite
- **Toujours creer un nouveau commit** plutot qu'amender (sauf demande explicite)
- **Stager les fichiers specifiquement** par nom — eviter `git add .` ou `git add -A`
- **Remote:** `git@github-prothomasclaude:prothomasclaude/coding-companion.git` (SSH alias for prothomasclaude account)

## Platform Notes

- **Linux:** `setIgnoreMouseEvents(true, { forward: true })` and `screen.getCursorScreenPoint()` don't work reliably on X11. Window is sized to sprite and uses `-webkit-app-region: drag` instead.
- **VSCode/Cursor:** Hooks unset `ELECTRON_RUN_AS_NODE` which these editors set, so Electron runs in GUI mode.
- **Tray icon:** Generated programmatically (22x22 pixel art). On Mac, `setTemplateImage(true)` for dark/light mode.
