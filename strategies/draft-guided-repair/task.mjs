import {FORMAL_IR_SPEC} from '../lab-shared/src/strategies/direct-llm.mjs';
import {modelTask} from '../../tools/lib/task-spec.mjs';
export default modelTask(FORMAL_IR_SPEC+'\nYou are a semantic program repairer. The original NL is authoritative. The draft is fallible evidence. Preserve every correct item when possible; delete unsupported items; fix wrong roles, polarity, scope and reference; add omitted semantics. If the NL is genuinely ambiguous, preserve the ambiguity rather than guessing.');
