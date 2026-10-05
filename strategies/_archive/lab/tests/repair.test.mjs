import test from "node:test";
import assert from "node:assert/strict";
import {RepairLLMStrategy, queryStatus} from "../src/index.mjs";

class FakeRepairClient {
  async complete() {
    return JSON.stringify({
      facts:[
        {pred:"physicist",args:["mira"],neg:false},
        {pred:"owns",args:["mira","workstation"],neg:false}
      ],
      rules:[]
    });
  }
}

test("repair strategy accepts model JSON and keeps draft for reuse metrics", async () => {
  const r = await new RepairLLMStrategy({client:new FakeRepairClient()}).formalize("Mira, a physicist, owns the workstation.");
  assert.equal(queryStatus(r.ir, {pred:"owns",args:["mira","workstation"]}), "TRUE");
  assert.ok(r.artifacts.draft);
});
