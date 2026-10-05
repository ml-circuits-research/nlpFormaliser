// Judge sensitivity/specificity on injected controls.
// Target condition = "the CNL does NOT preserve the original".
//   sensitivity = negative controls (expected=false) judged not equivalent
//   specificity = positive controls (expected=true) judged equivalent
// Uncertain verdicts and judge errors are counted as misses in both
// directions and also reported separately; they never inflate either rate.
import {wilson} from './complementarity.mjs';

const rate=(k,n)=>({correct:k,n,rate:n?k/n:null,wilson95:wilson(k,n)});

export function controlMetrics(rows) {
  const negatives=rows.filter(r=>r.expected===false),positives=rows.filter(r=>r.expected===true);
  const detected=negatives.filter(r=>r.verdict?.equivalent===false);
  const accepted=positives.filter(r=>r.verdict?.equivalent===true);
  const units={tp:0,fn:0,tn:0,fp:0,missing:0};
  for(const r of rows) {
    if(!r.unitExpected||!r.unitVerdict)continue;
    const byId=new Map((r.unitVerdict.units??[]).map(u=>[u.id,u.preserved]));
    for(const [id,expected] of Object.entries(r.unitExpected)) {
      const got=byId.get(id);
      if(got===undefined||r.unitVerdict.status!=='judged'){units.missing++;continue;}
      if(expected===false)got===false?units.tp++:units.fn++;
      else got===true?units.tn++:units.fp++;
    }
  }
  const byFamily={};
  for(const family of [...new Set(rows.map(r=>r.family??'other'))].sort()) {
    const g=rows.filter(r=>(r.family??'other')===family);
    byFamily[family]={sensitivity:rate(g.filter(r=>r.expected===false&&r.verdict?.equivalent===false).length,g.filter(r=>r.expected===false).length),
      specificity:rate(g.filter(r=>r.expected===true&&r.verdict?.equivalent===true).length,g.filter(r=>r.expected===true).length)};
  }
  return {
    n:rows.length,
    sensitivity:rate(detected.length,negatives.length),
    specificity:rate(accepted.length,positives.length),
    falseAccepts:negatives.filter(r=>r.verdict?.equivalent===true).map(r=>r.id),
    falseRejects:positives.filter(r=>r.verdict?.equivalent===false).map(r=>r.id),
    uncertain:rows.filter(r=>r.verdict?.status==='judged'&&r.verdict.equivalent===null).map(r=>r.id),
    errors:rows.filter(r=>r.verdict?.status!=='judged').map(r=>r.id),
    unitLevel:{...units,sensitivity:rate(units.tp,units.tp+units.fn),specificity:rate(units.tn,units.tn+units.fp)},
    byFamily,
  };
}

/** Gate a run on its controls. Any false accept fails the gate regardless of thresholds. */
export function controlGate(metrics,{minSensitivity=0.8,minSpecificity=0.8,maxErrors=0}={}) {
  const reasons=[];
  if(metrics.falseAccepts.length)reasons.push(`false accepts on negative controls: ${metrics.falseAccepts.join(', ')}`);
  if((metrics.sensitivity.rate??0)<minSensitivity)reasons.push(`sensitivity ${metrics.sensitivity.correct}/${metrics.sensitivity.n} below ${minSensitivity}`);
  if((metrics.specificity.rate??0)<minSpecificity)reasons.push(`specificity ${metrics.specificity.correct}/${metrics.specificity.n} below ${minSpecificity}`);
  if(metrics.errors.length>maxErrors)reasons.push(`${metrics.errors.length} control judgments failed or were not judged`);
  const u=metrics.unitLevel;
  if(u.tp+u.fn&&(u.sensitivity.rate??0)<minSensitivity)reasons.push(`unit-level sensitivity ${u.tp}/${u.tp+u.fn} below ${minSensitivity}`);
  if(u.tn+u.fp&&(u.specificity.rate??0)<minSpecificity)reasons.push(`unit-level specificity ${u.tn}/${u.tn+u.fp} below ${minSpecificity}`);
  return {passed:!reasons.length,reasons,thresholds:{minSensitivity,minSpecificity,maxErrors}};
}
