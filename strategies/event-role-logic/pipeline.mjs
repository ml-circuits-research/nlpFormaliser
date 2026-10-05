import {PROMPTS, formalizeWithLoop} from './src/loop.mjs';
import {taskLLM} from '../../tools/lib/pworker.mjs';

export function createEventPipeline({
  formalizerTier = 'medium',
  judgeTier = 'good',
  repairTier = formalizerTier,
  rounds = 0,
  allowRepair = false,
  transport = {},
} = {}) {
  if (!Number.isSafeInteger(rounds) || rounds < 0) throw new Error('Invalid refinement budget');
  if (rounds > 0 && !allowRepair) throw new Error('Refinement requires explicit allowRepair');
  const bridge = (file, tier) => taskLLM({
    ...transport, file: new URL(file, import.meta.url), tier,
  }).llm;
  const formalize = bridge('./task.mjs', formalizerTier);
  const judge = bridge('./judge-task.mjs', judgeTier);
  const repair = bridge('./repair-task.mjs', repairTier);
  return {
    async run(text, {log} = {}) {
      let generations = 0;
      return formalizeWithLoop(text, {
        rounds,
        log,
        llm(system, prompt) {
          if (system === PROMPTS.internalJudgeSystem) return judge(system, prompt);
          if (system !== PROMPTS.formalizeSystem) throw new Error('Unknown EVL operation');
          return (generations++ === 0 ? formalize : repair)(system, prompt);
        },
      });
    },
  };
}
