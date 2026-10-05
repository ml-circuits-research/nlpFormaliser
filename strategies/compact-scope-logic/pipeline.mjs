import {createPipeline} from './src/pipeline.mjs';
import {taskLLM} from '../../tools/lib/pworker.mjs';
// The original best-candidate pipeline is preserved, with task-backed transports.
export function createResearchPipeline({formalizerTier='medium',judgeTier='good',repairTier=formalizerTier,maxRepairs=0,allowRepair=false,transport={}}={}) {
  const checkBudget = (budget) => {
    if (!Number.isSafeInteger(budget) || budget < 0) throw new Error('Invalid repair budget');
    if (budget > 0 && !allowRepair) throw new Error('Repair experiments must explicitly set allowRepair');
  };
  checkBudget(maxRepairs);
  const adapter=(file,tier)=>{const {llm}=taskLLM({...transport,file:new URL(file,import.meta.url),tier});return ({system,user})=>llm(system,user);};
  const pipeline = createPipeline({formalizer:adapter('./task.mjs',formalizerTier),judge:adapter('./judge-task.mjs',judgeTier),repairer:adapter('./repair-task.mjs',repairTier),maxRepairs});
  return {...pipeline, run(text, options = {}) {
    checkBudget(options.maxRepairs ?? maxRepairs);
    return pipeline.run(text, options);
  }};
}
