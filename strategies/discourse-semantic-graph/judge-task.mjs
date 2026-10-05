import {judgeSystemPrompt} from './src/judge.mjs';
import {modelTask} from '../../tools/lib/task-spec.mjs';
export default modelTask(judgeSystemPrompt(),'medium');
