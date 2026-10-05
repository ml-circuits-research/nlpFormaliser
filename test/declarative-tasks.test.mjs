import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {loadTask} from '../../Ploinky-Worker/lib/pworker/task.mjs';
import {ROOT} from '../tools/lib/strategies.mjs';
import {modelTask,assertDeclarativeTask} from '../tools/lib/task-spec.mjs';
import {taskLLM} from '../tools/lib/pworker.mjs';

test('every predefined NLP task is JSON-compatible phased data, never a function task',async()=>{
  const files=[];
  function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){if(e.name.startsWith('_'))continue;const p=join(dir,e.name);if(e.isDirectory())walk(p);else if(/(?:^|-)task\.mjs$/.test(e.name))files.push(p);}}
  walk(join(ROOT,'strategies'));
  files.push(join(ROOT,'tasks/judge-direct.mjs'),join(ROOT,'tasks/judge-bidirectional.mjs'));
  assert.ok(files.length>=10);
  for(const file of files){const task=assertDeclarativeTask(await loadTask(file));assert.deepEqual(JSON.parse(JSON.stringify(task)),task,file);}
});
test('legacy lambdas are rejected, but callbacks inside a statement block are not task lambdas',()=>{
  const task=modelTask('test');
  assert.throws(()=>assertDeclarativeTask({...task,begin:{...task.begin,code:()=>null}}),/JSON/);
  assert.throws(()=>assertDeclarativeTask({...task,begin:{...task.begin,code:'result => result'}}),/legacy/);
  assert.doesNotThrow(()=>assertDeclarativeTask({...task,begin:{...task.begin,code:'this.end(result.map(x => x.id))'}}));
});
test('explicit model selection still executes via a predefined worker phase and proxy client',async()=>{
  let request;
  const {llm}=taskLLM({file:join(ROOT,'tasks/judge-direct.mjs'),model:'openference/GPT-OSS-120B',client:{chat:async r=>{request=r;return {ok:true,text:'{}'};}}});
  const {SYSTEMS}=await import('../tools/lib/judge.mjs');
  await llm(SYSTEMS.direct,'test');
  assert.equal(request.upstream,'openference');assert.equal(request.model,'GPT-OSS-120B');assert.equal(request.tier,undefined);
});
