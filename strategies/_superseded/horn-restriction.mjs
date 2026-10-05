import {HeuristicStrategy} from '../lab-shared/src/strategies/heuristic.mjs';
import {DirectLLMStrategy} from '../lab-shared/src/strategies/direct-llm.mjs';
import {ProtoLLMStrategy} from '../lab-shared/src/strategies/proto-llm.mjs';
import {validateIR} from '../lab-shared/src/ir.mjs';
export const SUFFIX='\nUse facts, rules and queries only. Do not put clauses in symbols, glosses, entity names or predicate names.';

// The original renderer allowed arbitrary cnl templates and glosses. Only logic
// contributes here; metadata must never supply meaning absent from the program.
export function checkLogic(ir) {
  const r=validateIR(ir), errors=[...r.errors];
  for(const key of ['contexts','externals','ambiguities']) if(ir[key]?.length) errors.push(`Unsupported reasoning semantics: ${key}`);
  const atom=(a, ground=false)=>{
    if(!/^[a-z][a-z0-9_]*$/.test(a.pred)) errors.push('Invalid predicate');
    if(!a.args.length) errors.push('Nullary predicates are not accepted in this baseline');
    if(a.context) errors.push('Context-scoped atoms are not implemented');
    for(const x of a.args) {
      if(typeof x!=='string' && typeof x!=='number') errors.push('Only scalar terms are implemented');
      if(ground && typeof x==='string' && x.startsWith('?')) errors.push('Free variable in a fact');
    }
  };
  ir.facts.forEach(a=>atom(a,true));
  ir.rules.forEach(r=>{atom(r.head); r.body.forEach(a=>atom(a));});
  for(const q of ir.queries ?? []) {
    if(!Array.isArray(q.where) || !q.where.length) errors.push('Empty query');
    else {
      q.where.forEach(a=>atom(a));
      const used=new Set(q.where.flatMap(a=>a.args));
      if(!Array.isArray(q.vars)||q.vars.some(v=>typeof v!=='string'||!v.startsWith('?')||!used.has(v))) errors.push('Unbound query projection');
    }
  }
  if(!ir.facts.length && !ir.rules.length && !ir.queries?.length) errors.push('No logical content');
  return {ok:!errors.length,errors};
}
const word=x=>String(x).replaceAll('_',' ');
const atomCNL=a=>`${a.neg?'it is not the case that ':''}the predicate “${word(a.pred)}” holds with ordered arguments [${a.args.map(x=>String(x).startsWith('?')?x:JSON.stringify(word(x))).join('; ')}]`;
export function cnl(ir) {
  return [...ir.facts.map(a=>atomCNL(a)+'.'), ...ir.rules.map(r=>{
    const vars=[...new Set([r.head,...r.body].flatMap(a=>a.args).filter(x=>typeof x==='string' && x.startsWith('?')))];
    return `${vars.length?'For every '+vars.join(', ')+', ':''}if (${r.body.map(atomCNL).join(' and ') || 'true'}), then (${atomCNL(r.head)}).`;
  }), ...(ir.queries??[]).map(q=>`Question: find ${(q.vars??[]).join(', ')||'the truth value'} such that ${q.where.map(atomCNL).join(' and ')}.`)].join('\n');
}
export function prolog(ir) {
  const valid=checkLogic(ir); if(!valid.ok) throw new Error(valid.errors.join('; '));
  const vars=new Map();
  const quote=s=>"'"+String(s).replaceAll('\\','\\\\').replaceAll("'","''")+"'";
  const term=x=>typeof x==='number'?String(x):x.startsWith('?')?(vars.has(x)?vars.get(x):(vars.set(x,`V${vars.size}`),vars.get(x))):quote(x);
  const atom=a=>`${a.neg?'neg_':'pos_'}${a.pred}(${a.args.map(term).join(',')})`;
  return {format:'prolog-horn/1', code:[...ir.facts.map(a=>atom(a)+'.'), ...ir.rules.map(r=>{vars.clear();return atom(r.head)+(r.body.length?' :- '+r.body.map(atom).join(', '):'')+'.';})].join('\n'), queries:(ir.queries??[]).map(q=>{vars.clear();return q.where.map(atom).join(', ');}), semantics:'Open world; neg_ predicates are explicit negative facts, never negation-as-failure.'};
}
export function labStrategy(kind) {
  return {
    name:`lab-${kind}`, usesLLM:kind!=='heuristic', deterministicCNL:true,
    async formalize(text,{llm}={}) {
      const client={complete:({system,user})=>llm(system+SUFFIX,user)};
      const impl=kind==='heuristic'?new HeuristicStrategy():kind==='proto'?new ProtoLLMStrategy({client}):new DirectLLMStrategy({client});
      const {ir}=await impl.formalize(text);
      return {formalization:ir};
    },
    check:checkLogic, toCNL:cnl, toReasoning:prolog,
  };
}
