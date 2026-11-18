const test = require("node:test");
const assert = require("node:assert");
const { digest } = require("./sessions");

const s = (id, status, extra = {}) => ({ sessionId: id, pid: 1, name: id, status, kind: "interactive", ...extra });

test("one busy session among idle ones keeps the sprite working", () => {
  const { state, events } = digest([s("a", "idle"), s("b", "busy")]);
  assert.equal(state, "working");
  assert.deepEqual(events, []);
});

test("a session finishing while another works announces it without going idle", () => {
  const prev = new Map([["a", "busy"], ["b", "busy"]]);
  const { state, events } = digest([s("a", "idle"), s("b", "busy")], prev);
  assert.equal(state, "working");
  assert.deepEqual(events, [{ kind: "done", name: "a" }]);
});

test("waiting wins over working and is announced once", () => {
  const first = digest([s("a", "waiting", { waitingFor: "permission" }), s("b", "busy")]);
  assert.equal(first.state, "waiting");
  assert.equal(first.waiting, "a");
  assert.deepEqual(first.events, [{ kind: "waiting", name: "a", detail: "permission" }]);
  assert.deepEqual(digest([s("a", "waiting"), s("b", "busy")], first.next).events, []);
});

test("headless runs and unknown statuses do not move the sprite", () => {
  const { state, events } = digest([s("a", "busy", { entrypoint: "sdk-cli" }), s("b", "whatever")], new Map([["a", "idle"], ["b", "busy"]]));
  assert.equal(state, "idle");
  assert.deepEqual(events, [{ kind: "done", name: "b" }]);
});
