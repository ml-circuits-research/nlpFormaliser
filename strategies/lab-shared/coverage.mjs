import {normalizeIR} from './src/ir.mjs';
import {MAX_SYMBOL_WORDS,templateWords,symbolViolations} from '../../tools/lib/symbols.mjs';

// Describe backend support without deleting represented information. The native
// compiler renders every IR section; its Horn reasoner has a narrower semantics.
export function reasoningCoverage(input) {
  const ir=normalizeIR(input),unhandled=[];
  for(const key of ['contexts','ambiguities','externals']) if(ir[key].length)unhandled.push({section:key,count:ir[key].length,reason:'retained symbolically; native Horn reasoner has no operational semantics'});
  for(const [i,a] of ir.facts.entries()) {
    if(a.context)unhandled.push({section:`facts[${i}].context`,reason:'contextual fact is kept in its own partition; the Horn engine has no modal semantics for it'});
    if(a.args.some(x=>typeof x==='string'&&x.startsWith('?')))unhandled.push({section:`facts[${i}]`,reason:'non-ground fact'});
  }
  for(const [i,r] of ir.rules.entries())if([r.head,...r.body].some(a=>a.context))unhandled.push({section:`rules[${i}]`,reason:'scoped rule cannot be evaluated by the flat Horn engine'});
  for(const [i,q] of ir.queries.entries()) {
    if(!Array.isArray(q.where)||!Array.isArray(q.vars))unhandled.push({section:`queries[${i}]`,reason:'query schema not understood'});
  }
  return {complete:unhandled.length===0,unhandled,scope:'Native Horn subset only; completeness is backend coverage, not NL equivalence'};
}
export function metadataAudit(input) {
  const ir=normalizeIR(input),issues=[];
  for(const [pred,meta] of Object.entries(ir.symbols.predicates??{}))if(meta.cnl){
    const arities=[...new Set([...ir.facts,...ir.rules.flatMap(r=>[r.head,...r.body]),...ir.queries.flatMap(q=>q.where??[])].filter(a=>a.pred===pred).map(a=>a.args.length))];
    const slots=[...String(meta.cnl).matchAll(/\{(\d+)\}/g)].map(m=>Number(m[1]));
    for(const arity of arities)if(slots.some(x=>x>=arity)||Array.from({length:arity},(_,i)=>i).some(i=>!slots.includes(i)))issues.push({predicate:pred,arity,reason:'CNL template omits an argument or refers to a nonexistent argument'});
    if(templateWords(meta.cnl).length>MAX_SYMBOL_WORDS)issues.push({predicate:pred,reason:`CNL template has more than ${MAX_SYMBOL_WORDS} words besides its slots; the renderer ignores it`});
  }
  return {issues,complete:issues.length===0,note:'Templates and labels stay in the IR, but only short ones shape the judged CNL; passing this check does not prove lexical equivalence.'};
}

// Every symbol the lab IR exposes to rendering or reasoning. Explanatory notes
// (gloss/description/meta) are deliberately excluded: they are never rendered.
export function labSymbols(input) {
  const ir=normalizeIR(input),out=[];
  const add=(path,name,kind='symbol')=>{if(typeof name==='string'&&name!=='')out.push({path,name,kind});};
  const atom=(a,path)=>{
    add(`${path}.pred`,a.pred);
    a.args.forEach((x,i)=>add(`${path}.args[${i}]`,x));
    if(a.context!==undefined)add(`${path}.context`,a.context);
  };
  ir.facts.forEach((a,i)=>atom(a,`facts[${i}]`));
  ir.rules.forEach((r,i)=>{atom(r.head,`rules[${i}].head`);r.body.forEach((a,j)=>atom(a,`rules[${i}].body[${j}]`));});
  ir.queries.forEach((q,i)=>{
    (Array.isArray(q?.vars)?q.vars:[]).forEach((v,j)=>add(`queries[${i}].vars[${j}]`,v));
    (Array.isArray(q?.where)?q.where:[]).forEach((a,j)=>{if(a&&Array.isArray(a.args))atom({...a,pred:String(a.pred??'')},`queries[${i}].where[${j}]`);});
  });
  ir.contexts.forEach((c,i)=>{for(const k of ['id','kind','holder','parent'])add(`contexts[${i}].${k}`,c?.[k],k==='holder'?'proper':'symbol');});
  ir.ambiguities.forEach((a,i)=>{
    add(`ambiguities[${i}].id`,a?.id);add(`ambiguities[${i}].kind`,a?.kind);
    (Array.isArray(a?.options)?a.options:[]).forEach((o,j)=>add(`ambiguities[${i}].options[${j}]`,o));
  });
  ir.externals.forEach((e,i)=>{add(`externals[${i}].predicate`,e?.predicate);(Array.isArray(e?.roles)?e.roles:[]).forEach((r,j)=>add(`externals[${i}].roles[${j}]`,r));});
  for(const [k,v] of Object.entries(ir.symbols?.entities??{})){add(`symbols.entities.${k}`,k);add(`symbols.entities.${k}.label`,v?.label,'proper');}
  for(const [k,v] of Object.entries(ir.symbols?.predicates??{})){
    add(`symbols.predicates.${k}`,k);add(`symbols.predicates.${k}.label`,v?.label);
    add(`symbols.predicates.${k}.cnl`,v?.cnl,'template');
  }
  return out;
}
export const labSymbolViolations=ir=>symbolViolations(labSymbols(ir));
