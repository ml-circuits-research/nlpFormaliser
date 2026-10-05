# Evaluation data

`semantic_cases.jsonl`: 30 hand-authored mini-discourses with mixed assertions/questions and reference MicroIR. Tags cover negation, quantifier scope, only-if/unless, modality, attribution, time/order, quantities, coreference, causality, unknown status, and wh-questions.

`judge_pairs.jsonl`: 11 pairs where `goodWire` preserves the text and `badWire` contains one deliberate semantic defect. These are used to test whether an LLM judge actually discriminates semantic fidelity rather than approving fluent-looking CNL.

The reference IR is a regression target, not a claim that it is the only valid formalization.
