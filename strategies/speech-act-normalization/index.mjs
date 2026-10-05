import {buildFormalizationPrompt, validateCNL, canonicalizeCNL} from './src/cnl-core.mjs';

// Placeholders and labels must stay short like every other symbol.
export const SYMBOL_RULE = 'Placeholders and labels you introduce (such as PERSON_1 or OBJECT_1) have at most 3 words; split by underscores, hyphens, digits and camelCase, so OBJECT_1 is fine but LAST_IMPORTANT_EMAIL_1 or lastImportantEmail1 is not. Never compress a clause into one label; decompose it into a plain controlled sentence instead.';
export const SYSTEM = buildFormalizationPrompt(null, {includeInput: false, extraRules: [SYMBOL_RULE]});

export default {
  name: 'cnl-core', usesLLM: true, controlOnly: true,
  async formalize(text, {llm}) {
    return {formalization: await llm(SYSTEM, text)};
  },
  // Only introduced placeholders are symbols; the lines themselves are controlled English.
  symbols: code => [...String(code ?? '').matchAll(/\b[A-Za-z]+(?:_[A-Za-z0-9]+)+\b/g)].map(m => ({path: 'placeholder', name: m[0], kind: 'symbol'})),
  check: code => {const r=validateCNL(code); return {ok:r.ok, errors:r.errors.map(e=>e.message)};},
  toCNL: canonicalizeCNL,
};
