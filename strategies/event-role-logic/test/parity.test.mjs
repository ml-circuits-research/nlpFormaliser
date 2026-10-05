// The checker, the CNL interpreter, the FOL reading and the QA engine must reproduce the outputs of the
// Python + SWI-Prolog reference implementation (draftStrategies/evl-prolog-research) on every formalisation
// produced in the research experiments (fixtures.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import strategy, { ask, check, fol } from "../index.mjs";

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
test("FOL reading", () => {
  assert.equal(report("fol", F.cases.filter((c) => c.fol !== undefined).map((c) => ({ same: fol(c.code) === c.fol, py: c.fol, js: fol(c.code) }))), 0);
});
test("question answering", () => {
  assert.equal(report("qa", F.qa.map((c) => { const a = ask(c.context, c.question); return { same: a.answer === c.answer, py: c.answer, js: a.answer }; })), 0);
});
