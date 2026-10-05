// This is a conservative screening aid, not a proof of semantic completeness.
// Semantic preservation is judged separately and never rescues opaque content.
export function auditFormalization(strategy,result) {
  const issues=[];
  if(strategy.controlOnly) issues.push('surface-only control; no reasoning representation');
  if(!result.reasoning) issues.push('no supported reasoning export');
  if(result.reasoning?.coverage?.complete===false)issues.push('representation preserved, but reasoning backend covers only part of its semantics');
  if(result.extra?.metadataAudit?.complete===false)issues.push('CNL template omits or invents an argument slot');
  const sourceWords=result.text.toLowerCase().match(/[a-z0-9]+/g)??[];
  function checkString(s,path) {
    const words=s.replaceAll('_',' ').toLowerCase().match(/[a-z0-9]+/g)??[];
    if(words.length>=7 || (words.length>=4 && sourceWords.join(' ')===words.join(' '))) issues.push(`possible opaque clause at ${path}: ${s.slice(0,100)}`);
  }
  function walk(x,path='root') {
    if(typeof x==='string'){checkString(x,path);return;}
    if(!x||typeof x!=='object')return;
    if(x.type==='raw'||x.kind==='unresolved_ref') issues.push(`unresolved fragment at ${path}`);
    for(const [key,value] of Object.entries(x)) {
      if(['meta','symbols','source'].includes(key))continue;
      walk(value,`${path}.${key}`);
    }
  }
  if(typeof result.formalization==='string') {
    // Inspect quoted literals and long underscore names, not the whole program.
    for(const m of result.formalization.matchAll(/"([^"\n]*)"|'([^'\n]*)'|\b[a-z]+(?:_[a-z]+){6,}\b/g)) checkString(m[1]??m[2]??m[0],'literal');
  } else walk(result.formalization);
  return {eligible:result.ok&&!issues.length,issues:[...new Set(issues)],screeningOnly:true};
}
