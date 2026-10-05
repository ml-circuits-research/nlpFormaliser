import test from "node:test";
import assert from "node:assert/strict";
import {ProtoLLMStrategy, queryStatus} from "../src/index.mjs";

class FakeClient {
  async complete() {
    return JSON.stringify({facts:[{pred:"physicist",args:["mira"],neg:false}],rules:[]});
  }
}

test("ProtoLLMStrategy turns model JSON into validated Formal IR", async () => {
  const r = await new ProtoLLMStrategy({client:new FakeClient()}).formalize("Mira is a physicist.");
  assert.equal(queryStatus(r.ir, {pred:"physicist",args:["mira"]}), "TRUE");
  assert.ok(r.proto.tokens.length > 0);
});
