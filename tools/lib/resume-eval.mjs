// A semantic failure is evidence, never an invitation to regenerate until it passes.
export function resumeAction(previous,input) {
  if(!previous)return 'generate';
  if(previous.text!==input)throw new Error(`Resume input changed: ${previous.strategy}/${previous.id}`);
  if(!previous.ok&&previous.failure==='infrastructure')return 'generate';
  if(previous.ok&&previous.verdict?.status==='judge_error')return 'rejudge';
  return 'reuse';
}
