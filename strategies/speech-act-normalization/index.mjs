import {buildFormalizationPrompt, validateCNL, canonicalizeCNL} from './src/cnl-core.mjs';
export default {
  name: 'cnl-core', usesLLM: true, controlOnly: true,
  async formalize(text, {llm}) {
    return {formalization: await llm(buildFormalizationPrompt(''), text)};
  },
  check: code => {const r=validateCNL(code); return {ok:r.ok, errors:r.errors.map(e=>e.message)};},
  toCNL: canonicalizeCNL,
};
