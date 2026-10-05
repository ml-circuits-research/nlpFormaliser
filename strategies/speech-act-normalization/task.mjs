import {buildFormalizationPrompt} from './src/cnl-core.mjs';
import {modelTask} from '../../tools/lib/task-spec.mjs';
export default modelTask(buildFormalizationPrompt(''));
