#!/bin/bash
# Start the Coding Companion Electron app if not already running
SPRITE_DIR="$HOME/.claude/coding-companion"
PID_FILE="$SPRITE_DIR/sprite.pid"

# Check if already running
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    # Already running, just set working
    "$SPRITE_DIR/hooks/set-status.sh" working
    exit 0
  fi
fi

# Set initial status
"$SPRITE_DIR/hooks/set-status.sh" working

# Find Electron binary (cross-platform)
cd "$SPRITE_DIR"
if [ "$(uname)" = "Darwin" ]; then
  ELECTRON="./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
else
  ELECTRON="./node_modules/electron/dist/electron"
fi

# Unset ELECTRON_RUN_AS_NODE (set by Cursor/VSCode) so Electron runs in GUI mode
ELECTRON_RUN_AS_NODE= ELECTRON_NO_ATTACH_CONSOLE= "$ELECTRON" . &>/dev/null &
echo $! > "$PID_FILE"

exit 0
