// EVL formalisation with the strategy's own self-repair loop:
//   LLM formalises → checker → deterministic CNL → the strategy's INTERNAL judge → LLM repairs (max `rounds`).
// The internal judge only steers the repair; the evaluation tools use their own, independent judge.
import { readFileSync } from "node:fs";
import { check } from "./check.mjs";
import { englishFromFacts } from "./english.mjs";
import { extractBlock, extractJson } from "./util.mjs";

const P = JSON.parse(readFileSync(new URL("../spec/prompts.json", import.meta.url), "utf8"));
export const SPEC = readFileSync(new URL("../spec/evl-spec.md", import.meta.url), "utf8");
export const PROMPTS = {
  formalizeSystem: P.formalize_head + SPEC + P.formalize_tail,
  refineTemplate: P.refine_template,
  internalJudgeSystem: P.judge_system,
};

function feedback(errors, realization, differences) {
  const parts = [];
  if (errors?.length) parts.push("VALIDATION ERRORS (the formalisation is rejected by the checker):\n- " + errors.slice(0, 15).join("\n- "));
  if (realization != null) parts.push(`WHAT YOUR FORMALISATION SAYS WHEN EXECUTED BACK INTO ENGLISH (deterministic interpreter):\n${realization}`);
  if (differences?.length) parts.push("MEANING DIFFERENCES FOUND BY THE JUDGE (original vs execution):\n- " + differences.join("\n- "));
  return parts.join("\n\n") + "\n";
}

/** Checker errors that make a formalisation unusable (including unknown predicates, which would be ignored). */
export function blockingErrors(code) {
  const r = check(code);
  return { r, errors: [...r.errors, ...r.warnings.filter((w) => w.includes("unknown predicate"))] };
}

export async function formalizeOnce(text, llm) {
  return extractBlock(await llm(PROMPTS.formalizeSystem, `Formalise this text:\n\n${text}`));
}

export async function refine(text, code, { errors = [], realization = null, differences = [] }, llm) {
  const body = PROMPTS.refineTemplate.replaceAll("{text}", text).replaceAll("{code}", code).replaceAll("{lang}", "prolog")
    .replace("{feedback}", feedback(errors, realization, differences));
  return extractBlock(await llm(PROMPTS.formalizeSystem, body));
}

export async function internalJudge(original, cnl, llm) {
  try {
    const d = extractJson(await llm(PROMPTS.internalJudgeSystem, `Text A (original):\n${original}\n\nText B (reconstruction):\n${cnl}`));
    return { equivalent: Boolean(d.equivalent), differences: d.differences ?? [] };
  } catch (e) { return { equivalent: false, differences: [`judge error: ${e.message}`] }; }
}

/** formalise + self-repair loop → { formalization, cnl, converged, rounds, trace } */
export async function formalizeWithLoop(text, { llm, rounds = 4, log } = {}) {
  if (!llm) throw new Error("the evl strategy needs an llm: async (system, prompt) => text");
  const trace = [];
  let code = await formalizeOnce(text, llm);
  for (let round = 0; round <= rounds; round++) {
    const { r, errors } = blockingErrors(code);
    let cnl = null, verdict = null;
    if (!errors.length) {
      try { cnl = englishFromFacts(r.facts); } catch (e) { errors.push(`interpreter crashed: ${e.message}`); }
    }
    if (cnl != null && rounds > 0) verdict = await internalJudge(text, cnl, llm);
    const step = { round, code, errors, cnl, verdict };
    trace.push(step);
    log?.(step);
    if (cnl != null && (rounds === 0 || verdict?.equivalent)) break;
    if (round === rounds) break;
    code = await refine(text, code, { errors, realization: cnl, differences: verdict?.differences }, llm);
  }
  const valid = trace.filter((s) => s.cnl != null);
  const last = valid.at(-1) ?? trace.at(-1);
  return { formalization: last.code, cnl: last.cnl, converged: Boolean(trace.at(-1).verdict?.equivalent), rounds: trace.length - 1, trace };
}
