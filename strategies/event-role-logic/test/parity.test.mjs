// The checker, the CNL interpreter, the FOL reading and the QA engine must reproduce the outputs of the
// Python + SWI-Prolog reference implementation (draftStrategies/evl-prolog-research) on every formalisation
// produced in the research experiments (fixtures.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import strategy, { ask, check, fol } from "../index.mjs";
import { nativeFolFromFacts } from "../src/english.mjs";
import { freeVariables } from "../src/fol.mjs";

const F = JSON.parse(readFileSync(new URL("./fixtures.json", import.meta.url), "utf8"));
const VARIANTS = [[/\bcancell(ed|ing)\b/g, "cancel$1"], [/\btravell(ed|ing)\b/g, "travel$1"], [/\bpersons\b/g, "people"]];
const norm = (s) => VARIANTS.reduce((t, [re, to]) => t.replace(re, to), s);

function report(name, rows) {
  const bad = rows.filter((r) => !r.same);
  if (bad.length) console.log(`\n${name}: ${bad.length}/${rows.length} differ\n` + bad.slice(0, 12).map((r) => `  PY: ${r.py}\n  JS: ${r.js}`).join("\n"));
  return bad.length;
}

test("checker verdict", () => {
  assert.equal(report("check", F.cases.map((c) => ({ same: check(c.code).ok === c.ok, py: c.ok, js: check(c.code).errors.join(" | ") }))), 0);
});
test("CNL (English) from execution", () => {
  assert.equal(report("cnl", F.cases.filter((c) => c.english !== undefined)
    .map((c) => { const js = strategy.toCNL(c.code); return { same: norm(js) === norm(c.english), py: c.english, js }; })), 0);
});
// The native FOL port is kept and must still reproduce the Python reference.
test("native FOL reading", () => {
  const nat = (code) => nativeFolFromFacts(check(code).facts);
  assert.equal(report("fol", F.cases.filter((c) => c.fol !== undefined).map((c) => ({ same: nat(c.code) === c.fol, py: c.fol, js: nat(c.code) }))), 0);
});
// The active nested reading equals the reference except for recorded, documented
// divergences (fol-nested.json), and never leaves a variable free in a valid case.
test("nested FOL reading: reference parity plus recorded divergences", () => {
  const D = JSON.parse(readFileSync(new URL("./fol-nested.json", import.meta.url), "utf8")).cases;
  const rows = F.cases.map((c, i) => [c, i]).filter(([c]) => c.fol !== undefined)
    .map(([c, i]) => { const js = fol(c.code), want = D[i] ?? c.fol; return { same: js === want, py: want, js }; });
  assert.equal(report("nested fol", rows), 0);
  for (const c of F.cases.filter((c) => c.fol !== undefined && check(c.code).ok)) assert.deepEqual(freeVariables(fol(c.code)), [], c.code);
});
test("question answering", () => {
  assert.equal(report("qa", F.qa.map((c) => { const a = ask(c.context, c.question); return { same: a.answer === c.answer, py: c.answer, js: a.answer }; })), 0);
});
