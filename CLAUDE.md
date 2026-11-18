# Coding Companion

## Project Overview

**Coding Companion** - Electron desktop overlay that shows an animated sprite reacting to Claude Code activity (idle, working, waiting for you, finished), across every open session.

- **Stack:** Electron 33, vanilla JS, HTML/CSS
- **Since 2026-11-18 the sprite runs inside Tempo** (`~/code/private/tempo`, widget "Compagnon", `companion.js`), which reads the packs of `sprites/` here. This repo stays the home of the sprite packs and of the standalone app, whose `SessionStart` hook is no longer installed. An engine change must be made in Tempo's `companion.js` too.
- **Package Manager:** npm
- **Platform:** Linux (X11), macOS

## Architecture

```
coding-companion/
├── main.js          # Electron main process (window, tray, IPC, status watcher)
├── sessions.js      # Reads Claude Code's session files, decides the state (tested)
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
- **State from session files** - `~/.claude/sessions/<pid>.json` holds each running session's `status` (`busy`, `idle`, `waiting`). Polled every 500ms: one waiting session → `waiting` (sticky bubble naming it), else one busy → `working`, else `idle`. This format is undocumented: an unknown status counts as idle.
- **One hook only** - `SessionStart` (`startup|resume`) starts the sprite. It quits by itself 60s after the last session closes. Never add back `SessionEnd`/`Stop`/`UserPromptSubmit` hooks: with several sessions open they kill or mislead the sprite.
- **`status.json`** - manual override only (`hooks/set-status.sh`), held 10s.
- **Tempo** - when `~/.config/tempo/notifications.json` exists, new notifications become bubbles (Tempo's focus and do-not-disturb are respected). Nothing is needed on Tempo's side.
- **Renderer calls** - always through `call()` in `main.js` (JSON-encoded arguments), never by building a JS string.

## Commands

```bash
# Install
npm install

# Start/Stop (via hooks)
./hooks/start-sprite.sh
./hooks/stop-sprite.sh

# Force a state for 10s (testing a pack)
./hooks/set-status.sh working
./hooks/set-status.sh idle

# Tests
npm test
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

## Adding Sprite Packs

### Frame Requirements

- **All frames must have identical dimensions** — use a transparent canvas padded to the largest frame's bounding box
- **Bottom-align** sprites on the canvas so feet stay grounded across frames
- Use Python PIL to normalize: find max width/height, center horizontally, align bottom vertically
- `display.width` and `display.height` in manifest must match actual frame dimensions

### Manifest Structure

- `animations` — named clip ranges with `[startFrame, endFrame]` and `speed` (ms per frame)
- `states` — maps app states (`idle`, `working`, `finished`) to animations with loop/chain behavior
- `messages` — random text lines per state shown in speech bubble
- `sounds` — (optional) audio files per state in a `sounds/` subfolder
- `effects` — (optional) visual effects like `thinkingAura`, `poseParticles`

### State Mapping (Claude Code → Sprite)

| Hook Event | State | Typical Animation |
|---|---|---|
| a session is `busy` | `working` | character actively doing something |
| a session is `waiting` (permission, question) | `waiting` | optional `states.waiting` + `lines.waiting`, falls back to idle |
| last busy session goes idle | `finished` | task complete, celebration |
| nothing running | `idle` | standing, breathing, waiting |

### Checklist for New Sprite Packs

1. Extract frames from spritesheet → individual PNGs
2. Normalize all frames to uniform canvas size (bottom-aligned)
3. Name frames sequentially: `{prefix}_{n}.png` starting at 0
4. Create `manifest.json` with correct frame ranges and display size
5. Test all states: `./hooks/set-status.sh idle|working|finished`

## Platform Notes

- **Linux:** `setIgnoreMouseEvents(true, { forward: true })` and `screen.getCursorScreenPoint()` don't work reliably on X11. Window is sized to sprite and uses `-webkit-app-region: drag` instead.
- **VSCode/Cursor:** Hooks unset `ELECTRON_RUN_AS_NODE` which these editors set, so Electron runs in GUI mode.
- **Tray icon:** Generated programmatically (22x22 pixel art). On Mac, `setTemplateImage(true)` for dark/light mode.
