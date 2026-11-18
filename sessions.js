const fs = require("fs");
const os = require("os");
const path = require("path");

// COMPANION_SESSIONS_DIR: a fake folder, to try the sprite without real sessions
const SESSIONS_DIR = process.env.COMPANION_SESSIONS_DIR || path.join(os.homedir(), ".claude", "sessions");

// a crash leaves the file behind and its pid may now belong to another process: the start time tells them apart
function isLive({ pid, procStart }) {
  try { process.kill(pid, 0); } catch { return false; }
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    return procStart == null || stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19] === String(procStart);
  } catch { return true; } // no /proc (macOS): the pid is all we have
}

// Claude Code keeps one <pid>.json per running session, with its status (busy | idle | waiting).
// shortcut: this file format is not documented, an unknown status counts as idle; if it disappears,
// go back to hooks (session_id on stdin + the Notification hook).
function liveSessions(dir = SESSIONS_DIR) {
  let names;
  try { names = fs.readdirSync(dir).filter(n => n.endsWith(".json")); } catch { return null; }
  const out = [];
  for (const name of names) {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      if (s.sessionId && Number.isInteger(s.pid) && isLive(s)) out.push(s);
    } catch {}
  }
  return out;
}

// sessions + the status each had on the previous tick → what the sprite shows and what it announces.
// Headless runs (claude -p, e.g. Tempo's ranking) are not the user's sessions: they are left out.
function digest(sessions, prev = new Map()) {
  // they call themselves "interactive" too: the entrypoint (sdk-cli, against cli) gives them away
  const mine = sessions.filter(s => (s.kind == null || s.kind === "interactive") && !/^sdk/.test(s.entrypoint || ""));
  const next = new Map();
  const events = [];
  for (const s of mine) {
    const was = prev.get(s.sessionId);
    next.set(s.sessionId, s.status);
    const name = s.name || path.basename(s.cwd || "") || "Claude";
    if (s.status === "waiting" && was !== "waiting") events.push({ kind: "waiting", name, detail: s.waitingFor });
    if (was === "busy" && s.status !== "busy" && s.status !== "waiting") events.push({ kind: "done", name });
  }
  const has = status => mine.some(s => s.status === status);
  const state = has("waiting") ? "waiting" : has("busy") ? "working" : "idle";
  const waiting = mine.find(s => s.status === "waiting");
  return { state, events, next, waiting: waiting && (waiting.name || path.basename(waiting.cwd || "")) };
}

module.exports = { liveSessions, digest };
