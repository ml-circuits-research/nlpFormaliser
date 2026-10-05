import test from "node:test";
import assert from "node:assert/strict";
import {judgeRepeated} from "../src/index.mjs";

class FakeClient {
  async complete() {
    return JSON.stringify({
      coverage:0.9, faithfulness:0.8, scope:1, coreference:1, temporal_modality:1,
      verdict:"minor_loss", omissions:["one detail"], unsupported:[], scope_errors:[], explanation:"ok"
    });
  }
}

test("judge computes directional semantic F1 and aggregates", async () => {
  const r = await judgeRepeated({client:new FakeClient(), nl:"A", cnl:"B", runs:2});
  assert.ok(r.semanticF1 > 0.84 && r.semanticF1 < 0.85);
  assert.equal(r.runs.length, 2);
  assert.equal(r.coverage_stddev, 0);
});
