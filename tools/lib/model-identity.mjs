// Formalizer/judge independence. A judge that equals the formalizer shares its
// errors; the same family correlates them. Exact equality is refused unless
// explicitly allowed; same-family and unverifiable tier pairs are recorded.
export function modelIdentity(model,tier) {
  return model?{kind:'model',id:model}:{kind:'tier',id:tier};
}

/** Coarse model family from an "upstream/model" name: leading alphabetic stem. */
export function modelFamily(model) {
  if(!model)return null;
  const name=String(model).slice(String(model).indexOf('/')+1).toLowerCase();
  return name.match(/^[a-z]+/)?.[0]??name;
}

export function judgeIndependence({formalizerModel=null,formalizerTier=null,judgeModel=null,judgeTier=null,usesFormalizer=true}) {
  if(!usesFormalizer)return {status:'no-formalizer-model',selfJudge:false,sameFamily:false,warnings:[]};
  const f=modelIdentity(formalizerModel,formalizerTier),j=modelIdentity(judgeModel,judgeTier);
  const warnings=[];
  let selfJudge=false,sameFamily=false;
  if(f.kind===j.kind&&f.id===j.id)selfJudge=true;
  if(f.kind==='model'&&j.kind==='model') {
    sameFamily=modelFamily(f.id)===modelFamily(j.id);
    if(sameFamily&&!selfJudge)warnings.push(`Judge ${j.id} and formalizer ${f.id} appear to share a model family (${modelFamily(f.id)}).`);
  } else if(!selfJudge) {
    warnings.push(`Formalizer ${f.kind} "${f.id}" vs judge ${j.kind} "${j.id}": tier routing can serve the same model; compare served models recorded in calls.jsonl.`);
  }
  return {status:selfJudge?'self-judge':sameFamily?'same-family':'distinct-or-unverified',selfJudge,sameFamily,formalizer:f,judge:j,warnings};
}

/** Post-hoc check on served model names recorded by the worker. */
export function servedOverlap(calls) {
  const by=role=>new Set(calls.filter(c=>role==='judge'?c.role==='judge'||c.role==='unit-judge'||c.role==='control-judge':!['judge','unit-judge','control-judge'].includes(c.role)).map(c=>c.result?.served).filter(Boolean));
  const judge=by('judge'),formalizer=by('formalizer');
  return {judgeServed:[...judge].sort(),formalizerServed:[...formalizer].sort(),overlap:[...judge].filter(m=>formalizer.has(m)).sort()};
}
