import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {loadTask} from '../../Ploinky-Worker/lib/pworker/task.mjs';
import {ROOT} from '../tools/lib/strategies.mjs';
import {INPUT_SUFFIX} from '../tools/lib/task-spec.mjs';
import {taskLLM} from '../tools/lib/pworker.mjs';
import {UNIT_SYSTEM,validateUnitVerdict,makeUnitJudge} from '../tools/lib/unit-judge.mjs';
import {sourceUnits,splitSentences} from '../tools/lib/units.mjs';
import {loadSet} from '../tools/lib/evalset.mjs';
import {unitReport,pairedUnitComparison,rowUnitOutcome,signTest,mulberry32} from '../tools/lib/unit-stats.mjs';

const units=[{id:'u01',text:'Ada left.'},{id:'u02',text:'Did Bob stay?'}];

test('the unit judge is a predefined task whose template matches the evaluator prompt',async()=>{
  const task=await loadTask(join(ROOT,'tasks/judge-units.mjs'));
  assert.equal(task.begin.template,UNIT_SYSTEM+INPUT_SUFFIX);
  assert.match(UNIT_SYSTEM,/tomorrow/);
  let prompt;
  const {llm}=taskLLM({file:join(ROOT,'tasks/judge-units.mjs'),batchSize:1,client:{chat:async r=>{prompt=r.prompt??JSON.stringify(r);return {ok:true,text:JSON.stringify({units:[{id:'u02',preserved:false,note:'question lost'},{id:'u01',preserved:true}],added:['none']})};}}});
  const v=await makeUnitJudge(llm)('Ada left. Did Bob stay?',units,'Ada left.');
  assert.ok(prompt.includes('u01'));
  assert.equal(v.status,'judged');assert.deepEqual(v.units.map(u=>[u.id,u.preserved]),[['u01',true],['u02',false]]);
  assert.deepEqual(v.added,[]);
});

test('unit verdicts are strict about ids and value types',()=>{
  const ok={units:[{id:'u01',preserved:true},{id:'u02',preserved:null}]};
  assert.equal(validateUnitVerdict(ok,units).units[1].preserved,null);
  assert.throws(()=>validateUnitVerdict({units:[{id:'u01',preserved:true}]},units),/Missing unit verdicts: u02/);
  assert.throws(()=>validateUnitVerdict({units:[...ok.units,{id:'u03',preserved:true}]},units),/Unexpected unit id/);
  assert.throws(()=>validateUnitVerdict({units:[ok.units[0],ok.units[0],ok.units[1]]},units),/Duplicate/);
  assert.throws(()=>validateUnitVerdict({units:[{id:'u01',preserved:'true'},ok.units[1]]},units),/Invalid preserved/);
});

test('no output is scored without a model call; malformed replies are judge errors',async()=>{
  let called=false;
  const judge=makeUnitJudge(async()=>{called=true;return 'garbage';});
  const none=await judge('x',units,null);
  assert.equal(none.status,'no_output');assert.equal(called,false);assert.ok(none.units.every(u=>u.preserved===false));
  assert.equal((await judge('x',units,'cnl')).status,'judge_error');
});

test('units come from the source with atomic provenance; dialogue units come from turns',()=>{
  assert.deepEqual(splitSentences('One. Two?\n\nThree').map(s=>s.text),['One.','Two?','Three']);
  const rows=loadSet('consolidated');
  const lab=rows.find(r=>r.id==='consolidated/lab-development/01-mixed-discussion');
  const u=sourceUnits(lab);
  assert.equal(u[0].source.kind,'added');
  assert.ok(u.some(x=>x.source?.kind==='atomic'&&x.source.id.startsWith('archive-lab-development/')));
  for(const x of u)assert.equal(lab.text.slice(x.start,x.end),x.text);
  const dialogue=rows.find(r=>r.turns);
  const du=sourceUnits(dialogue);
  assert.ok(du.length>=dialogue.turns.length);assert.match(du[0].id,/^t01-s01$/);
});

test('consolidated cases carry atomic probes and gold with source spans',()=>{
  const rows=loadSet('consolidated');
  const lab=rows.find(r=>r.id==='consolidated/lab-development/01-mixed-discussion');
  assert.equal(lab.reference.derivedFrom,'atomic-records');
  assert.ok(lab.reference.behavior.length>0);
  assert.ok(lab.reference.behavior.every(p=>p.sourceId&&p.scope==='atomic-span'));
  assert.equal(lab.reference.formalIR,undefined,'no whole-document gold is invented');
  for(const a of lab.reference.atomic){assert.ok(a.formalIR);assert.ok(lab.text.slice(...a.span).length>0);}
  const scope=rows.find(r=>r.category==='scope');
  assert.ok(scope.reference.atomic.every(a=>a.wire&&a.span));
});

const row=(strategy,id,scores,{ok=true,eligible=true,status='judged',failure}={})=>({strategy,id,ok,failure,errors:failure==='infrastructure'?['status 529']:[],audit:{eligible},
  units:scores.map((_,i)=>({id:`u${i}`})),unitVerdict:{status,units:scores.map((s,i)=>({id:`u${i}`,preserved:s===null?null:!!s}))}});

test('populations: eligible primary, valid, and intention-to-treat; infrastructure has no outcome',()=>{
  assert.deepEqual(rowUnitOutcome(row('a','1',[1,0,null]),'eligible').units,[1,0,0]);
  assert.equal(rowUnitOutcome(row('a','1',[1,1],{eligible:false}),'eligible'),null);
  assert.deepEqual(rowUnitOutcome(row('a','1',[1,1],{eligible:false}),'intention-to-treat').units,[0,0]);
  assert.deepEqual(rowUnitOutcome(row('a','1',[1,1],{ok:false,status:'no_output',failure:'formalization'}),'intention-to-treat').units,[0,0]);
  assert.equal(rowUnitOutcome(row('a','1',[1,1],{ok:false,failure:'infrastructure'}),'intention-to-treat'),null);
});

test('clustered bootstrap and paired comparisons are deterministic and exclude controls',()=>{
  const rows=[];
  for(let d=0;d<8;d++){rows.push(row('a',`${d}`,[1,1,1,d%2]));rows.push(row('b',`${d}`,[1,0,0,0]));rows.push(row('speech-act-normalization',`${d}`,[1,1,1,1]));}
  const r1=unitReport(rows,{controlOnly:new Set(['speech-act-normalization'])}),r2=unitReport(rows,{controlOnly:new Set(['speech-act-normalization'])});
  assert.deepEqual(r1,r2);
  const a=r1.strategies.a.eligible;
  assert.equal(a.units,32);assert.equal(a.microMean,28/32);
  assert.ok(a.microCI95[0]<=a.microMean&&a.microMean<=a.microCI95[1]);
  assert.deepEqual(r1.ranked,['a','b']);assert.deepEqual(r1.controlsExcluded,['speech-act-normalization']);
  assert.equal(r1.pairs.length,1);
  const p=r1.pairs[0]['intention-to-treat'];
  assert.equal(p.sharedUnits,32);assert.equal(p.leftOnly,20);assert.equal(p.rightOnly,0);
  assert.ok(p.microDifferenceCI95[0]>0);assert.ok(p.unitSignTest.p<0.001);assert.equal(p.documentSignTest.leftBetter,8);
});

test('sign test and PRNG basics',()=>{
  assert.equal(signTest(0,5),0.0625);assert.equal(signTest(5,10),1);assert.equal(signTest(0,0),null);
  const r=mulberry32(1),s=mulberry32(1);assert.equal(r(),s());
  const empty=pairedUnitComparison(new Map(),new Map());
  assert.equal(empty.sharedUnits,0);assert.equal(empty.microDifference,null);
});
