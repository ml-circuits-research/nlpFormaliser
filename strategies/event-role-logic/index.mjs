// Strategy "evl": English → EVL (Prolog-style neo-Davidsonian event facts) → deterministic CNL.
//
// Contract (see ../README.md):
//   formalize(text, ctx) → { formalization, ...extra }   ctx = { llm, options, log }
//   toCNL(formalization) → string                         deterministic, no LLM
//   check(formalization) → { ok, errors }                 optional
import { check } from "./src/check.mjs";
import { englishFromFacts } from "./src/english.mjs";
import { folFromFacts } from "./src/fol.mjs";
import { blockingErrors, formalizeWithLoop, SPEC } from "./src/loop.mjs";
import { answerFacts } from "./src/qa.mjs";
import { evlSymbols } from "./src/symbols.mjs";

export default {
  name: "evl",
  title: "EVL — event logic in Prolog-style facts",
  description: "An LLM writes ground Prolog facts with ~25 structural primitives (event/role/inst/quant/neg/modal/tense/" +
    "link/act/wh/generic/scope/...) plus open lexical predicates; a checker validates them; a rule-based interpreter " +
    "executes them into English CNL. The LLM repairs the facts using checker errors and its own judge (options.rounds).",
  deterministicCNL: true,
  usesLLM: true,
  defaultOptions: { rounds: 0 },

  async formalize(text, { llm, options = {}, log } = {}) {
    const rounds = Number(options.rounds ?? 0);
    const r = await formalizeWithLoop(text, { llm, rounds, log });
    return { formalization: r.formalization, internal: { converged: r.converged, rounds: r.rounds } };
  },

  toCNL(formalization) {
    return englishFromFacts(check(formalization).facts);
  },

  check(formalization) {
    const { errors } = blockingErrors(formalization);
    return { ok: errors.length === 0, errors };
  },
  symbols: evlSymbols,
  toReasoning(formalization) {
    return {format:'evl-prolog-facts/1',code:formalization,fol:folFromFacts(check(formalization).facts),semantics:'Reified EVL facts; requires the EVL interpreter, not arbitrary direct Horn entailment.'};
  },
};

// Extras specific to this strategy (not part of the contract)
export { check, SPEC };
export const fol = (code) => folFromFacts(check(code).facts);
/** Execute an EVL question against EVL context facts (question answering — a separate topic). */
export function ask(contextCode, questionCode) {
  const c = check(contextCode), q = check(questionCode);
  if (!c.ok || !q.ok) return { answer: "error", detail: [...c.errors, ...q.errors].slice(0, 3) };
  return answerFacts(c.facts, q.facts);
}
