#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {mkdirSync,writeFileSync,appendFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT} from './lib/strategies.mjs';
import {taskLLM} from './lib/pworker.mjs';
import {makeJudge} from './lib/judge.mjs';
import {positive} from './lib/cli.mjs';
const {values:o}=parseArgs({options:{tier:{type:'string',default:'medium'},mode:{type:'string',default:'bidirectional'},'batch-size':{type:'string',default:'5'},id:{type:'string'}}});
const pairs=[
  ['identity','Ada owns the red car.','Ada owns the red car.',true],
  ['synonym','Ada bought a book.','Ada purchased a book.',true],
  ['negation','Ada did not approve the report.','Ada approved the report.',false],
  ['scope','Not every reviewer approved the report.','No reviewer approved the report.',false],
  ['roles','Ada sent the report to Bob.','Bob sent the report to Ada.',false],
  ['modal','Ada may leave.','Ada must leave.',false],
  ['condition','If it rains, Ada stays home.','Ada stays home.',false],
  ['question','Who approved the report?','Someone approved the report.',false],
  ['attribution','Bob believes the door is open.','The door is open.',false],
  ['conjunction-order','Ada reads and Bob writes.','Bob writes and Ada reads.',true],
];
const id=o.id??`judge-${o.tier}-${o.mode}-${Date.now()}`;
if(!/^[\w-]+$/.test(id))throw new Error('Invalid experiment ID');
const out=join(ROOT,'docs','experiments',id);if(existsSync(out))throw new Error('Experiment already exists');mkdirSync(out,{recursive:true});
const calls=[];
const {llm,client}=taskLLM({file:join(ROOT,'tasks',`judge-${o.mode}.mjs`),tier:o.tier,batchSize:positive(o['batch-size'],'batch-size'),cache:'off',onCall:c=>{calls.push(c);appendFileSync(join(out,'calls.jsonl'),JSON.stringify(c)+'\n');}});
const manifest={id,options:o,pairs,proxy:await client.health(),task:'judge-'+o.mode};writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2));
const judge=makeJudge(llm,o.mode),rows=[];
for(let i=0;i<pairs.length;i+=Number(o['batch-size'])) {
  rows.push(...await Promise.all(pairs.slice(i,i+Number(o['batch-size'])).map(async([id,original,cnl,expected])=>({id,original,cnl,expected,verdict:await judge(original,cnl)}))));
}
writeFileSync(join(out,'items.jsonl'),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
const summary={id,n:rows.length,correct:rows.filter(r=>r.verdict.equivalent===r.expected).length,falseAccepts:rows.filter(r=>!r.expected&&r.verdict.equivalent===true).map(r=>r.id),falseRejects:rows.filter(r=>r.expected&&r.verdict.equivalent===false).map(r=>r.id),errors:rows.filter(r=>r.verdict.status!=='judged').map(r=>r.id),requests:calls.length};
writeFileSync(join(out,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
