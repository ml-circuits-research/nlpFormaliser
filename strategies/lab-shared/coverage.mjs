import {normalizeIR} from './src/ir.mjs';

// Describe backend support without deleting represented information. The native
// compiler renders every IR section; its Horn reasoner has a narrower semantics.
export function reasoningCoverage(input) {
  const ir=normalizeIR(input),unhandled=[];
  for(const key of ['contexts','ambiguities','externals']) if(ir[key].length)unhandled.push({section:key,count:ir[key].length,reason:'retained symbolically; native Horn reasoner has no operational semantics'});
  for(const [i,a] of ir.facts.entries()) {
    if(a.context)unhandled.push({section:`facts[${i}].context`,reason:'context must not be asserted globally'});
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
  }
  return {issues,complete:issues.length===0,note:'Templates and labels are preserved; passing this check does not prove lexical equivalence.'};
}
