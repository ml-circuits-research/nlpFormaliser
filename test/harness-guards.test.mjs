import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ROOT} from '../tools/lib/strategies.mjs';
import {compareStrategies} from '../tools/lib/complementarity.mjs';
import {judgeIndependence,modelFamily,servedOverlap} from '../tools/lib/model-identity.mjs';
import {assertComparable,formalizerIdentity} from '../tools/lib/protocol-signature.mjs';
import {unanchoredDates,temporalAddedContent} from '../tools/lib/temporal.mjs';
import {tableHeader,STRATEGY_HEADER} from '../tools/lib/markdown.mjs';

// Child processes never reach a real worker: isolated home, no autostart.
const env={...process.env,PWORKER_HOME:mkdtempSync(join(tmpdir(),'nlp-pworker-')),PWORKER_AUTOSTART:'0'};
const runEval=args=>spawnSync(process.execPath,[join(ROOT,'tools/run-eval.mjs'),...args],{cwd:ROOT,env,encoding:'utf8'});

test('self-judging is refused before any directory or model call',()=>{
  const id=`test-guard-self-judge-${process.pid}`;
  const r=runEval(['--strategy','explicit-scope-logic','--stage','calibration','--model','up/m','--judge-model','up/m','--id',id]);
  assert.notEqual(r.status,0);assert.match(r.stderr,/Judge equals formalizer/);
  assert.ok(!existsSync(join(ROOT,'docs/experiments',id)));
  const tiers=judgeIndependence({formalizerTier:'medium',judgeTier:'medium'});
  assert.equal(tiers.selfJudge,true);
  assert.equal(judgeIndependence({formalizerModel:'up/GPT-OSS-120B',judgeModel:'up/GPT-OSS-20B'}).sameFamily,true);
  assert.equal(judgeIndependence({formalizerModel:'up/x',judgeModel:'up/x',usesFormalizer:false}).selfJudge,false);
  assert.equal(modelFamily('openference/DeepSeek-V4-Flash'),'deepseek');
  assert.deepEqual(servedOverlap([{role:'judge',result:{served:'m1'}},{role:'explicit-scope-logic',result:{served:'m1'}}]).overlap,['m1']);
});

test('mirror leftovers are refused before spending; selection runs are labelled "selection"',()=>{
  const id=`test-guard-mirror-${process.pid}`,parent=join(ROOT,'eval','fail'),left=join(parent,id),hadParent=existsSync(parent);
  mkdirSync(left,{recursive:true});
  try {
    const r=runEval(['--strategy','deterministic-rule-draft','--offline','--mirrors','--id',id,'--stage','full']);
    assert.notEqual(r.status,0);assert.match(r.stderr,/Mirror leftovers/);
    assert.ok(!existsSync(join(ROOT,'docs/experiments',id)));
  } finally {rmSync(hadParent?left:parent,{recursive:true,force:true});}
  const sel=`test-guard-selection-${process.pid}`,out=join(ROOT,'docs/experiments',sel);
  try {
    const r=runEval(['--strategy','deterministic-rule-draft','--offline','--selection','docs/evaluation/selections/consolidated-first10.json','--limit','2','--id',sel]);
    assert.equal(r.status,0,r.stderr);
    const summary=JSON.parse(readFileSync(join(out,'summary.json'),'utf8'));
    assert.equal(summary.stage,'selection');assert.equal(summary.rankingEligible,false);
    assert.ok(summary.warnings.some(w=>/calibration/.test(w)));
    // Re-running with the same ID is refused (directory creation is exclusive).
    assert.match(runEval(['--strategy','deterministic-rule-draft','--offline','--id',sel]).stderr,/already exists/);
  } finally {rmSync(out,{recursive:true,force:true});}
});

test('control-only strategies are excluded from pairs and oracle but reported',()=>{
  const row=(strategy,id,equivalent)=>({strategy,id,sourceText:id,category:'c',verdict:{status:'judged',equivalent}});
  const r=compareStrategies([row('explicit-scope-logic','1',true),row('direct-context-logic','1',false),row('speech-act-normalization','1',true),row('cnl-core','2',true)]);
  assert.deepEqual(r.strategies,['direct-context-logic','explicit-scope-logic']);
  assert.equal(r.pairs.length,1);
  assert.ok(!r.pairs.some(p=>[p.left,p.right].includes('speech-act-normalization')));
  assert.equal(r.controls['speech-act-normalization'].cases,1);assert.equal(r.controls['cnl-core'].cases,1);
});

test('comparison signature includes judge model and formalizer model',()=>{
  const m=(o,extra={})=>({stage:'development',repairs:0,options:{'judge-tier':'good','judge-mode':'bidirectional',...o},sourceHashes:{},...extra});
  assert.doesNotThrow(()=>assertComparable([m({'judge-model':'up/j',model:'up/f'}),m({'judge-model':'up/j',model:'up/f'})]));
  assert.throws(()=>assertComparable([m({'judge-model':'up/j',model:'up/f'}),m({'judge-model':'up/k',model:'up/f'})]),/judge/);
  assert.throws(()=>assertComparable([m({'judge-model':'up/j',model:'up/f'}),m({'judge-model':'up/j',model:'up/g'})]),/formalizer models/);
  assert.equal(formalizerIdentity(m({},{formalizer:{usesModel:false}})),'none');
  assert.doesNotThrow(()=>assertComparable([m({'judge-model':'up/j',model:'up/f'}),m({'judge-model':'up/j'},{formalizer:{usesModel:false}})]));
});

test('resolving "tomorrow" to a calendar date is flagged as added content',()=>{
  const source='Remind me tomorrow at 9am, and again at 10am if it is not done.';
  const added=unanchoredDates(source,'remind(me, 2026_10_06t09_00)');
  assert.equal(added.length,1);assert.equal(added[0].kind,'unanchored-date');assert.deepEqual(added[0].relativeCues,['tomorrow']);
  assert.deepEqual(unanchoredDates('The meeting is on 2026-10-06.','meeting(2026-10-06)'),[]);
  assert.deepEqual(temporalAddedContent({sourceText:'Today.',cnl:'ok',formalization:{facts:[],meta:{date:'2026-10-05'}}}),[]);
});

test('report tables have exactly one delimiter cell per header cell',()=>{
  const [head,delim]=tableHeader(STRATEGY_HEADER).split('\n');
  assert.equal(head.split('|').length,delim.split('|').length);
  assert.equal(STRATEGY_HEADER.length,10);
});
