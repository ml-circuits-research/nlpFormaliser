import test from "node:test";
import assert from "node:assert/strict";
import {buildProtoIR} from "../src/index.mjs";

test("ProtoIR preserves source and exact spans", () => {
  const text = "If Alice does not approve R2, Bob may review it tomorrow.";
  const p = buildProtoIR(text);
  assert.equal(p.source, text);
  for (const t of p.tokens) assert.equal(text.slice(t.start, t.end), t.text);
  assert.ok(p.markers.some((m) => m.kind === "conditional"));
  assert.ok(p.markers.some((m) => m.kind === "negation"));
  assert.ok(p.markers.some((m) => m.kind === "modality"));
  assert.ok(p.markers.some((m) => m.kind === "temporal"));
  assert.ok(p.mentions.some((m) => m.text === "Alice"));
  assert.ok(p.mentions.some((m) => m.text.toLowerCase() === "it"));
});
