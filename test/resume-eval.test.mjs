import test from 'node:test';
import assert from 'node:assert/strict';
import {resumeAction,checkResumeProtocol} from '../tools/lib/resume-eval.mjs';
import {classifyFailure,rowFailure} from '../tools/lib/failures.mjs';
import {formalizeToCNL} from '../tools/lib/strategies.mjs';
import {summarizeRows} from '../tools/lib/metrics.mjs';
import {modelInputFor,sourceForModel} from '../tools/lib/evalset.mjs';

test('resume retries infrastructure, never semantic or syntax failures',()=>{
  const row={text:'Input',ok:true,verdict:{status:'judged',equivalent:false}};
  assert.equal(resumeAction(row,'Input'),'reuse');
  assert.equal(resumeAction({...row,ok:false,failure:'formalization',errors:['SyntaxError: Expected ( at 3']},'Input'),'reuse');
  assert.equal(resumeAction({...row,ok:false,failure:'infrastructure'},'Input'),'generate');
  assert.equal(resumeAction({...row,verdict:{status:'judge_error'}},'Input'),'rejudge');
  assert.equal(resumeAction(undefined,'Input'),'generate');
  assert.throws(()=>resumeAction(row,'Changed'),/input changed/);
});

test('worker truncation and batch-envelope errors are budget/infrastructure, not formalization',()=>{
  assert.equal(classifyFailure('Model response was truncated'),'budget');
  for(const m of ['Invalid batch response: results is missing','Missing result for t-abc','Unexpected result ID in batch response','no answer within 120 s','status 529','fetch failed'])
    assert.equal(classifyFailure(m),'infrastructure',m);
  assert.equal(classifyFailure('LLM disabled for offline experiment'),'offline');
  assert.equal(classifyFailure("Invalid Formal IR: rules[3] head variable ?cancelled is not bound"),'formalization');
  // Legacy rows saved before the fix are re-derived from their errors and retried.
  const legacy={text:'Input',ok:false,failure:'formalization',errors:['Error: Model response was truncated']};
  assert.equal(rowFailure(legacy),'budget');
  assert.equal(resumeAction(legacy,'Input'),'generate');
  assert.equal(resumeAction({...legacy,errors:['Error: Missing result for t-1']},'Input'),'generate');
  const s=summarizeRows([legacy,{ok:false,failure:'formalization',errors:['SyntaxError: x']}]);
  assert.equal(s.formalizationFailures,1);assert.equal(s.budgetFailures,1);
});

test('formalizeToCNL classifies a truncated worker response as budget',async()=>{
  const r=await formalizeToCNL({name:'t',formalize:async()=>{throw new Error('Model response was truncated');},toCNL:()=>''},'x');
  assert.equal(r.ok,false);assert.equal(r.failure,'budget');
});

const manifest=(options={},hashes={})=>({options:{set:'consolidated',stage:'source',selection:'docs/evaluation/selections/consolidated-first10.json',
  tier:'small','judge-tier':'good',model:'up/a','judge-model':'up/b','judge-mode':'bidirectional','batch-size':'1','cnl-view':'native',
  'max-tokens':'8000','judge-max-tokens':'6000',...options},cases:[{id:'c1'}],sourceHashes:{'strategies/x/index.mjs':'h1','../Ploinky-Worker/lib/client.mjs':'p1',...hashes}});

test('resume protocol compares every measurement option and refuses offline sources',()=>{
  const current=manifest().options,hashes={'strategies/x/index.mjs':'h1','../Ploinky-Worker/lib/client.mjs':'p1'};
  assert.deepEqual(checkResumeProtocol(manifest(),current,['c1'],hashes).warnings,[]);
  for(const [key,value] of [['tier','medium'],['judge-tier','best'],['set','other'],['stage','development'],['selection','x.json'],['batch-size','5'],['cnl-view','common'],['model','up/c']])
    assert.throws(()=>checkResumeProtocol(manifest(),{...current,[key]:value},['c1'],hashes),new RegExp(`mismatch: ${key}`),key);
  assert.throws(()=>checkResumeProtocol(manifest({offline:true}),current,['c1'],hashes),/offline run/);
  assert.throws(()=>checkResumeProtocol(manifest(),current,['c2'],hashes),/selection changed/);
  assert.throws(()=>checkResumeProtocol(manifest(),current,['c1'],{...hashes,'strategies/x/index.mjs':'h2'}),/semantic source changed/);
});

test('Ploinky-Worker source differences are listed explicitly',()=>{
  const r=checkResumeProtocol(manifest(),manifest().options,['c1'],{'strategies/x/index.mjs':'h1','../Ploinky-Worker/lib/client.mjs':'p2','../Ploinky-Worker/lib/new.mjs':'n'});
  assert.deepEqual(r.pworkerDifferences.map(d=>`${d.file}:${d.change}`),['../Ploinky-Worker/lib/client.mjs:modified','../Ploinky-Worker/lib/new.mjs:added']);
  assert.match(r.warnings[0],/client\.mjs \[modified\]/);
});

test('rejudge carries the stored model input instead of wrapping it again',()=>{
  const sample={id:'c',text:'Ada left.',context:{speaker:'Bob'}};
  const input=sourceForModel(sample);
  const stored={id:'c',text:input,context:sample.context,sourceText:sample.text};
  assert.equal(modelInputFor(stored,{stored:true}),input);
  assert.equal(modelInputFor({...stored,modelInput:input},{stored:true}),input);
  assert.notEqual(sourceForModel({...stored,text:stored.text}),input,'re-encoding a stored row would double-wrap it');
  assert.throws(()=>sourceForModel({...stored,modelInput:input}),/modelInputFor/);
});
