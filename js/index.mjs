// nlpformaliser — round-trip formalisation of English into EVL (Prolog-style event logic). Pure JavaScript.
//
// Deterministic (no LLM):  check, verbalize, fol, ask, parseProgram
// LLM steps + loop:        new Formaliser({ llm }).formalize / refine / judge / roundtrip / answer
export { Formaliser, ask, check, fol, verbalize, PROMPTS, SPEC } from "./src/formaliser.mjs";
export { parseProgram, termToString, Compound } from "./src/terms.mjs";
export { anthropicLLM, claudeCliLLM, defaultLLM, cachedLLM, extractBlock, extractJson, HAIKU, SONNET } from "./src/llm.mjs";
