# Evidence Guided Logic

Public ID: `evidence-guided-logic`. Legacy compatibility ID: `lab-proto`.

This strategy tests whether conservative surface evidence lets a smaller model do less semantic reconstruction. ProtoIR retains exact source tokens/spans, sentence/clause boundaries, mention candidates, negation/quantifier/modality/conditional/temporal/question markers, predicate candidates and surface relations. These are fallible evidence, never asserted as semantic truth.

The original NL plus compact ProtoIR enters one predefined normalization task. Its output is the full Formal IR 0.2, including contextual and ambiguous material. The shared native renderer and standalone compiler expose every supported section. The formalization result keeps full ProtoIR and raw response artifacts so one can inspect which hints helped, misled or merely repeated the source.

The first integration incorrectly narrowed this strategy to Horn facts/rules and lost provenance. That restriction has been removed. Backend incompleteness now appears as coverage metadata rather than discarded representation.

The decisive comparison is Direct Context Logic versus Evidence Guided Logic on the same model. Measure preservation, behavioral controls, prompt/output tokens, and errors by construction. More input tokens do not themselves establish efficiency; improvement with a smaller tier or fewer failures must be demonstrated. Do not treat the shallow heuristic draft as ProtoIR: their design objectives differ.

Recovered documents: [architecture](original/ARCHITECTURE.md), [IR](original/IR.md), [recommended comparison](original/EXPERIMENT_PLAN.md), [integration](original/INTEGRATION.md), [limitations](original/LIMITATIONS.md). Native datasets: 31 development plus 29 original held-out records with their gold IR and queries retained in `eval/`.
