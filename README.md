# Coding Companion

Animated sprite overlay that lives on your screen while Claude Code works. Your companion reacts to Claude's activity — idle when waiting, animated when thinking, and celebrating when done.

![Jotaro Companion](https://img.shields.io/badge/Electron-33-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## How it works

- **Idle** → Your character hangs out in their idle stance
- **Thinking** → Animated when Claude is processing your request (walk, crouch, etc.)
- **Pose** → Victory animation when Claude finishes (ORA ORA ORA!)

Communication happens via a simple `status.json` file that Claude Code hooks write to. The Electron app polls it every 300ms.

## Setup

### 1. Install

```bash
cd ~/.claude/coding-companion
npm install
```

### 2. Add a sprite pack

Create a folder in `sprites/` with:
- Individual PNG frames for your character
- A `manifest.json` defining animations, messages, and effects

See [sprites/jotaro/manifest.json](sprites/jotaro/manifest.json) for the format.

### 3. Configure Claude Code hooks

Add to `~/.claude/settings.json`:

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
        "hooks": [{ "type": "command", "command": "$HOME/.claude/coding-companion/hooks/set-status.sh thinking", "timeout": 2 }]
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

### 4. Manual launch (optional)

```bash
# Start
~/.claude/coding-companion/hooks/start-sprite.sh

# Stop
~/.claude/coding-companion/hooks/stop-sprite.sh

# Force a state
~/.claude/coding-companion/hooks/set-status.sh thinking
~/.claude/coding-companion/hooks/set-status.sh idle
```

## Sprite Pack Format

Each sprite pack is a folder in `sprites/` with a `manifest.json`:

```json
{
  "name": "Character Name",
  "author": "Source",
  "framePattern": "frame-{n}.png",
  "display": { "width": 384, "height": 224 },
  "animations": {
    "idle":    { "frames": [0, 17],  "speed": 120 },
    "walk":    { "frames": [40, 50], "speed": 100 },
    "punch":   { "frames": [700, 712], "speed": 80 },
    "victory": { "frames": [160, 172], "speed": 120 }
  },
  "states": {
    "idle":     { "animation": "idle", "loop": true },
    "thinking": { "animations": ["walk"], "loop": true, "swapInterval": 4000 },
    "pose":     { "animation": "punch", "loop": true, "duration": 5000,
                  "then": { "animation": "victory", "loop": false, "thenIdle": true } }
  },
  "messages": {
    "idle": ["Waiting...", "..."],
    "thinking": ["Working on it!", "Hmm..."],
    "pose": ["Done!", "Victory!"],
    "greeting": ["Hello!"]
  },
  "effects": {
    "thinkingAura": true,
    "poseParticles": true,
    "particleColor": "#ffd700"
  },
  "preview": "frame-0.png"
}
```

### Key fields

| Field | Description |
|-------|-------------|
| `framePattern` | Filename template, `{n}` is replaced by frame number |
| `animations` | Named animations with `[start, end]` frame range + speed (ms) |
| `states` | Maps app states (idle/thinking/pose) to animations |
| `messages` | Speech bubble text pools per state |
| `effects` | Visual effects (aura glow, particles) |
| `preview` | Filename used as thumbnail in character select |

## Character Select

Right-click the tray icon → **"Select Character..."** to open the picker. Your selection is saved to `config.json`.

## Architecture

```
coding-companion/
├── main.js          # Electron main process (window, tray, IPC, status watcher)
├── index.html       # Renderer (manifest-driven animation engine)
├── config.html      # Character selection UI
├── config.json      # Persisted selection (gitignored)
├── hooks/           # Shell scripts for Claude Code integration
│   ├── start-sprite.sh
│   ├── stop-sprite.sh
│   └── set-status.sh
└── sprites/
    └── <character>/
        ├── manifest.json
        └── *.png frames
```

## Note for VSCode/Cursor users

The hooks unset `ELECTRON_RUN_AS_NODE` which is set by VSCode/Cursor, allowing Electron to run in GUI mode instead of Node.js mode.

## License

MIT
