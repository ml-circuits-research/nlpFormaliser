import {FORMAL_IR_SPEC} from '../lab-shared/src/strategies/direct-llm.mjs';
import {modelTask} from '../../tools/lib/task-spec.mjs';
export default modelTask(FORMAL_IR_SPEC+'\nYou are a semantic normalizer. The ProtoIR is conservative surface evidence: it may contain false-positive candidates, but its spans and source text are authoritative evidence. Convert the meaning into Formal IR without inventing unsupported facts.');
