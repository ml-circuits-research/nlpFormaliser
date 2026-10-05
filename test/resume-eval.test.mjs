import test from 'node:test';
import assert from 'node:assert/strict';
import {resumeAction} from '../tools/lib/resume-eval.mjs';
test('resume retries infrastructure, never semantic or syntax failures',()=>{
  const row={text:'Input',ok:true,verdict:{status:'judged',equivalent:false}};
  assert.equal(resumeAction(row,'Input'),'reuse');
  assert.equal(resumeAction({...row,ok:false,failure:'formalization'},'Input'),'reuse');
  assert.equal(resumeAction({...row,ok:false,failure:'infrastructure'},'Input'),'generate');
  assert.equal(resumeAction({...row,verdict:{status:'judge_error'}},'Input'),'rejudge');
  assert.equal(resumeAction(undefined,'Input'),'generate');
  assert.throws(()=>resumeAction(row,'Changed'),/input changed/);
});
