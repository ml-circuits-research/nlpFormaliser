import test from "node:test";
import assert from "node:assert/strict";
import {HeuristicStrategy, atomKey, queryStatus} from "../src/index.mjs";

test("heuristic baseline extracts simple type and relation", async () => {
  const r = await new HeuristicStrategy().formalize("Mira is a physicist. Mira owns a workstation.");
  assert.equal(queryStatus(r.ir, {pred:"physicist",args:["mira"]}), "TRUE");
  assert.equal(queryStatus(r.ir, {pred:"owns",args:["mira","workstation"]}), "TRUE");
});

test("heuristic exposes a draft artifact", async () => {
  const r = await new HeuristicStrategy().formalize("Alice owns GPU1.");
  assert.ok(r.artifacts.draft);
  assert.ok(new Set(r.ir.facts.map(atomKey)).has("owns(\"alice\",\"gpu1\")"));
});
