import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Pworker,loadTask} from '../../../Ploinky-Worker/lib/pworker/task.mjs';
import {createPworkerClient} from '../../../Ploinky-Worker/lib/client.mjs';
import {INPUT_SUFFIX,assertDeclarativeTask} from './task-spec.mjs';
export const digest=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');

// Independent callers are collected into bounded waves. Each wave loads the
// predefined task file and explicitly enqueues/flushes it through Pworker.
export function taskLLM({file,tier='small',model=null,batchSize=5,cache='use',maxTokens=8000,timeoutMs=null,
  purpose='job:nlpformaliser',onCall=()=>{},onTask=()=>{},client=null,offline=false}={}) {
  if(!file) throw new Error('A predefined .mjs task file is required');
  if(!Number.isSafeInteger(batchSize)||batchSize<1)throw new Error('Invalid batch size');
  const taskFile=file instanceof URL?fileURLToPath(file):file;
  const remote=client??createPworkerClient({purpose,autostart:true});
  const target=model?model.match(/^([^/]+)\/(.+)$/):null;
  if(model&&!target)throw new Error('Explicit model must be upstream/model');
  let queue=[],scheduled=false,serial=0;
  const wrapped=Object.fromEntries(['chat','json'].map(method=>[method,async request=>{
    const id=`call-${++serial}`,started=new Date().toISOString();
    const routed=target?{...request,tier:undefined,upstream:target[1],model:target[2]}:request;
    const result=await remote[method](routed);
    onCall({id,started,taskFile,kind:method,request:routed,result});
    return result;
  }]));
  async function flush() {
    scheduled=false;
    const pending=queue;queue=[];
    try {
      const base=assertDeclarativeTask(await loadTask(taskFile));
      const waveSize=batchSize===1?pending.length:batchSize;
      for(let start=0;start<pending.length;start+=waveSize) {
        const chunk=pending.slice(start,start+waveSize);
        const worker=new Pworker({client:wrapped,config:{batching:{[tier]:{enabled:batchSize>1}}},onProgress:onTask});
        for(const [i,p] of chunk.entries()) {
          if(base.begin.template!==p.system+INPUT_SUFFIX) throw new Error(`Prompt does not match predefined task ${taskFile}`);
          const task=structuredClone(base);
          task.begin.tier=tier;task.begin.batch=batchSize>1;
          task.begin.request={...task.begin.request,maxTokens,cache,...(timeoutMs!==null?{timeoutMs}:{} )};
          worker.enqueue(task,{input:p.prompt},{id:`t-${digest([p.system,p.prompt,i]).slice(0,24)}`});
        }
        const results=await worker.flush();
        results.forEach((r,i)=>r.ok?chunk[i].resolve(r.value):chunk[i].reject(new Error(r.error)));
      }
    } catch(e) {pending.forEach(p=>p.reject(e));}
  }
  const llm=(system,prompt)=>{
    if(offline) return Promise.reject(new Error('LLM disabled for offline experiment'));
    return new Promise((resolve,reject)=>{
      queue.push({system,prompt,resolve,reject});
      if(!scheduled){scheduled=true;setImmediate(()=>flush());}
    });
  };
  return {llm,client:remote};
}
