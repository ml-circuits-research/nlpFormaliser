import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {loadSet} from '../tools/lib/evalset.mjs';
import {ROOT} from '../tools/lib/strategies.mjs';
import {selectStage,calibrationIds} from '../tools/lib/selection.mjs';
import {judgeControls,loadControlDocument,nativeCNLControls,corruptFormula,CORRUPTIONS} from '../tools/lib/judge-controls.mjs';
import {fromWire} from '../strategies/compact-scope-logic/src/wire.mjs';
import {sourceUnits} from '../tools/lib/units.mjs';
import {controlMetrics,controlGate} from '../tools/lib/control-gate.mjs';

const consolidated=loadSet('consolidated');

test('calibration cases never enter development or heldout partitions',()=>{
  const calibration=calibrationIds(consolidated);
  assert.deepEqual(calibration,['01','02','03','04','05'].map(n=>`consolidated/base/${n}-mixed-discussion`));
  const dev=selectStage(consolidated,'development').cases.map(c=>c.id),held=selectStage(consolidated,'heldout').cases.map(c=>c.id);
  assert.ok(dev.length>0&&held.length>0);
  for(const id of calibration){assert.ok(!dev.includes(id),id);assert.ok(!held.includes(id),id);}
  assert.deepEqual(selectStage(consolidated,'calibration').cases.map(c=>c.id),calibration);
  assert.ok(held.every(id=>id.startsWith('consolidated/lab-heldout/')));
  assert.equal(new Set([...dev,...held,...calibration]).size,consolidated.length);
});

test('judge controls use a dedicated document outside every corpus and selection',()=>{
  const doc=loadControlDocument();
  const selection=JSON.parse(readFileSync(join(ROOT,'docs/evaluation/selections/consolidated-first10.json'),'utf8'));
  assert.ok(!selection.ids.includes(doc.id));
  for(const row of consolidated)for(const unit of doc.units)assert.ok(!row.text.includes(unit.text),`${unit.id} appears in ${row.id}`);
  const evaluated=new Set(consolidated.map(r=>r.text));
  for(const c of judgeControls())assert.ok(!evaluated.has(c.original),c.id);
  // The control document's own sentence split reproduces its unit ids.
  assert.deepEqual(sourceUnits({text:doc.text}).map(u=>[u.id,u.text]),doc.units.map(u=>[u.id,u.text]));
});

test('control labels: ordered-argument positive is existential; the opaque constant is negative',()=>{
  const byId=new Map(judgeControls().map(c=>[c.id,c]));
  const positive=byId.get('formal-ordered-arguments');
  assert.equal(positive.expected,true);assert.match(positive.cnl,/there exists/);assert.match(positive.cnl,/“printer” holds for x/);
  const constant=byId.get('constant-for-indefinite');
  assert.equal(constant.expected,false);assert.doesNotMatch(constant.cnl,/there exists/);
  const archive=[...byId.values()].filter(c=>c.family==='archive-pair');
  assert.equal(archive.length,22);
  assert.equal(archive.filter(c=>c.expected===false).length,11);
});

test('long native-CNL controls: gold positives and one corrupted unit per deterministic corruption',()=>{
  const controls=nativeCNLControls(),gold=controls.find(c=>c.id==='long-cnl-gold');
  assert.equal(gold.expected,true);
  assert.deepEqual(Object.keys(CORRUPTIONS).sort(),['argument-swap','attribution-as-fact','negation-scope-move','quantifier-drop','request-as-assertion']);
  const goldLines=gold.cnl.split('\n');
  for(const name of Object.keys(CORRUPTIONS)) {
    const c=controls.find(x=>x.id===`long-cnl-${name}`);
    assert.equal(c.expected,false);
    assert.equal(Object.values(c.unitExpected).filter(v=>v===false).length,1);
    const changed=c.cnl.split('\n').filter((line,i)=>line!==goldLines[i]);
    assert.equal(changed.length,1,name);
    assert.ok(changed[0].startsWith(`Statement ${Number(c.corruptedUnit.slice(1))}:`),name);
  }
  assert.equal(corruptFormula(fromWire('$.owns("ada","book")'),'request-as-assertion'),null);
});

test('control metrics report sensitivity/specificity and the gate flags any false accept',()=>{
  const rows=[
    {id:'p1',expected:true,family:'f',verdict:{status:'judged',equivalent:true}},
    {id:'n1',expected:false,family:'f',verdict:{status:'judged',equivalent:false},unitExpected:{u01:true,u02:false},unitVerdict:{status:'judged',units:[{id:'u01',preserved:true},{id:'u02',preserved:false}]}},
    {id:'n2',expected:false,family:'f',verdict:{status:'judged',equivalent:true}},
  ];
  const m=controlMetrics(rows);
  assert.equal(m.sensitivity.correct,1);assert.equal(m.sensitivity.n,2);assert.equal(m.specificity.rate,1);
  assert.deepEqual(m.falseAccepts,['n2']);assert.equal(m.unitLevel.tp,1);assert.equal(m.unitLevel.tn,1);
  const gate=controlGate(m,{minSensitivity:0.5,minSpecificity:0.5});
  assert.equal(gate.passed,false);assert.match(gate.reasons[0],/false accepts/);
  assert.equal(controlGate(controlMetrics(rows.slice(0,2))).passed,true);
});
