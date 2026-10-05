import {taskLLM} from '../../tools/lib/pworker.mjs';
import {judgeRepeated} from './src/judge.mjs';

// Native coverage/faithfulness/scope/coreference instrument, kept separate from
// the common binary judge so its research measurements remain available.
export function createNativeJudge({tier = 'good', transport = {}} = {}) {
  const {llm} = taskLLM({
    ...transport, file: new URL('./judge-task.mjs', import.meta.url), tier,
  });
  const client = {complete: ({system, user}) => llm(system, user)};
  return ({nl, cnl, runs = 1}) => {
    if (!Number.isSafeInteger(runs) || runs < 1) throw new Error('Invalid judge repetition count');
    return judgeRepeated({client, nl, cnl, runs});
  };
}
