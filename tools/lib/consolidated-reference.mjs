// Carry atomic-record references (behavioral probes, gold IR/wire/CNL) into a
// consolidated document, each with its character span in the document.
//
// These references remain ATOMIC: a probe checks one source span inside the
// combined document. They are not whole-document gold, because concatenation
// can change reference and consistency. No document-level `formalIR` is
// produced, so structural metrics are not claimed for combined documents.
export const ATOMIC_REFERENCE_NOTE='Atomic-span references carried from source records; not whole-document gold.';

export function consolidatedReference(row,lookup) {
  const sources=row.construction?.sources??[];
  if(!sources.length)return row.reference??{};
  let cursor=0;
  const atomic=sources.map(source=>{
    const record=lookup(source.set,source.id);
    const text=record?.text??null;
    let start=text?row.text.indexOf(text,cursor):-1;
    if(start<0&&text)start=row.text.indexOf(text);
    if(start>=0)cursor=start+text.length;
    const ref=record?.reference??{};
    return {id:record?.id??`${source.set}/${source.id}`,set:source.set,span:start>=0?[start,start+text.length]:null,
      ...(ref.formalIR?{formalIR:ref.formalIR}:{}),...(ref.behavior?{behavior:ref.behavior}:{}),
      ...(ref.wire?{wire:ref.wire}:{}),...(ref.cnl?{cnl:ref.cnl}:{}),
      trust:record?.provenance?.trust??null};
  });
  const behavior=atomic.flatMap(a=>(a.behavior??[]).map(probe=>({...probe,sourceId:a.id,scope:'atomic-span'})));
  return {derivedFrom:'atomic-records',note:ATOMIC_REFERENCE_NOTE,atomic,behavior,
    coverage:{atomicSources:atomic.length,withSpan:atomic.filter(a=>a.span).length,
      withBehavior:atomic.filter(a=>a.behavior?.length).length,withGold:atomic.filter(a=>a.formalIR||a.wire||a.cnl).length,
      probes:behavior.length}};
}
