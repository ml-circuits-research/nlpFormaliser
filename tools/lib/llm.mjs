// Parsing utilities only. Model calls belong to predefined Ploinky Workers tasks.
export function extractBlock(text) {
  const blocks=[...String(text).matchAll(/```(?:[a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g)].map(m=>m[1]);
  return (blocks.length?blocks.at(-1):String(text)).trim();
}
export function extractJson(text) {
  if(text && typeof text==='object') return text;
  const s=extractBlock(text),a=s.indexOf('{'),b=s.lastIndexOf('}');
  if(a<0||b<a) throw new Error('No JSON object in model response');
  return JSON.parse(s.slice(a,b+1));
}
