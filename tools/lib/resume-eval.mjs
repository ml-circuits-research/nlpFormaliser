import {isRetryableRow} from './failures.mjs';

// A semantic failure is evidence, never an invitation to regenerate until it passes.
// Budget (truncation) and infrastructure (transport, batch envelope) failures
// are not semantic evidence and are regenerated, including legacy rows whose
// saved `failure` field misfiled them as formalization failures.
export function resumeAction(previous,input) {
  if(!previous)return 'generate';
  if(previous.text!==input)throw new Error(`Resume input changed: ${previous.strategy}/${previous.id}`);
  if(!previous.ok&&isRetryableRow(previous))return 'generate';
  if(previous.ok&&previous.verdict?.status==='judge_error')return 'rejudge';
  return 'reuse';
}

// Options that change what is measured. A resumed run must match all of them.
export const RESUME_PROTOCOL_KEYS=['set','stage','selection','tier','judge-tier','model','judge-model','judge-mode',
  'batch-size','judge-batch-size','cnl-view','offline','max-tokens','judge-max-tokens','unit-judge'];

// Sources whose change alters formalization or judging semantics: refuse.
export function isSemanticSource(file) {
  return file.startsWith('strategies/')||file.startsWith('tasks/')||/^tools\/lib\/(?:judge|unit-judge|units|evalset|consolidated-reference)\.mjs$/.test(file);
}
export const isPworkerSource=file=>/(?:^|\/)Ploinky-Worker\/lib\/.*\.mjs$/.test(file);

/** Compare a prior manifest with the current protocol. Throws on mismatch; returns recorded warnings. */
export function checkResumeProtocol(old,options,caseIds,sourceHashes) {
  if(old.options?.offline)throw new Error('Cannot resume from an offline run: it contains no model outputs or judgments to reuse');
  if(options.offline)throw new Error('Resume cannot be combined with offline');
  const norm=(key,value)=>key==='offline'?!!value:value===undefined||value===null?null:key==='selection'&&typeof value==='string'?value.replace(/^\.\//,''):value;
  for(const key of RESUME_PROTOCOL_KEYS) {
    // Older manifests predate some keys; an absent old key matches only the old default.
    if(!Object.hasOwn(old.options??{},key)&&['judge-batch-size','unit-judge'].includes(key))continue;
    const before=norm(key,old.options?.[key]),after=norm(key,options[key]);
    if(JSON.stringify(before)!==JSON.stringify(after))throw new Error(`Resume protocol mismatch: ${key} (${JSON.stringify(before)} -> ${JSON.stringify(after)})`);
  }
  if(JSON.stringify(old.cases.map(c=>c.id).sort())!==JSON.stringify([...caseIds].sort()))throw new Error('Resume case selection changed');
  for(const [file,hash] of Object.entries(old.sourceHashes??{}))if(isSemanticSource(file)&&sourceHashes[file]!==hash)throw new Error(`Resume semantic source changed: ${file}`);
  const files=new Set([...Object.keys(old.sourceHashes??{}),...Object.keys(sourceHashes)].filter(isPworkerSource));
  const pworkerDifferences=[...files].sort().flatMap(file=>{
    const before=old.sourceHashes?.[file]??null,after=sourceHashes[file]??null;
    return before===after?[]:[{file,change:before===null?'added':after===null?'removed':'modified'}];
  });
  const warnings=pworkerDifferences.length?[`Ploinky-Worker sources differ from the resumed run (${pworkerDifferences.length} files): ${pworkerDifferences.map(d=>`${d.file} [${d.change}]`).join(', ')}`]:[];
  if(!files.size)warnings.push('Resumed run recorded no Ploinky-Worker source hashes; worker changes cannot be verified');
  return {warnings,pworkerDifferences};
}
