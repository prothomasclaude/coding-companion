# Coding Companion

Animated pixel-art sprite that lives on your desktop and reacts to Claude Code activity in real time.

![Electron](https://img.shields.io/badge/Electron-33-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## How it works

Your companion watches Claude Code through shell hooks:

- **Idle** — character hangs out, occasionally talks
- **Working** — animated when Claude is processing (with aura glow)
- **Finished** — victory pose, particles, and celebration when Claude is done

Communication happens via a `status.json` file that Claude Code hooks write to. The Electron overlay polls it every 300ms.

## Installation

### Prerequisites

- **Node.js** 18+
- **npm**
- **Claude Code** CLI

### 1. Clone the repo

```bash
git clone git@github.com:prothomasclaude/coding-companion.git ~/.claude/coding-companion
cd ~/.claude/coding-companion
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Claude Code hooks

Add the following to your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [{ "type": "command", "command": "$HOME/.claude/coding-companion/hooks/start-sprite.sh", "timeout": 5 }]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [{ "type": "command", "command": "$HOME/.claude/coding-companion/hooks/stop-sprite.sh", "timeout": 5 }]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [{ "type": "command", "command": "$HOME/.claude/coding-companion/hooks/set-status.sh working", "timeout": 2 }]
      }
    ],
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "$HOME/.claude/coding-companion/hooks/set-status.sh idle", "timeout": 2 }]
      }
    ]
  }
}
```

That's it. Next time you start a Claude Code session, your companion will appear on screen.

## Usage

### Automatic (via hooks)

The companion starts/stops automatically with Claude Code sessions. No manual intervention needed.

### Manual

```bash
# Start the companion
~/.claude/coding-companion/hooks/start-sprite.sh

# Stop it
~/.claude/coding-companion/hooks/stop-sprite.sh

# Force a state
~/.claude/coding-companion/hooks/set-status.sh working
~/.claude/coding-companion/hooks/set-status.sh idle
```

### Select a character

Right-click the tray icon → **"Select Character..."** to open the picker. Your selection persists across sessions.

### Move the sprite

Click and drag the character to reposition it. Position is saved automatically.

## Available Characters

| Character | Source |
|-----------|--------|
| Jotaro Kujo | JoJo's Bizarre Adventure |
| DIO | JoJo's Bizarre Adventure |
| Joseph Joestar | JoJo's Bizarre Adventure |
| Monkey D. Luffy | One Piece |
| Murloc | World of Warcraft |
| Peon | Warcraft |
| Isaac | The Binding of Isaac |
| Slime | Generic RPG |

## Create your own sprite pack

Create a folder in `sprites/` with PNG frames and a `manifest.json`:

```
sprites/my-character/
├── manifest.json
├── frame_0.png
├── frame_1.png
├── ...
└── frame_N.png
```

### manifest.json

```json
{
  "name": "Character Name",
  "author": "Source",
  "framePattern": "frame_{n}.png",
  "display": { "width": 128, "height": 128 },
  "animations": {
    "idle":     { "frames": [0, 3],  "speed": 150 },
    "waiting":  { "frames": [4, 7],  "speed": 120 },
    "working":  { "frames": [8, 11], "speed": 100 },
    "finished": { "frames": [12, 15], "speed": 80 },
    "victory":  { "frames": [16, 19], "speed": 140 }
  },
  "states": {
    "idle":     { "animation": "idle", "loop": true },
    "working":  { "animations": ["waiting", "working"], "loop": true, "swapInterval": 3000 },
    "finished": { "animation": "finished", "loop": true, "duration": 4000,
                  "then": { "animation": "victory", "loop": false, "thenIdle": true } }
  },
  "messages": {
    "idle": ["Waiting...", "..."],
    "working": ["On it!", "Hmm..."],
    "finished": ["Done!", "Victory!"],
    "greeting": ["Hello!"]
  },
  "sounds": {
    "working": ["sounds/work.wav"],
    "finished": ["sounds/done.wav"],
    "greeting": ["sounds/hello.wav"],
    "victory": ["sounds/win.wav"]
  },
  "effects": {
    "thinkingAura": true,
    "poseParticles": true,
    "particleColor": "#ffd700"
  },
  "hitArea": { "x": 10, "y": 10, "width": 108, "height": 108 },
  "preview": "frame_0.png"
}
```

### Manifest reference

| Field | Description |
|-------|-------------|
| `framePattern` | Filename template — `{n}` is replaced by the frame number |
| `display` | CSS size of the sprite in pixels. Small sprites are upscaled with `image-rendering: pixelated` |
| `animations` | Named animations with `[startFrame, endFrame]` range and `speed` in ms per frame |
| `states.idle` | Animation played when Claude is idle |
| `states.working` | Animation(s) played when Claude is processing. Multiple animations rotate via `swapInterval` |
| `states.finished` | Played when Claude finishes. `then` chains a follow-up animation before returning to idle |
| `messages` | Speech bubble text pools — a random message is picked per state |
| `sounds` | Audio file pools per state (paths relative to sprite folder). Optional |
| `effects` | `thinkingAura`: radial glow. `poseParticles`: particle burst on finish |
| `hitArea` | Draggable click zone relative to the sprite's top-left corner |
| `preview` | Filename used as thumbnail in the character select screen |

## Architecture

```
coding-companion/
├── main.js          # Electron main process (window, tray, IPC, status watcher)
├── index.html       # Renderer (manifest-driven animation engine)
├── config.html      # Character selection UI
├── config.json      # Persisted selection + position (gitignored)
├── hooks/
│   ├── start-sprite.sh   # Launches electron + sets status to working
│   ├── stop-sprite.sh    # Kills the electron process
│   └── set-status.sh     # Writes state to status.json
└── sprites/
    └── <character>/
        ├── manifest.json
        └── *.png frames
```

## Platform notes

- **Linux (X11)**: Window uses `-webkit-app-region: drag` for dragging. Position saved via IPC.
- **macOS**: Tray icon uses `setTemplateImage(true)` for dark/light mode support.
- **VSCode/Cursor**: Hooks unset `ELECTRON_RUN_AS_NODE` so Electron runs in GUI mode.

## License

MIT
