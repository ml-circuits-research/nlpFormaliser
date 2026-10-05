// Single source of truth for strategy task templates. Pworker refuses a prompt
// that differs from the predefined task template, and task files must be static
// JSON, so the templates are regenerated from the strategy prompt constants with
// `node tools/sync-task-templates.mjs` and verified by the test suite.
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {INPUT_SUFFIX} from './task-spec.mjs';

const ROOT=new URL('../../',import.meta.url).pathname;

export async function strategyTaskTemplates() {
  const {FORMAL_IR_SPEC}=await import('../../strategies/lab-shared/src/strategies/direct-llm.mjs');
  const {PROTO_SYSTEM}=await import('../../strategies/lab-shared/src/strategies/proto-llm.mjs');
  const {REPAIR_SYSTEM:LAB_REPAIR}=await import('../../strategies/lab-shared/src/repairer.mjs');
  const micro=await import('../../strategies/compact-scope-logic/src/prompts.mjs');
  const {SYSTEM:EXPLICIT}=await import('../../strategies/explicit-scope-logic/index.mjs');
  const {PROMPTS}=await import('../../strategies/event-role-logic/src/loop.mjs');
  const {SYSTEM:SPEECH}=await import('../../strategies/speech-act-normalization/index.mjs');
  return [
    ['strategies/direct-context-logic/task.mjs',FORMAL_IR_SPEC],
    ['strategies/evidence-guided-logic/task.mjs',PROTO_SYSTEM],
    ['strategies/draft-guided-repair/task.mjs',LAB_REPAIR],
    ['strategies/compact-scope-logic/task.mjs',micro.FORMALIZE_SYSTEM],
    ['strategies/compact-scope-logic/repair-task.mjs',micro.REPAIR_SYSTEM],
    ['strategies/compact-scope-logic/judge-task.mjs',micro.JUDGE_SYSTEM],
    ['strategies/explicit-scope-logic/task.mjs',EXPLICIT],
    ['strategies/event-role-logic/task.mjs',PROMPTS.formalizeSystem],
    ['strategies/event-role-logic/repair-task.mjs',PROMPTS.formalizeSystem],
    ['strategies/event-role-logic/judge-task.mjs',PROMPTS.internalJudgeSystem],
    ['strategies/speech-act-normalization/task.mjs',SPEECH],
  ].map(([file,system])=>({file,template:system+INPUT_SUFFIX}));
}

export function readTask(file) {
  const source=readFileSync(join(ROOT,file),'utf8').trim();
  return JSON.parse(source.slice('export default '.length).replace(/;\s*$/,''));
}

export async function syncTaskTemplates({write=false}={}) {
  const stale=[];
  for(const {file,template} of await strategyTaskTemplates()) {
    const task=readTask(file);
    if(task.begin.template===template)continue;
    stale.push(file);
    if(write){task.begin.template=template;writeFileSync(join(ROOT,file),`export default ${JSON.stringify(task,null,2)};\n`);}
  }
  return stale;
}
