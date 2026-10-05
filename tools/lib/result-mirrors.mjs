import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';

export function resultDisposition(row) {
  if(!row.ok)return 'formalization_error';
  if(row.verdict?.status==='judge_error')return 'judge_error';
  if(row.verdict?.equivalent===false)return 'not_equivalent';
  if(row.verdict?.outcome==='equivalent_with_notes')return 'equivalent_with_notes';
  if(row.verdict?.equivalent!==true)return row.verdict?.status==='judged'?'uncertain':'not_judged';
  if(!row.audit?.eligible)return 'unsupported_or_opaque';
  return 'accepted';
}

export function writeResultMirror(root,experiment,row) {
  if(!/^[\w-]+$/.test(experiment)||!/^[\w-]+$/.test(row.strategy))throw new Error('Invalid mirror namespace');
  if(typeof row.id!=='string'||!row.id.split('/').every(s=>/^[\w.-]+$/.test(s)&&s!=='.'&&s!=='..'))throw new Error('Invalid mirror case path');
  const status=resultDisposition(row),bucket=status==='accepted'?'success':'fail';
  const suffix=row.id.endsWith('.txt')?row.id:`${row.id}.txt`;
  const relative=`eval/${bucket}/${experiment}/${row.strategy}/${suffix}`;
  const path=join(root,relative);
  if(existsSync(path))throw new Error(`Mirror already exists: ${relative}`);
  mkdirSync(dirname(path),{recursive:true});
  // No invented output on parser/transport failure: the empty file and the
  // separate status index explicitly record that no CNL was obtained.
  writeFileSync(path,row.cnl?row.cnl.trim()+'\n':'',{flag:'wx'});
  // The bucket is a joint acceptance diagnostic; equivalence and eligibility
  // are recorded separately so neither is folded into the other.
  return {id:row.id,strategy:row.strategy,path:relative,bucket,status,hasCNL:!!row.cnl,
    equivalence:row.verdict?.outcome??(row.verdict?.equivalent===true?'equivalent':row.verdict?.equivalent===false?'not_equivalent':row.verdict?.status??'not_judged'),
    reasoningEligible:!!row.audit?.eligible,
    judgmentView:row.judgmentView??'native',verdict:row.verdict,audit:row.audit,errors:row.errors??[]};
}
