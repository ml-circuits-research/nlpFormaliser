// Parsing utilities only. Model calls belong to predefined Ploinky Workers tasks.
export function extractBlock(text) {
  const blocks=[...String(text).matchAll(/```(?:[a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g)].map(m=>m[1]);
  return (blocks.length?blocks.at(-1):String(text)).trim();
}

/**
 * Return the end index (exclusive) of the balanced JSON object starting at
 * `start`, or -1. Braces inside JSON strings (including escaped quotes) are
 * ignored, so `{"reason":"a } b"}` is one object.
 */
function balancedEnd(s,start) {
  let depth=0,inString=false,escaped=false;
  for(let i=start;i<s.length;i++) {
    const c=s[i];
    if(inString) {
      if(escaped)escaped=false;
      else if(c==='\\')escaped=true;
      else if(c==='"')inString=false;
      continue;
    }
    if(c==='"')inString=true;
    else if(c==='{')depth++;
    else if(c==='}'&&--depth===0)return i+1;
  }
  return -1;
}

/**
 * Find the first complete, parseable JSON object in a model response.
 * Unlike first-`{`-to-last-`}` slicing, trailing prose containing braces or a
 * second object cannot corrupt the first object.
 */
export function extractJson(text) {
  if(text && typeof text==='object') return text;
  const s=extractBlock(text);
  for(let start=s.indexOf('{');start>=0;start=s.indexOf('{',start+1)) {
    const end=balancedEnd(s,start);
    if(end<0)continue;
    try {
      const value=JSON.parse(s.slice(start,end));
      if(value&&typeof value==='object'&&!Array.isArray(value))return value;
    } catch {}
  }
  throw new Error('No JSON object in model response');
}
