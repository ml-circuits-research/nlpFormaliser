import {symbolViolations,violationMessage,symbolWords} from './symbols.mjs';

// This is a conservative screening aid, not a proof of semantic completeness.
// Semantic preservation is judged separately and never rescues opaque content.
//
// Eligibility issues are reported in separate categories so the harness can show
// them separately from semantic equivalence:
//   symbolLength - a symbol/label/template longer than three words
//   echo         - four consecutive source words copied into one string/symbol,
//                  or an explanatory field rendered into the judged CNL
//   coverage     - no reasoning export, partial backend coverage, invalid templates
//   controlOnly  - surface-only control strategy
//   unresolved   - unresolved fragments or references kept in the representation
export const ISSUE_CATEGORIES=Object.freeze(['symbolLength','echo','coverage','controlOnly','unresolved']);
export const ECHO_NGRAM=4;

// Explanatory fields the protocol requires (ambiguity descriptions, glosses, notes).
// They may be long, but they must never be rendered into the CNL that the judge
// scores; the audit checks that separately. `meta`/`source` are provenance and are
// never rendered by any active renderer.
export const EXPLANATORY_KEYS=Object.freeze(['description','issue','gloss','message','question','reason','note','notes','explanation','span','source','meta','rationale']);

const normWords=s=>String(s??'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').match(/[\p{L}\p{N}]+/gu)??[];
// Symbols use underscores/camelCase; compare them in the same word space as the source.
const symbolNormWords=s=>symbolWords(s,{proper:false}).map(w=>w.toLowerCase()).flatMap(w=>normWords(w));

/** Generic fallback: collect strings of a JSON or text formalization. */
export function genericSymbols(formalization) {
  const out=[];
  if(typeof formalization==='string') {
    for(const m of formalization.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b|\b[a-z]+(?:[A-Z][a-z0-9]*)+\b/g))
      out.push({path:'literal',name:m[1]??m[2]??m[0],kind:m[1]!=null||m[2]!=null?'proper':'symbol'});
    return out;
  }
  (function walk(x,path) {
    if(typeof x==='string'){out.push({path,name:x,kind:'symbol'});return;}
    if(!x||typeof x!=='object')return;
    for(const [key,value] of Object.entries(x)) {
      if(EXPLANATORY_KEYS.includes(key))continue;
      if(!Array.isArray(x)&&/\.symbols\.(?:entities|predicates)$/.test(path))out.push({path:`${path}.${key}`,name:key,kind:'symbol'});
      walk(value,Array.isArray(x)?`${path}[${key}]`:`${path}.${key}`);
    }
  })(formalization,'root');
  return out;
}

/** Explanatory strings (not symbols); used to verify they are not rendered into judged CNL. */
export function explanatoryStrings(formalization) {
  const out=[];
  (function walk(x,path,inside) {
    if(typeof x==='string'){if(inside)out.push({path,text:x});return;}
    if(!x||typeof x!=='object')return;
    for(const [key,value] of Object.entries(x))walk(value,Array.isArray(x)?`${path}[${key}]`:`${path}.${key}`,inside||(!Array.isArray(x)&&EXPLANATORY_KEYS.includes(key)&&key!=='source'&&key!=='meta'));
  })(formalization,'root',false);
  return out;
}

/** Source n-grams copied into one symbol; returns issues and covered source positions. */
export function sourceEcho(sourceText,symbols,n=ECHO_NGRAM) {
  const source=normWords(sourceText);
  const grams=new Map();
  for(let i=0;i+n<=source.length;i++){const k=source.slice(i,i+n).join(' ');if(!grams.has(k))grams.set(k,[]);grams.get(k).push(i);}
  const covered=new Set(),hits=[];
  for(const s of symbols) {
    if(s?.name==null||typeof s.name==='object')continue;
    const words=s.kind==='template'?normWords(String(s.name).replace(/\{\d+\}/g,' ')):symbolNormWords(s.name);
    let hit=false;
    for(let i=0;i+n<=words.length;i++) {
      const at=grams.get(words.slice(i,i+n).join(' '));
      if(!at)continue;
      hit=true;for(const p of at)for(let j=0;j<n;j++)covered.add(p+j);
    }
    if(hit)hits.push(s);
  }
  return {hits,echoRatio:source.length?covered.size/source.length:0,sourceWords:source.length};
}

export function auditFormalization(strategy,result) {
  const categories=Object.fromEntries(ISSUE_CATEGORIES.map(c=>[c,[]]));
  const add=(category,message)=>{if(!categories[category].includes(message))categories[category].push(message);};
  if(strategy.controlOnly) add('controlOnly','surface-only control; no reasoning representation');
  if(!result.reasoning) add('coverage','no supported reasoning export');
  if(result.reasoning?.coverage?.complete===false)add('coverage','representation preserved, but reasoning backend covers only part of its semantics');
  if(result.extra?.metadataAudit?.complete===false)add('coverage','CNL template omits or invents an argument slot');
  let symbols=[],metrics={symbols:0,longSymbols:0,echoRatio:0,echoSymbols:0,sourceWords:0};
  if(result.formalization!=null) {
    try {symbols=typeof strategy.symbols==='function'?strategy.symbols(result.formalization):genericSymbols(result.formalization);}
    catch(e) {symbols=genericSymbols(result.formalization);add('coverage',`symbol inventory unavailable: ${e.message}`);}
    const long=symbolViolations(symbols);
    for(const v of long)add('symbolLength',violationMessage(v));
    const echo=sourceEcho(result.sourceText??result.text??'',symbols);
    for(const s of echo.hits)add('echo',`source echo (${ECHO_NGRAM}+ consecutive source words) at ${s.path}: ${String(s.name).slice(0,100)}`);
    if(typeof result.cnl==='string'&&result.formalization&&typeof result.formalization==='object') {
      const cnl=normWords(result.cnl).join(' ');
      for(const e of explanatoryStrings(result.formalization)) {
        const words=normWords(e.text);
        if(words.length>=ECHO_NGRAM&&cnl.includes(words.join(' ')))add('echo',`explanatory field rendered into judged CNL at ${e.path}`);
      }
    }
    metrics={symbols:symbols.length,longSymbols:long.length,echoRatio:Number(echo.echoRatio.toFixed(4)),echoSymbols:echo.hits.length,sourceWords:echo.sourceWords};
    (function walk(x,path) {
      if(!x||typeof x!=='object')return;
      if(x.type==='raw'||x.kind==='unresolved_ref') add('unresolved',`unresolved fragment at ${path}`);
      for(const [key,value] of Object.entries(x))if(!['meta','source'].includes(key))walk(value,`${path}.${key}`);
    })(result.formalization,'root');
    if(typeof result.formalization==='string'&&/\bUNCLEAR:|UNRESOLVED/.test(result.formalization))add('unresolved','unresolved marker in surface output');
  }
  const issues=ISSUE_CATEGORIES.flatMap(c=>categories[c]);
  return {eligible:Boolean(result.ok)&&!issues.length,issues,categories,
    eligibility:Object.fromEntries(ISSUE_CATEGORIES.map(c=>[c,categories[c].length===0])),metrics,screeningOnly:true};
}
