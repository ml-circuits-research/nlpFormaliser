// Benchmark: compare formalisation methods with the round-trip CNL test.
//
//   NL ──method.formalize──▶ formalisation ──method.check──▶ ok?
//                                   │
//                          method.realize (execution)
//                                   ▼
//                                  CNL ──judge(NL, CNL)──▶ same meaning?
//
// Optional loop: if the method has refine(), the formalisation is repaired with the loop judge's feedback
// (up to `rounds` times). The final score is given by a SEPARATE evaluation judge (ideally a different,
// stronger model with a different prompt), so a method cannot overfit the judge it was repaired against.
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PROMPTS } from "./formaliser.mjs";
import { extractJson } from "./llm.mjs";

/** Binary equivalence judge (used inside the loop). */
export function loopJudge(llm) {
  return async (original, cnl) => {
    try {
      const d = extractJson(await llm(PROMPTS.judgeSystem, `Text A (original):\n${original}\n\nText B (reconstruction):\n${cnl}`));
      return { equivalent: Boolean(d.equivalent), differences: d.differences ?? [] };
    } catch (e) { return { equivalent: false, differences: [`judge error: ${e.message}`] }; }
  };
}

/** Graded evaluation judge: "equivalent" | "minor" | "major". */
export function evalJudge(llm) {
  return async (original, cnl) => {
    if (cnl == null) return { label: "major", reason: "no valid formalisation" };
    try {
      const d = extractJson(await llm(PROMPTS.evalJudgeSystem, `ORIGINAL:\n${original}\n\nRECONSTRUCTION:\n${cnl}`));
      return { label: ["equivalent", "minor", "major"].includes(d.label) ? d.label : "major", reason: d.reason ?? "" };
    } catch (e) { return { label: "major", reason: `judge error: ${e.message}` }; }
  };
}

/** Load a JSONL dataset: one {"id", "text", ...} per line. */
export async function loadDataset(path) {
  return (await readFile(path, "utf8")).split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}

/** Run one item through one method (with the optional repair loop). */
export async function runItem(method, text, { judge, rounds = 4 }) {
  const t0 = Date.now();
  const trace = [];
  let f;
  try { f = await method.formalize(text); } catch (e) { return { error: `formalize failed: ${e.message}`, trace, valid: false, converged: false }; }
  const maxRounds = method.refine ? rounds : 0;
  for (let round = 0; round <= maxRounds; round++) {
    let errors = [];
    if (method.check) { try { const c = await method.check(f); if (!c.ok) errors = c.errors ?? ["invalid"]; } catch (e) { errors = [e.message]; } }
    let cnl = null, verdict = null;
    if (!errors.length) {
      try { cnl = await method.realize(f); } catch (e) { errors = [`realize failed: ${e.message}`]; }
    }
    if (cnl != null) verdict = await judge(text, cnl);
    trace.push({ round, formalization: f, errors, cnl, verdict });
    if (verdict?.equivalent || round === maxRounds) break;
    try { f = await method.refine(text, f, { errors, realization: cnl, differences: verdict?.differences ?? [] }); }
    catch (e) { trace.at(-1).errors.push(`refine failed: ${e.message}`); break; }
  }
  const valid = trace.filter((s) => s.cnl != null);
  return {
    valid: valid.length > 0,
    validFirst: trace[0]?.cnl != null,
    converged: Boolean(trace.at(-1)?.verdict?.equivalent),
    rounds: trace.length - 1,
    firstCnl: valid[0]?.cnl ?? null,
    finalCnl: valid.at(-1)?.cnl ?? null,
    finalFormalization: (valid.at(-1) ?? trace.at(-1))?.formalization ?? null,
    trace,
    seconds: (Date.now() - t0) / 1000,
  };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.max(1, n) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "–");

/**
 * Compare methods on a dataset.
 * @param {object} o
 * @param {Array} o.methods          method objects (see methods.mjs)
 * @param {Array} o.items            [{id, text, ...}]
 * @param {Function} o.loopLLM       LLM for the loop judge (e.g. Haiku)
 * @param {Function} o.evalLLM       LLM for the final evaluation judge (e.g. Sonnet)
 * @param {number} [o.rounds=4]      max repair rounds (only for methods with refine)
 * @param {number} [o.concurrency=4]
 * @param {string} [o.out]           directory for <method>.jsonl, summary.md, summary.json (resumable)
 * @returns {Promise<{summary: object, markdown: string}>}
 */
export async function benchmark({ methods, items, loopLLM, evalLLM, rounds = 4, concurrency = 4, out, onItem }) {
  const judge = loopJudge(loopLLM), grade = evalJudge(evalLLM ?? loopLLM);
  if (out) await mkdir(out, { recursive: true });
  const summary = {};
  for (const m of methods) {
    const file = out ? join(out, `${m.name.replace(/[^\w.+-]/g, "_")}.jsonl`) : null;
    const done = new Map();
    if (file) {
      try { for (const l of (await readFile(file, "utf8")).split("\n")) if (l.trim()) { const r = JSON.parse(l); done.set(r.id, r); } } catch { /* new */ }
    }
    const results = await pool(items, concurrency, async (it) => {
      if (done.has(it.id)) return done.get(it.id);
      const r = await runItem(m, it.text, { judge, rounds });
      const [g1, g2] = await Promise.all([grade(it.text, r.firstCnl), grade(it.text, r.finalCnl)]);
      const rec = { id: it.id, cat: it.cat, text: it.text, method: m.name, ...r, evalFirst: g1, evalFinal: g2 };
      if (file) await appendFile(file, JSON.stringify(rec) + "\n");
      onItem?.(rec);
      return rec;
    });
    const n = results.length, c = (f) => results.filter(f).length;
    summary[m.name] = {
      n, deterministicRealizer: m.deterministicRealizer ?? null, hasRefine: Boolean(m.refine),
      validFirst: c((r) => r.validFirst), valid: c((r) => r.valid), loopAccepted: c((r) => r.converged),
      equivalentFirst: c((r) => r.evalFirst?.label === "equivalent"),
      equivalent: c((r) => r.evalFinal?.label === "equivalent"),
      minor: c((r) => r.evalFinal?.label === "minor"), major: c((r) => r.evalFinal?.label === "major"),
      meanRounds: n ? +(results.reduce((s, r) => s + (r.rounds ?? 0), 0) / n).toFixed(2) : 0,
    };
  }
  const rows = Object.entries(summary).map(([name, s]) =>
    `| ${name} | ${s.n} | ${s.deterministicRealizer ? "yes" : "no"} | ${pct(s.validFirst, s.n)} | ${pct(s.equivalentFirst, s.n)} | ` +
    `${pct(s.equivalent, s.n)} | ${pct(s.equivalent + s.minor, s.n)} | ${pct(s.major, s.n)} | ${s.meanRounds} |`);
  const markdown = [
    `Test cases: ${items.length}. Percentages are of test cases; labels from the evaluation judge.`, "",
    "| method | test cases | deterministic CNL | valid formalisation (1st try) | equivalent (1st try) | equivalent (after loop) | equivalent or minor (after loop) | major (after loop) | mean repair rounds |",
    "|---|---|---|---|---|---|---|---|---|", ...rows,
  ].join("\n");
  if (out) {
    await writeFile(join(out, "summary.json"), JSON.stringify(summary, null, 2));
    await writeFile(join(out, "summary.md"), markdown + "\n");
  }
  return { summary, markdown };
}
