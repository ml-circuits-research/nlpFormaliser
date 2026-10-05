import {toLogic} from '../../strategies/compact-scope-logic/index.mjs';
import {validateIR} from '../../strategies/lab-shared/src/ir.mjs';
import {resolveStrategy} from './registry.mjs';

// A comparison projection, not an ontology alignment or universal reasoner.
// Native IR stays authoritative. Every node records its origin in that IR.
export function projectCommonCNL(strategyName, formalization) {
  const family = resolveStrategy(strategyName)?.family;
  const residuals = [];
  const node = (kind, source, fields = {}) => ({kind, source, ...fields});
  const residual = (source, value, reason) => residuals.push({source, value, reason});
  let statements = [];
  if (family === 'scoped-logic') {
    function convert(x, path) {
      if ('constant' in x) return node('constant', path, {value:x.constant});
      if ('var' in x) return node('variable', path, {name:x.var});
      if ('predicate' in x) return node('predicate', path, {name:x.predicate,args:x.args.map((a,i)=>convert(a,`${path}.args[${i}]`))});
      return node(x.op,path,{args:x.args.map((a,i)=>convert(a,`${path}.args[${i}]`))});
    }
    statements = toLogic(formalization).statements.map((x,i)=>convert(x,`statements[${i}]`));
  } else if (family === 'context-logic') {
    const check = validateIR(formalization);
    if (!check.ok) throw new Error(`Invalid native IR: ${check.errors.join('; ')}`);
    const ir = formalization;
    function atom(a,path) {
      // Native scoped annotations cannot safely become unscoped assertions.
      const extra = Object.keys(a).filter(k=>!['pred','args','neg'].includes(k));
      if (extra.length) throw new Error(`Unmapped atom fields: ${extra.join(', ')}`);
      const args = a.args.map((value,i)=>{
        if (typeof value === 'string' && value.startsWith('?')) return node('variable',`${path}.args[${i}]`,{name:value});
        if (value !== null && !['string','number','boolean'].includes(typeof value)) throw new Error('Structured native term requires an explicit adapter');
        return node('constant',`${path}.args[${i}]`,{value});
      });
      const pred = node('predicate',path,{name:a.pred,args});
      return a.neg ? node('not',path,{args:[pred]}) : pred;
    }
    function keep(value,path,convert) {
      try { const result=convert(); renderNode(result,new Set(),false); statements.push(result); }
      catch(error) {residual(path,value,error.message);}
    }
    for (const [i,fact] of (ir.facts??[]).entries()) keep(fact,`facts[${i}]`,()=>atom(fact,`facts[${i}]`));
    for (const [i,rule] of (ir.rules??[]).entries()) keep(rule,`rules[${i}]`,()=>{
      const path=`rules[${i}]`;
      if(Object.keys(rule).some(k=>!['head','body'].includes(k))) throw new Error('Unmapped rule annotations');
      const body=rule.body.map((a,j)=>atom(a,`${path}.body[${j}]`));
      let expr=node('implies',path,{args:[body.length===1?body[0]:node(body.length?'and':'true',`${path}.body`,{args:body}),atom(rule.head,`${path}.head`)]});
      const vars=[...new Set([rule.head,...rule.body].flatMap(a=>a.args).filter(v=>typeof v==='string'&&v.startsWith('?')))];
      for(const name of vars.reverse())expr=node('forall',path,{args:[node('variable',path,{name}),expr]});
      return expr;
    });
    // Queries, attribution and modal context need distinct typed extensions;
    // their glosses are never smuggled into ordinary predicate assertions.
    // version/meta/symbols are bookkeeping and lexical metadata: the common view
    // never renders labels, templates or glosses, so they are not semantic residue.
    // Empty sections (including nested empty objects) count as absent.
    const empty=v=>v==null||(Array.isArray(v)?v.length===0:typeof v==='object'&&Object.values(v).every(empty));
    for(const key of Object.keys(ir)) {
      if(['facts','rules','version','meta','symbols'].includes(key))continue;
      const value=ir[key];
      if(!empty(value))residual(key,value,'Native section retained; common semantic adapter not yet implemented');
    }
  } else {
    residual('$',formalization,'No common semantic adapter for this strategy family yet');
  }
  const document={schema:'common-cnl/1',strategy:strategyName,statements,residuals,
    coverage:{complete:residuals.length===0,projectedStatements:statements.length,residualSections:residuals.length}};
  document.cnl=renderCommonCNL(document);
  document.wholeDocumentJudgeEligible=document.coverage.complete&&statements.length>0;
  return document;
}

function renderNode(n,bound,term) {
  if(!n||typeof n.kind!=='string'||typeof n.source!=='string')throw new Error('Malformed common node');
  if(n.kind==='constant') {
    if(!term)throw new Error('Constant is not a proposition');
    if(n.value!==null&&!['string','number','boolean'].includes(typeof n.value))throw new Error('Invalid constant');
    return JSON.stringify(n.value);
  }
  if(n.kind==='variable') {
    if(!term||!bound.has(n.name))throw new Error(`Unbound variable ${n.name}`);
    return `variable ${JSON.stringify(n.name)}`;
  }
  if(term)return `the proposition (${renderNode(n,bound,false)})`;
  const args=n.args??[];
  const formula=a=>renderNode(a,bound,false);
  if(n.kind==='predicate') {
    if(typeof n.name!=='string'||!n.name)throw new Error('Missing predicate name');
    return `relation ${JSON.stringify(n.name)} holds with ordered arguments [${args.map(a=>renderNode(a,bound,true)).join('; ')}]`;
  }
  if(['forall','exists','which'].includes(n.kind)) {
    if(args.length!==2||args[0].kind!=='variable'||bound.has(args[0].name))throw new Error('Invalid or shadowed binder');
    const next=new Set(bound);next.add(args[0].name);
    const prefix={forall:'for every',exists:'there exists',which:'which'}[n.kind];
    return `${prefix} variable ${JSON.stringify(args[0].name)} such that (${renderNode(args[1],next,false)})`;
  }
  if(n.kind==='true'&&!args.length)return 'true';
  if(['and','or'].includes(n.kind)&&args.length>=2)return args.map(a=>`(${formula(a)})`).join(` ${n.kind} `);
  if(n.kind==='not'&&args.length===1)return `it is not the case that (${formula(args[0])})`;
  if(n.kind==='implies'&&args.length===2)return `if (${formula(args[0])}), then (${formula(args[1])})`;
  if(n.kind==='ask'&&args.length===1)return `is it the case that (${formula(args[0])})?`;
  throw new Error(`Invalid operator/arity: ${n.kind}`);
}

export function renderCommonCNL(document) {
  if(document.schema!=='common-cnl/1')throw new Error('Unknown comparison schema');
  return document.statements.map((s,i)=>`${['ask','which'].includes(s.kind)?'Question':'Statement'} ${i+1}: ${renderNode(s,new Set(),false)}`).join('\n');
}
