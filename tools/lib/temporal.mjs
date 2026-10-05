// Deterministic "added content" check for unanchored temporal resolution.
// Resolving "tomorrow" or "next Tuesday" to a calendar date or timestamp that
// the source does not state adds information (the run date leaks in). Such a
// date is flagged as `added`, independently of the judge's verdict.
const RELATIVE=/\b(?:today|tonight|tomorrow|yesterday|(?:next|last|this|coming)\s+(?:week|month|year|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|night|quarter)|in\s+\d+\s+(?:days?|weeks?|months?|hours?)|(?:\d+|a|one|two|three)\s+(?:days?|weeks?)\s+ago)\b/gi;
const MONTHS='january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';
const ABSOLUTE=new RegExp(String.raw`\b(?:19|20)\d{2}[-_/.](?:0?[1-9]|1[0-2])[-_/.](?:0?[1-9]|[12]\d|3[01])(?:[tT _-]+\d{1,2}(?:[:_]\d{2}){1,2})?\b|\b(?:0?[1-9]|[12]\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.](?:19|20)\d{2}\b|\b(?:${MONTHS})\.?\s+(?:0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?(?:,?\s+(?:19|20)\d{2})?\b`,'gi');

const digits=s=>s.replace(/\D+/g,'-').replace(/^-|-$/g,'');

export function unanchoredDates(source,output) {
  const src=String(source??''),out=String(output??'');
  const sourceDates=new Set([...src.matchAll(ABSOLUTE)].map(m=>digits(m[0])||m[0].toLowerCase()));
  const cues=[...new Set([...src.matchAll(RELATIVE)].map(m=>m[0].toLowerCase()))];
  const added=[];
  for(const m of out.matchAll(ABSOLUTE)) {
    const key=digits(m[0])||m[0].toLowerCase();
    // Month-name dates without digits in the source cannot be matched by digits alone.
    if(sourceDates.has(key)||src.toLowerCase().includes(m[0].toLowerCase()))continue;
    if(!added.some(a=>a.value===m[0]))added.push({value:m[0],kind:'unanchored-date',relativeCues:cues});
  }
  return added;
}

/** Check a result row's CNL and serialized formalization. */
export function temporalAddedContent(row) {
  const source=row.sourceText??row.text;
  // Generator metadata (e.g. meta.date) is provenance, not represented content.
  const formal=typeof row.formalization==='string'?row.formalization:JSON.stringify(row.formalization??'',(k,v)=>k==='meta'?undefined:v);
  const seen=new Map();
  for(const a of [...unanchoredDates(source,row.cnl),...unanchoredDates(source,formal)])if(!seen.has(a.value))seen.set(a.value,a);
  return [...seen.values()];
}
