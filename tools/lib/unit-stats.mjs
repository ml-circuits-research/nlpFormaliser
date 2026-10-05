// Unit-level (sentence/proposition) preservation statistics.
//
// Units within a document are correlated, so every interval resamples whole
// documents (clustered bootstrap) and paired comparisons resample shared
// documents. Seeds are fixed: identical inputs give identical reports.
import {rowFailure,RETRYABLE_FAILURES} from './failures.mjs';

export function mulberry32(seed) {
  let a=seed>>>0;
  return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
const quantile=(sorted,q)=>{
  if(!sorted.length)return null;
  const pos=(sorted.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos);
  return sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo);
};
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;

/**
 * Per-row unit outcome for one population. Returns null when the row does not
 * belong to the population (or has no semantic outcome), else
 * {units:[0|1...], uncertain, judged:boolean}.
 *   eligible           valid, reasoning-eligible and unit-judged (primary)
 *   valid              valid and unit-judged, eligibility ignored
 *   intention-to-treat every case with a semantic outcome; invalid or
 *                      ineligible outputs score 0 on every unit
 * Budget/infrastructure failures and judge errors have no semantic outcome.
 */
export function rowUnitOutcome(row,population='eligible') {
  const failure=rowFailure(row);
  if(failure&&(RETRYABLE_FAILURES.has(failure)||failure==='offline'))return null;
  const v=row.unitVerdict;
  const n=row.units?.length??v?.units?.length??0;
  if(!n)return null;
  const judged=v?.status==='judged';
  const scores=judged?v.units.map(u=>u.preserved===true?1:0):null;
  const uncertain=judged?v.units.filter(u=>u.preserved===null).length:0;
  if(population==='eligible')return row.ok&&row.audit?.eligible&&judged?{units:scores,uncertain}:null;
  if(population==='valid')return row.ok&&judged?{units:scores,uncertain}:null;
  if(population==='intention-to-treat') {
    if(!row.ok)return {units:Array(n).fill(0),uncertain:0};
    if(!row.audit?.eligible)return {units:Array(n).fill(0),uncertain:0};
    return judged?{units:scores,uncertain}:null;
  }
  throw new Error(`Unknown population ${population}`);
}

function summarizeDocs(docs,{resamples=2000,seed=20261005}={}) {
  const units=docs.reduce((n,d)=>n+d.units.length,0),preserved=docs.reduce((n,d)=>n+d.units.reduce((a,b)=>a+b,0),0);
  const props=docs.map(d=>d.units.reduce((a,b)=>a+b,0)/d.units.length);
  const result={documents:docs.length,units,preserved,uncertainUnits:docs.reduce((n,d)=>n+d.uncertain,0),
    macroMean:mean(props),microMean:units?preserved/units:null,macroCI95:null,microCI95:null,
    perDocument:docs.map((d,i)=>({id:d.id,units:d.units.length,preserved:d.units.reduce((a,b)=>a+b,0),proportion:props[i]}))};
  if(docs.length<2)return result;
  const rand=mulberry32(seed),macro=[],micro=[];
  for(let b=0;b<resamples;b++) {
    let u=0,p=0,s=0;
    for(let i=0;i<docs.length;i++){const d=docs[Math.floor(rand()*docs.length)];const k=d.units.reduce((a,x)=>a+x,0);u+=d.units.length;p+=k;s+=k/d.units.length;}
    macro.push(s/docs.length);micro.push(p/u);
  }
  macro.sort((a,b)=>a-b);micro.sort((a,b)=>a-b);
  result.macroCI95=[quantile(macro,0.025),quantile(macro,0.975)];
  result.microCI95=[quantile(micro,0.025),quantile(micro,0.975)];
  return result;
}

/** Exact two-sided sign test (binomial, p=0.5) on k successes of n discordant pairs. */
export function signTest(k,n) {
  if(!n)return null;
  const logC=[0];for(let i=1;i<=n;i++)logC.push(logC[i-1]+Math.log(i));
  const pmf=i=>Math.exp(logC[n]-logC[i]-logC[n-i]-n*Math.LN2);
  const observed=pmf(k);let p=0;
  for(let i=0;i<=n;i++){const q=pmf(i);if(q<=observed*(1+1e-9))p+=q;}
  return Math.min(1,p);
}

function rowsByStrategy(rows) {
  const out=new Map();
  for(const r of rows){if(!out.has(r.strategy))out.set(r.strategy,new Map());out.get(r.strategy).set(r.id,r);}
  return out;
}

/** Paired comparison of two strategies on shared documents and units. */
export function pairedUnitComparison(left,right,population='intention-to-treat',{resamples=2000,seed=20261005}={}) {
  const docs=[];
  for(const [id,a] of left) {
    const b=right.get(id);if(!b)continue;
    const x=rowUnitOutcome(a,population),y=rowUnitOutcome(b,population);
    if(!x||!y||x.units.length!==y.units.length)continue;
    docs.push({id,a:x.units,b:y.units});
  }
  let leftOnly=0,rightOnly=0,both=0,neither=0;
  for(const d of docs)d.a.forEach((v,i)=>{const w=d.b[i];v&&w?both++:v?leftOnly++:w?rightOnly++:neither++;});
  const units=leftOnly+rightOnly+both+neither;
  const diffOf=set=>{let u=0,s=0;for(const d of set){u+=d.a.length;s+=d.a.reduce((x,y)=>x+y,0)-d.b.reduce((x,y)=>x+y,0);}return u?s/u:null;};
  const docDiffs=docs.map(d=>d.a.reduce((x,y)=>x+y,0)/d.a.length-d.b.reduce((x,y)=>x+y,0)/d.b.length);
  const docPositive=docDiffs.filter(x=>x>0).length,docNegative=docDiffs.filter(x=>x<0).length;
  let ci=null;
  if(docs.length>=2) {
    const rand=mulberry32(seed),boot=[];
    for(let b=0;b<resamples;b++)boot.push(diffOf(Array.from({length:docs.length},()=>docs[Math.floor(rand()*docs.length)])));
    boot.sort((a,b)=>a-b);ci=[quantile(boot,0.025),quantile(boot,0.975)];
  }
  return {population,sharedDocuments:docs.length,sharedUnits:units,both,leftOnly,rightOnly,neither,
    microDifference:diffOf(docs),microDifferenceCI95:ci,
    unitSignTest:{discordant:leftOnly+rightOnly,leftWins:leftOnly,p:signTest(leftOnly,leftOnly+rightOnly),
      caveat:'Treats units as independent; prefer the clustered interval and document-level test.'},
    documentSignTest:{nonZero:docPositive+docNegative,leftBetter:docPositive,p:signTest(docPositive,docPositive+docNegative)}};
}

/**
 * Unit-level report for one run. Control-only strategies are reported but
 * excluded from `ranked` and from pairwise comparisons.
 */
export function unitReport(rows,{controlOnly=new Set(),populations=['eligible','valid','intention-to-treat'],resamples=2000,seed=20261005}={}) {
  const groups=rowsByStrategy(rows),strategies={};
  for(const [name,byId] of groups) {
    const all=[...byId.values()];
    const eligible=all.filter(r=>r.ok&&r.audit?.eligible).length;
    strategies[name]={controlOnly:controlOnly.has(name),cases:all.length,
      unitJudged:all.filter(r=>r.unitVerdict?.status==='judged').length,
      unitJudgeErrors:all.filter(r=>r.unitVerdict?.status==='judge_error').length,
      eligibility:{eligible,cases:all.length,rate:all.length?eligible/all.length:null},
      ...Object.fromEntries(populations.map(p=>[p,summarizeDocs(all.flatMap(r=>{const o=rowUnitOutcome(r,p);return o?[{id:r.id,...o}]:[];}),{resamples,seed})]))};
  }
  const ranked=[...groups.keys()].filter(n=>!controlOnly.has(n)).sort();
  const pairs=[];
  for(let i=0;i<ranked.length;i++)for(let j=i+1;j<ranked.length;j++)
    pairs.push({left:ranked[i],right:ranked[j],...Object.fromEntries(['eligible','intention-to-treat'].map(p=>[p,pairedUnitComparison(groups.get(ranked[i]),groups.get(ranked[j]),p,{resamples,seed})]))});
  return {schema:'unit-preservation/1',primary:'eligible.microMean',strategies,ranked,
    controlsExcluded:[...groups.keys()].filter(n=>controlOnly.has(n)).sort(),pairs,
    notes:['Primary endpoint: unit-level preservation among eligible outputs; eligibility is reported separately.',
      'Intervals are clustered percentile bootstrap over documents; paired intervals resample shared documents.',
      'Uncertain unit verdicts count as not preserved and are reported separately.']};
}
