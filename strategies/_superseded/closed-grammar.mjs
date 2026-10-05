import microir from '../compact-scope-logic/index.mjs';
const quote=JSON.stringify;
const name='([A-Z][a-z]+)', noun='([a-z]+)';
// Closed, fully anchored grammar. A match consumes every semantic token. No
// guessed coreference, partial-clause acceptance or source-text fallback node.
export function deterministic(text) {
  const s=text.trim().replace(/\.$/,'');let m;
  if((m=new RegExp(`^${name} is (not )?(?:a|an) ${noun}$`).exec(s))) {
    if(['Who','What','Someone','Something','That','This','It'].includes(m[1]))return null;
    const p=`$.${m[3]}(${quote(m[1])})`;return m[2]?`N(${p})`:p;
  }
  if((m=/^(Every|No) ([a-z]+) is (?:a|an) ([a-z]+)$/.exec(s))) {
    const conclusion=`$.${m[3]}(x)`;
    return `U(x,I($.${m[2]}(x),${m[1]==='No'?`N(${conclusion})`:conclusion}))`;
  }
  if((m=new RegExp(`^Is ${name} (?:a|an) ${noun}\\?$`).exec(s)))return `Q($.${m[2]}(${quote(m[1])}))`;
  return null;
}
export default {
  ...microir,name:'microir-hybrid',
  async formalize(text,ctx) {
    const code=deterministic(text);
    if(code)return {formalization:code,route:'deterministic',formalizerTasks:0};
    return {...await microir.formalize(text,ctx),route:'llm',formalizerTasks:1};
  },
};
