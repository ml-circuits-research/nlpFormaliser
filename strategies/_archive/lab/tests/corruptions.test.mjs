import test from "node:test";
import assert from "node:assert/strict";
import {generateCorruptions, makeIR, atom} from "../src/index.mjs";

test("corruption generator creates controlled semantic defects", () => {
  const ir = makeIR({facts:[atom("owns","alice","gpu1")]});
  const xs = generateCorruptions(ir, {max:10});
  assert.ok(xs.some((x) => x.kind === "drop_fact"));
  assert.ok(xs.some((x) => x.kind === "swap_arguments"));
  assert.ok(xs.some((x) => x.kind === "flip_negation"));
  assert.ok(xs.some((x) => x.kind === "unsupported_fact"));
});
