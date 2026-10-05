import {atomKey, normalizeIR, ruleKey} from "./ir.mjs";
import {queryStatus} from "./reasoner.mjs";
import {renderCNL} from "./cnl.mjs";
import {buildProtoIR} from "./protoir.mjs";
import {judgeRepeated} from "./judge.mjs";
import {mean} from "./util.mjs";

function prf(predicted, gold) {
  const p = new Set(predicted), g = new Set(gold);
  let tp = 0;
  for (const x of p) if (g.has(x)) tp += 1;
  const precision = p.size ? tp / p.size : (g.size ? 0 : 1);
  const recall = g.size ? tp / g.size : (p.size ? 0 : 1);
  const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
  return {tp, predicted: p.size, gold: g.size, precision, recall, f1};
}

export function structuralMetrics(predicted, gold) {
  const p = normalizeIR(predicted), g = normalizeIR(gold);
  return {
    facts: prf(p.facts.map(atomKey), g.facts.map(atomKey)),
    rules: prf(p.rules.map(ruleKey), g.rules.map(ruleKey))
  };
}

export function behaviorMetrics(ir, tests = []) {
  const rows = tests.map((t) => {
    const actual = queryStatus(ir, t.query);
    return {...t, actual, pass: actual === t.expected};
  });
  const byKind = {};
  for (const kind of new Set(rows.map((r) => r.kind ?? "all"))) {
    const subset = rows.filter((r) => (r.kind ?? "all") === kind);
    byKind[kind] = {count: subset.length, accuracy: mean(subset.map((r) => r.pass ? 1 : 0))};
  }
  return {count: rows.length, accuracy: mean(rows.map((r) => r.pass ? 1 : 0)), byKind, rows};
}

export function reuseMetrics(draft, finalIR) {
  const d = normalizeIR(draft), f = normalizeIR(finalIR);
  const dk = new Set([...d.facts.map(atomKey), ...d.rules.map(ruleKey)]);
  const fk = new Set([...f.facts.map(atomKey), ...f.rules.map(ruleKey)]);
  let retained = 0;
  for (const x of fk) if (dk.has(x)) retained += 1;
  return {
    draftItems: dk.size,
    finalItems: fk.size,
    retained,
    deleted: [...dk].filter((x) => !fk.has(x)).length,
    added: [...fk].filter((x) => !dk.has(x)).length,
    finalReuse: fk.size ? retained / fk.size : 1,
    draftRetention: dk.size ? retained / dk.size : 1
  };
}

export async function evaluateCase({strategy, sample, judgeClient = null, judgeRuns = 1}) {
  const protoStarted = performance.now();
  const proto = buildProtoIR(sample.text);
  const protoLatencyMs = performance.now() - protoStarted;
  const started = performance.now();
  const result = await strategy.formalize(sample.text, {proto});
  const formalizationLatencyMs = performance.now() - started;
  const cnl = renderCNL(result.ir);
  const out = {
    id: sample.id,
    category: sample.category,
    strategy: strategy.name,
    text: sample.text,
    protoLatencyMs,
    formalizationLatencyMs,
    totalPipelineLatencyMs: protoLatencyMs + formalizationLatencyMs,
    modelUsage: result.artifacts?.llm?.usage ?? null,
    ir: result.ir,
    cnl,
    behavior: behaviorMetrics(result.ir, sample.tests ?? []),
    structural: sample.gold_ir ? structuralMetrics(result.ir, sample.gold_ir) : null,
    reuse: result.artifacts?.draft && result.artifacts.draft !== result.ir ? reuseMetrics(result.artifacts.draft, result.ir) : null
  };
  if (judgeClient) out.judge = await judgeRepeated({client: judgeClient, nl: sample.text, cnl, runs: judgeRuns});
  return out;
}

export function aggregateEvaluation(rows) {
  const semanticRows = rows.flatMap((r) => r.behavior.rows.filter((x) => (x.kind ?? "semantic") === "semantic"));
  const controlRows = rows.flatMap((r) => r.behavior.rows.filter((x) => x.kind === "control"));
  const allRows = rows.flatMap((r) => r.behavior.rows);
  const structuralFacts = rows.filter((r) => r.structural).map((r) => r.structural.facts.f1);
  const structuralRules = rows.filter((r) => r.structural).map((r) => r.structural.rules.f1);
  const judgeRows = rows.filter((r) => r.judge);
  const reuseRows = rows.filter((r) => r.reuse);
  const usageRows = rows.filter((r) => r.modelUsage);
  const sumUsage = (key) => usageRows.reduce((acc, r) => acc + Number(r.modelUsage?.[key] ?? 0), 0);
  return {
    cases: rows.length,
    tests: allRows.length,
    behaviorAccuracy: mean(allRows.map((x) => x.pass ? 1 : 0)),
    semanticAccuracy: semanticRows.length ? mean(semanticRows.map((x) => x.pass ? 1 : 0)) : null,
    controlAccuracy: controlRows.length ? mean(controlRows.map((x) => x.pass ? 1 : 0)) : null,
    meanFactF1: structuralFacts.length ? mean(structuralFacts) : null,
    meanRuleF1: structuralRules.length ? mean(structuralRules) : null,
    meanJudgeSemanticF1: judgeRows.length ? mean(judgeRows.map((r) => r.judge.semanticF1)) : null,
    meanJudgeCoverage: judgeRows.length ? mean(judgeRows.map((r) => r.judge.coverage)) : null,
    meanJudgeFaithfulness: judgeRows.length ? mean(judgeRows.map((r) => r.judge.faithfulness)) : null,
    meanFinalReuse: reuseRows.length ? mean(reuseRows.map((r) => r.reuse.finalReuse)) : null,
    meanProtoLatencyMs: mean(rows.map((r) => r.protoLatencyMs)),
    meanFormalizationLatencyMs: mean(rows.map((r) => r.formalizationLatencyMs)),
    meanTotalPipelineLatencyMs: mean(rows.map((r) => r.totalPipelineLatencyMs)),
    promptTokens: usageRows.length ? sumUsage("prompt_tokens") : null,
    completionTokens: usageRows.length ? sumUsage("completion_tokens") : null,
    totalTokens: usageRows.length ? sumUsage("total_tokens") : null
  };
}

export async function evaluateDataset({strategy, dataset, judgeClient = null, judgeRuns = 1, onCase = null}) {
  const rows = [];
  for (const sample of dataset) {
    const row = await evaluateCase({strategy, sample, judgeClient, judgeRuns});
    rows.push(row);
    if (onCase) await onCase(row);
  }
  return {summary: aggregateEvaluation(rows), rows};
}
