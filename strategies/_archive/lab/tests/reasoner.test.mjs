import test from "node:test";
import assert from "node:assert/strict";
import {atom, atomOptions, makeIR, queryStatus, rule} from "../src/index.mjs";

test("reasoner derives rules and distinguishes FALSE from UNKNOWN", () => {
  const ir = makeIR({
    facts: [atom("person", "alice"), atom("blocked", "bob", atomOptions({neg:true}))],
    rules: [rule(atom("eligible", "?x"), [atom("person", "?x")])]
  });
  assert.equal(queryStatus(ir, atom("eligible", "alice")), "TRUE");
  assert.equal(queryStatus(ir, atom("blocked", "bob")), "FALSE");
  assert.equal(queryStatus(ir, atom("person", "carol")), "UNKNOWN");
});
