import test from "node:test";
import assert from "node:assert/strict";
import {atom, makeIR, rule, validateIR} from "../src/index.mjs";

test("IR normalizes atoms and validates bound rule variables", () => {
  const ir = makeIR({
    facts: [atom("Person", "Alice")],
    rules: [rule(atom("can_run", "?x"), [atom("person", "?x")])]
  });
  assert.equal(ir.facts[0].pred, "person");
  assert.equal(ir.facts[0].args[0], "alice");
  assert.equal(validateIR(ir).ok, true);
});

test("IR rejects unbound head variables", () => {
  const ir = makeIR({rules: [{head: {pred:"p", args:["?x"]}, body:[{pred:"q", args:["?y"]}]}]});
  const v = validateIR(ir);
  assert.equal(v.ok, false);
  assert.match(v.errors.join(" "), /not bound/);
});
