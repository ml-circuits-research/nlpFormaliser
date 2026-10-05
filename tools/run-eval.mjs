#!/usr/bin/env node
// Evaluate a strategy on an evaluation set: for every utterance, NL → formalisation → CNL → judge.
// Results: results/<strategy>/<set>/{items.jsonl, report.md, report.json}  (resumable: finished items are skipped)
//
//   node tools/run-eval.mjs --strategy evl --set base
//   node tools/run-eval.mjs --strategy evl --set base --opt rounds=0 --tag single-shot --limit 20
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { DEFAULT_JUDGE_MODEL, DEFAULT_MODEL, makeLLM, parseOpts } from "./lib/cli.mjs";
import { loadSet } from "./lib/evalset.mjs";
import { makeJudge } from "./lib/judge.mjs";
import { ROOT, formalizeToCNL, loadStrategy } from "./lib/strategies.mjs";

const { values: o } = parseArgs({ options: {
  strategy: { type: "string", short: "s" }, set: { type: "string", default: "base" }, opt: { type: "string", multiple: true },
  model: { type: "string" }, "judge-model": { type: "string" }, provider: { type: "string" }, cache: { type: "string" },
  concurrency: { type: "string", default: "6" }, limit: { type: "string" }, category: { type: "string", multiple: true },
  tag: { type: "string" }, out: { type: "string" }, help: { type: "boolean", short: "h" } } });
if (o.help || !o.strategy) {
  console.log("usage: run-eval.mjs --strategy NAME [--set base] [--opt k=v]... [--model M] [--judge-model M] [--concurrency 6] [--limit N] [--category C]... [--tag T]");
  process.exit(o.help ? 0 : 1);
}

const strategy = await loadStrategy(o.strategy);
const options = { ...(strategy.defaultOptions ?? {}), ...parseOpts(o.opt) };
const model = o.model ?? DEFAULT_MODEL, judgeModel = o["judge-model"] ?? DEFAULT_JUDGE_MODEL;
const llm = makeLLM(model, { provider: o.provider, cache: o.cache });
const judge = makeJudge(makeLLM(judgeModel, { provider: o.provider, cache: o.cache }));
let items = loadSet(o.set);
if (o.category) items = items.filter((it) => o.category.some((c) => it.category === c || it.category.startsWith(c + "/")));
if (o.limit) items = items.slice(0, Number(o.limit));

const setName = o.set.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
const outDir = o.out ?? join(ROOT, "results", strategy.name + (o.tag ? `@${o.tag}` : ""), setName);
mkdirSync(outDir, { recursive: true });
const itemsFile = join(outDir, "items.jsonl");
const done = new Map();
if (existsSync(itemsFile)) for (const l of readFileSync(itemsFile, "utf8").split("\n")) if (l.trim()) { const r = JSON.parse(l); done.set(r.id, r); }

let next = 0, finished = 0;
const todo = items.filter((it) => !done.has(it.id));
console.error(`${strategy.name} on ${setName}: ${items.length} test cases (${todo.length} to run), options ${JSON.stringify(options)}, model ${model}, judge ${judgeModel}`);
await Promise.all(Array.from({ length: Math.max(1, Number(o.concurrency)) }, async () => {
  while (next < todo.length) {
    const it = todo[next++];
    const r = await formalizeToCNL(strategy, it.text, { llm, options });
    const verdict = await judge(it.text, r.cnl);
    const rec = { id: it.id, category: it.category, text: it.text, formalization: r.formalization, cnl: r.cnl,
      ok: r.ok, errors: r.errors, extra: r.extra, seconds: r.seconds, verdict };
    appendFileSync(itemsFile, JSON.stringify(rec) + "\n");
    done.set(it.id, rec);
    console.error(`[${++finished}/${todo.length}] ${verdict.label.padEnd(10)} ${it.id} :: ${r.cnl ?? r.errors[0]}`);
  }
}));

// ------------------------------------------------------------------ report
const results = items.map((it) => done.get(it.id)).filter(Boolean);
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "–");
function stats(rs) {
  const n = rs.length, c = (f) => rs.filter(f).length;
  return { n, valid: c((r) => r.ok), equivalent: c((r) => r.verdict.label === "equivalent"), minor: c((r) => r.verdict.label === "minor"),
    major: c((r) => r.verdict.label === "major") };
}
const total = stats(results);
const cats = [...new Set(results.map((r) => r.category))].sort();
const byCat = Object.fromEntries(cats.map((c) => [c, stats(results.filter((r) => r.category === c))]));
const row = (name, s) => `| ${name} | ${s.n} | ${pct(s.valid, s.n)} | ${pct(s.equivalent, s.n)} | ${pct(s.equivalent + s.minor, s.n)} | ${pct(s.major, s.n)} |`;
const md = [
  `# ${strategy.name}${o.tag ? ` @${o.tag}` : ""} on eval/${setName}`, "",
  `Test cases: **${total.n}** in ${cats.length} categories. Strategy LLM: ${model}; options: \`${JSON.stringify(options)}\`; judge: ${judgeModel}.`,
  "Percentages are of test cases. \"Preserved\" = the judge found no loss of meaning (equivalent).", "",
  "| | test cases | valid formalisation | preserved (equivalent) | equivalent or minor nuance lost | major loss |",
  "|---|---|---|---|---|---|", row("**all**", total), ...cats.map((c) => row(c, byCat[c])), "",
  "## Major losses", "",
  ...results.filter((r) => r.verdict.label === "major").map((r) => `- \`${r.id}\` — ${r.text}\n  - CNL: ${r.cnl ?? "(none: " + r.errors[0] + ")"}\n  - ${r.verdict.reason}`),
].join("\n");
writeFileSync(join(outDir, "report.md"), md + "\n");
writeFileSync(join(outDir, "report.json"), JSON.stringify({ strategy: strategy.name, tag: o.tag ?? null, set: setName, model, judgeModel, options, total, byCategory: byCat }, null, 2));
console.log(md.split("\n## Major losses")[0]);
console.error(`\nwritten: ${join(outDir, "report.md")}`);
