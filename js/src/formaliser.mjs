// The round-trip formaliser: every step is a separate method; `roundtrip` chains them.
//
//   text ──formalize──▶ EVL code ──check──▶ (errors? → refine)
//                          │
//                      verbalize (deterministic)
//                          ▼
//                  reconstructed English ──judge(text, back)──▶ equivalent? done : refine
import { readFileSync } from "node:fs";
import { check } from "./check.mjs";
import { englishFromFacts, folFromFacts } from "./english.mjs";
import { defaultLLM, extractBlock, extractJson } from "./llm.mjs";
import { answerFacts } from "./qa.mjs";

const P = JSON.parse(readFileSync(new URL("../spec/prompts.json", import.meta.url), "utf8"));
export const SPEC = readFileSync(new URL("../spec/evl-spec.md", import.meta.url), "utf8");
export const PROMPTS = {
  formalizeSystem: P.formalize_head + SPEC + P.formalize_tail,
  refineTemplate: P.refine_template,
  judgeSystem: P.judge_system,
  evalJudgeSystem: P.eval_judge_system,
  qaJudgeSystem: P.qa_judge_system,
};

const ctxNote = (ctxCode) => "FORMALISED CONTEXT the question is about (reuse its concept lemmas, verbs, roles and names " +
  "exactly; do NOT copy its facts; use fresh ids for the question):\n```prolog\n" + ctxCode + "\n```\n\n";

function feedback(errors, realization, differences) {
  const parts = [];
  if (errors?.length) parts.push("VALIDATION ERRORS (the formalisation is rejected by the checker):\n- " + errors.slice(0, 15).join("\n- "));
  if (realization != null) parts.push(`WHAT YOUR FORMALISATION SAYS WHEN EXECUTED BACK INTO ENGLISH (deterministic interpreter):\n${realization}`);
  if (differences?.length) parts.push("MEANING DIFFERENCES FOUND BY THE JUDGE (original vs execution):\n- " + differences.join("\n- "));
  return parts.join("\n\n") + "\n";
}

// ------------------------------------------------------------------ deterministic API (no LLM)
/** Parse + validate EVL code → {ok, facts, errors, warnings} */
export { check };
/** EVL code → English (deterministic) */
export function verbalize(code) { return englishFromFacts(check(code).facts); }
/** EVL code → first-order logic */
export function fol(code) { return folFromFacts(check(code).facts); }
/** Execute an EVL question against EVL context facts → {answer, mode, support, goal} */
export function ask(contextCode, questionCode) {
  const c = check(contextCode), q = check(questionCode);
  if (!c.ok || !q.ok) return { answer: "error", detail: [...c.errors, ...q.errors].slice(0, 3) };
  return answerFacts(c.facts, q.facts);
}

// ------------------------------------------------------------------ LLM-driven steps
export class Formaliser {
  /**
   * @param {object} [o]
   * @param {(system:string, prompt:string)=>Promise<string>} [o.llm]   LLM for formalise/refine (default: Haiku)
   * @param {(system:string, prompt:string)=>Promise<string>} [o.judgeLLM]  LLM for the equivalence judge (default: o.llm)
   */
  constructor({ llm, judgeLLM } = {}) {
    this.llm = llm ?? defaultLLM();
    this.judgeLLM = judgeLLM ?? this.llm;
  }

  check(code) { return check(code); }
  verbalize(code) { return verbalize(code); }
  fol(code) { return fol(code); }
  ask(contextCode, questionCode) { return ask(contextCode, questionCode); }
  prompts({ context } = {}) { return { ...PROMPTS, spec: SPEC, ...(context ? { questionContextNote: ctxNote(context) } : {}) }; }

  /** One-shot formalisation. Pass `context` (EVL code) when formalising a question about that context. */
  async formalize(text, { context } = {}) {
    const prompt = context ? `${ctxNote(context)}Formalise this question:\n\n${text}` : `Formalise this text:\n\n${text}`;
    return extractBlock(await this.llm(PROMPTS.formalizeSystem, prompt));
  }

  /** Repair a formalisation given checker errors and/or judge feedback. */
  async refine(text, code, { errors = [], realization = null, differences = [], context } = {}) {
    const body = PROMPTS.refineTemplate.replaceAll("{text}", text).replaceAll("{code}", code).replaceAll("{lang}", "prolog")
      .replace("{feedback}", feedback(errors, realization, differences));
    return extractBlock(await this.llm(PROMPTS.formalizeSystem, (context ? ctxNote(context) : "") + body));
  }

  /** Meaning-equivalence verdict → {equivalent, differences} */
  async judge(original, candidate) {
    try {
      const d = extractJson(await this.judgeLLM(PROMPTS.judgeSystem, `Text A (original):\n${original}\n\nText B (reconstruction):\n${candidate}`));
      return { equivalent: Boolean(d.equivalent), differences: d.differences ?? [] };
    } catch (e) { return { equivalent: false, differences: [`judge error: ${e.message}`] }; }
  }

  /**
   * The full loop. Returns {converged, rounds, code, realization, firstRealization, trace}.
   * onStep({round, code, errors, realization, verdict}) is called after every round.
   */
  async roundtrip(text, { rounds = 4, context, onStep } = {}) {
    const trace = [];
    let code = await this.formalize(text, { context });
    for (let round = 0; round <= rounds; round++) {
      const chk = check(code);
      let errors = [...chk.errors, ...chk.warnings.filter((w) => w.includes("unknown predicate"))];
      let realization = null, verdict = null;
      if (!errors.length) {
        try { realization = englishFromFacts(chk.facts); } catch (e) { errors = [`interpreter crashed: ${e.message}`]; }
      }
      if (realization != null) verdict = await this.judge(text, realization);
      const step = { round, code, errors, realization, verdict };
      trace.push(step);
      onStep?.(step);
      if (verdict?.equivalent || round === rounds) break;
      code = await this.refine(text, code, { errors, realization, differences: verdict?.differences, context });
    }
    const valid = trace.filter((s) => s.realization != null);
    const last = valid.at(-1) ?? trace.at(-1);
    return {
      text, converged: Boolean(trace.at(-1).verdict?.equivalent), rounds: trace.length - 1,
      code: last.code, realization: last.realization ?? null, firstRealization: valid[0]?.realization ?? null, trace,
    };
  }

  /** Formalise a context and a question about it, then execute the question. */
  async answer(contextText, question, { rounds = 4 } = {}) {
    const c = await this.roundtrip(contextText, { rounds });
    const q = await this.roundtrip(question, { rounds, context: c.code });
    const a = ask(c.code, q.code);
    return { ...a, context: c, question: q };
  }
}
