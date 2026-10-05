// Parity with the Python reference implementation (fixtures from experiments/make_js_fixtures.py):
// the JS checker, English verbaliser, FOL reading and QA engine must give the same outputs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ask, check, fol, verbalize } from "../index.mjs";

const F = JSON.parse(readFileSync(new URL("./fixtures.json", import.meta.url), "utf8"));

function report(name, rows) {
  const bad = rows.filter((r) => !r.same);
  if (bad.length) console.log(`\n${name}: ${bad.length}/${rows.length} differ\n` + bad.slice(0, 12).map((r) => `  PY: ${r.py}\n  JS: ${r.js}`).join("\n"));
  return bad.length;
}

test("checker verdict matches Python", () => {
  const rows = F.cases.map((c) => { const r = check(c.code); return { same: r.ok === c.ok, py: `${c.ok} ${c.n_errors}`, js: `${r.ok} ${r.errors.join(" | ")} :: ${c.code.slice(0, 80)}` }; });
  assert.equal(report("check", rows), 0);
});

// spelling variants where the two morphology libraries (lemminflect vs compromise) legitimately differ
const VARIANTS = [[/\bcancell(ed|ing)\b/g, "cancel$1"], [/\btravell(ed|ing)\b/g, "travel$1"], [/\bpersons\b/g, "people"]];
const norm = (s) => VARIANTS.reduce((t, [re, to]) => t.replace(re, to), s.replace(/\bcancel(ed|ing)\b/g, "cancel$1"));

test("English verbalisation matches Python", () => {
  const rows = F.cases.filter((c) => c.english !== undefined).map((c) => { const js = verbalize(c.code); return { same: norm(js) === norm(c.english), py: c.english, js }; });
  assert.equal(report("english", rows), 0);
});

test("FOL reading matches Python", () => {
  const rows = F.cases.filter((c) => c.fol !== undefined).map((c) => { const js = fol(c.code); return { same: js === c.fol, py: c.fol, js }; });
  assert.equal(report("fol", rows), 0);
});

test("QA answers match Python", () => {
  const rows = F.qa.map((c) => { const a = ask(c.context, c.question); return { same: a.answer === c.answer, py: `${c.answer} [${c.mode}]`, js: `${a.answer} [${a.mode}] ${(a.detail || []).join(";")}` }; });
  assert.equal(report("qa", rows), 0);
});
