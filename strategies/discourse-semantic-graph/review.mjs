import {taskLLM} from '../../tools/lib/pworker.mjs';
import {reviewConversation} from './index.mjs';

export function createDiscourseReviewer({tier = 'good', transport = {}} = {}) {
  const {llm} = taskLLM({
    ...transport, file: new URL('./judge-task.mjs', import.meta.url), tier,
  });
  return (conversation, options = {}) => reviewConversation(conversation, {...options, llm});
}
