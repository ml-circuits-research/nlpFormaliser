import {clamp01, extractJsonObject, mean, median, stddev} from "./util.mjs";

export const JUDGE_SYSTEM = `
You are evaluating semantic fidelity between an original natural-language text and a Controlled Natural Language (CNL) rendering produced from a formal program.
Judge meaning, not style or wording. Be strict about entities, relations, argument roles, negation, quantifier scope, modality, temporality, coreference, conditions, alternatives, and instructions/questions.
Score two directions separately:
- coverage: how much meaning from NL is preserved in CNL.
- faithfulness: how much meaning asserted by CNL is supported by NL (anti-hallucination).
Also score scope, coreference, and temporal_modality. If a dimension is not present in the NL, score it 1.0.
Return JSON only with this schema:
{
  "coverage": 0..1,
  "faithfulness": 0..1,
  "scope": 0..1,
  "coreference": 0..1,
  "temporal_modality": 0..1,
  "verdict": "equivalent"|"minor_loss"|"major_loss"|"contradiction",
  "omissions": [string],
  "unsupported": [string],
  "scope_errors": [string],
  "explanation": string
}
Do not infer facts that are merely plausible. Do not reward a more detailed CNL when those details are unsupported.
`;

export function normalizeJudgeResult(raw) {
  const x = typeof raw === "string" ? extractJsonObject(raw) : raw;
  const coverage = clamp01(x.coverage);
  const faithfulness = clamp01(x.faithfulness);
  const semanticF1 = coverage + faithfulness ? 2 * coverage * faithfulness / (coverage + faithfulness) : 0;
  return {
    coverage,
    faithfulness,
    semanticF1,
    scope: clamp01(x.scope ?? 1),
    coreference: clamp01(x.coreference ?? 1),
    temporal_modality: clamp01(x.temporal_modality ?? 1),
    verdict: x.verdict ?? "major_loss",
    omissions: Array.isArray(x.omissions) ? x.omissions : [],
    unsupported: Array.isArray(x.unsupported) ? x.unsupported : [],
    scope_errors: Array.isArray(x.scope_errors) ? x.scope_errors : [],
    explanation: String(x.explanation ?? "")
  };
}

export async function judgeOnce({client, nl, cnl}) {
  const raw = await client.complete({
    system: JUDGE_SYSTEM,
    user: `ORIGINAL NL:\n${nl}\n\nGENERATED CNL:\n${cnl}`
  });
  return normalizeJudgeResult(raw);
}

export async function judgeRepeated({client, nl, cnl, runs = 1}) {
  const judgments = [];
  for (let i = 0; i < runs; i += 1) judgments.push(await judgeOnce({client, nl, cnl}));
  const fields = ["coverage", "faithfulness", "semanticF1", "scope", "coreference", "temporal_modality"];
  const aggregate = {};
  for (const f of fields) {
    const xs = judgments.map((j) => j[f]);
    aggregate[f] = mean(xs);
    aggregate[`${f}_median`] = median(xs);
    aggregate[`${f}_stddev`] = stddev(xs);
  }
  aggregate.runs = judgments;
  return aggregate;
}
