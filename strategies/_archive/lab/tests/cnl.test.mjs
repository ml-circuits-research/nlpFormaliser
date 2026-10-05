import test from "node:test";
import assert from "node:assert/strict";
import {atom, makeIR, renderCNL, rule} from "../src/index.mjs";

test("CNL is deterministic and exposes facts/rules", () => {
  const ir = makeIR({
    facts: [atom("physicist", "mira"), atom("owns", "mira", "gpu1")],
    rules: [rule(atom("can_run", "?x"), [atom("physicist", "?x")])],
    symbols: {entities: {mira:{label:"Mira"}, gpu1:{label:"GPU-1"}}, predicates: {owns:{cnl:"{0} owns {1}"}}}
  });
  const a = renderCNL(ir);
  const b = renderCNL(ir);
  assert.equal(a, b);
  assert.match(a, /Mira owns GPU-1/);
  assert.match(a, /IF/);
});
