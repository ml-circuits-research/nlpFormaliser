#!/usr/bin/env node
// Judge calibration on the fixed control set (tools/lib/judge-controls.mjs):
// long NL edits and long native-CNL controls of both polarities on a dedicated
// control document, short rubric controls and the eleven archive
// scope-corruption pairs. No evaluation document is used as a control.
import {parseArgs} from 'node:util';
import {mkdirSync,writeFileSync,appendFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT} from './lib/strategies.mjs';
import {taskLLM,digest} from './lib/pworker.mjs';
import {makeJudge,SYSTEMS} from './lib/judge.mjs';
import {makeUnitJudge,UNIT_SYSTEM} from './lib/unit-judge.mjs';
import {judgeControls} from './lib/judge-controls.mjs';
import {controlMetrics,controlGate} from './lib/control-gate.mjs';
import {positive} from './lib/cli.mjs';
const {values:o}=parseArgs({options:{tier:{type:'string',default:'medium'},model:{type:'string'},mode:{type:'string',default:'bidirectional'},
  'batch-size':{type:'string',default:'all'},concurrency:{type:'string'},'max-tokens':{type:'string',default:'32000'},'timeout-ms':{type:'string',default:'600000'},'unit-judge':{type:'string',default:'on'},id:{type:'string'}}});
if(!SYSTEMS[o.mode])throw new Error('Invalid judge mode');
// Default: the whole control set is one batched request per judge task (document verdicts, then unit verdicts).
const controls=judgeControls();
const batchSize=o['batch-size']==='all'?controls.length:positive(o['batch-size'],'batch-size');
const concurrency=o.concurrency?positive(o.concurrency,'concurrency'):batchSize>1?controls.length:2,maxTokens=positive(o['max-tokens'],'max-tokens'),timeoutMs=positive(o['timeout-ms'],'timeout-ms');
const id=o.id??`judge-${o.tier}-${o.mode}-${Date.now()}`;
if(!/^[\w-]+$/.test(id))throw new Error('Invalid experiment ID');
const experiments=join(ROOT,'docs','experiments'),out=join(experiments,id);
if(existsSync(out))throw new Error('Experiment already exists');
mkdirSync(experiments,{recursive:true});mkdirSync(out);
const calls=[];
const bridge=file=>taskLLM({file,tier:o.tier,model:o.model,batchSize,maxTokens,timeoutMs,cache:'off',onCall:c=>{calls.push(c);appendFileSync(join(out,'calls.jsonl'),JSON.stringify(c)+'\n');}});
const doc=bridge(join(ROOT,'tasks',`judge-${o.mode}.mjs`)),units=bridge(join(ROOT,'tasks','judge-units.mjs'));
const manifest={id,options:o,controls,controlsSha256:digest(controls),rubricSha256:digest(SYSTEMS[o.mode]),unitRubricSha256:digest(UNIT_SYSTEM),
  proxy:await doc.client.health(),task:'judge-'+o.mode};
writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2));
const judge=makeJudge(doc.llm,o.mode),unitJudge=makeUnitJudge(units.llm),rows=[];
for(let i=0;i<controls.length;i+=concurrency) {
  rows.push(...await Promise.all(controls.slice(i,i+concurrency).map(async c=>({...c,verdict:await judge(c.original,c.cnl),
    ...(o['unit-judge']==='on'&&c.units?{unitVerdict:await unitJudge(c.original,c.units,c.cnl)}:{})}))));
}
writeFileSync(join(out,'items.jsonl'),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
const metrics=controlMetrics(rows);
const summary={id,n:rows.length,correct:rows.filter(r=>r.verdict.equivalent===r.expected).length,...metrics,gate:controlGate(metrics),requests:calls.length};
writeFileSync(join(out,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
