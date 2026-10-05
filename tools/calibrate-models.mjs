#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {readFileSync,existsSync,mkdirSync,writeFileSync,appendFileSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT} from './lib/strategies.mjs';
import {loadSet} from './lib/evalset.mjs';
import {taskLLM,digest} from './lib/pworker.mjs';
import {makeJudge,SYSTEMS} from './lib/judge.mjs';
import {consolidatedJudgeControls} from './lib/judge-controls.mjs';
const {values:o}=parseArgs({options:{model:{type:'string'},id:{type:'string'},mode:{type:'string',default:'bidirectional'},'batch-size':{type:'string',default:'1'}}});
if(!o.model||!/^[\w-]+$/.test(o.id??''))throw new Error('Provide --model upstream/model --id experiment');
if(!SYSTEMS[o.mode])throw new Error('Invalid judge mode');
const batchSize=Number(o['batch-size']);if(!Number.isSafeInteger(batchSize)||batchSize<1)throw new Error('Invalid batch size');
const out=join(ROOT,'docs','experiments',o.id);
if(existsSync(out))throw new Error('Experiment already exists');
const controls=consolidatedJudgeControls(loadSet('consolidated'));
mkdirSync(out,{recursive:true});
const save=(file,value)=>writeFileSync(join(out,file),JSON.stringify(value,null,2)+'\n');
const calls=[];
const bridge=taskLLM({file:join(ROOT,'tasks',`judge-${o.mode}.mjs`),model:o.model,tier:'judge-calibration',batchSize,
  maxTokens:6000,timeoutMs:90000,cache:'off',purpose:`nlp-judge-calibration:${o.id}`,
  onCall:call=>{calls.push(call);appendFileSync(join(out,'calls.jsonl'),JSON.stringify(call)+'\n');},
  onTask:task=>appendFileSync(join(out,'tasks.jsonl'),JSON.stringify(task)+'\n')});
const catalog=await bridge.client.providerModels('openference');
const target=catalog.data.find(m=>m.id===o.model.slice(o.model.indexOf('/')+1));
save('manifest.json',{id:o.id,options:o,started:new Date().toISOString(),model:target,controls,
  rubric:SYSTEMS[o.mode],rubricSha256:digest(SYSTEMS[o.mode]),controlsSha256:digest(controls),
  sourceHashes:Object.fromEntries(['tools/lib/judge-controls.mjs','tools/lib/judge.mjs','tools/lib/pworker.mjs','tools/calibrate-models.mjs'].map(p=>[p,digest(readFileSync(join(ROOT,p),'utf8'))])),
  repairs:0,cache:'off',timeoutMs:90000,maxTokens:6000,proxy:await bridge.client.health()});
const judge=makeJudge(bridge.llm,o.mode),rows=[];
for(let i=0;i<controls.length;i+=2) {
  const wave=await Promise.all(controls.slice(i,i+2).map(async c=>({...c,verdict:await judge(c.original,c.cnl)})));
  for(const row of wave){rows.push(row);appendFileSync(join(out,'items.jsonl'),JSON.stringify(row)+'\n');console.error(`${o.model} ${row.id}: expected=${row.expected} actual=${row.verdict.equivalent} ${row.verdict.status}`);}
  // Do not spend a whole corpus retrying an unavailable provider/model.
  if(i===0&&wave.every(r=>r.verdict.status==='judge_error'))break;
}
const labeled=rows.filter(r=>r.verdict.status==='judged'&&r.verdict.equivalent!==null);
const summary={id:o.id,model:o.model,finished:new Date().toISOString(),n:controls.length,attempted:rows.length,
  correct:rows.filter(r=>r.verdict.status==='judged'&&r.expected===r.verdict.equivalent).length,
  falseAccepts:rows.filter(r=>!r.expected&&r.verdict.equivalent===true).map(r=>r.id),
  falseRejects:rows.filter(r=>r.expected&&r.verdict.equivalent===false).map(r=>r.id),
  uncertain:rows.filter(r=>r.verdict.status==='judged'&&r.verdict.equivalent===null).map(r=>r.id),
  errors:rows.filter(r=>r.verdict.status==='judge_error').map(r=>r.id),labeled:labeled.length,
  requests:calls.length,served:[...new Set(calls.map(c=>c.result.served).filter(Boolean))],
  inputTokens:calls.reduce((n,c)=>n+(c.result.usage?.in??0),0),outputTokens:calls.reduce((n,c)=>n+(c.result.usage?.out??0),0),
  knownCredits:calls.reduce((n,c)=>n+(c.result.credits??0),0),unknownCreditRequests:calls.filter(c=>c.result.credits==null).length,
  requestMs:calls.map(c=>c.result.ms),
  estimatedCatalogUsd:calls.reduce((n,c)=>n+(c.result.usage?.in??0)*Number(target?.pricing?.prompt??0)+(c.result.usage?.out??0)*Number(target?.pricing?.completion??0),0),
  costNote:'Catalog token-price estimate is not the subscription charge. Credits are provider-reported; missing costs are unknown.',
};
save('summary.json',summary);console.log(JSON.stringify(summary,null,2));
