# Event Role Logic

Public ID: `event-role-logic`. Legacy compatibility ID: `evl`.

EVL constructs reified event/role facts with entity types, quantification, negation, modality, tense, scope, links and conversational acts. A checker validates the vocabulary and references, and deterministic interpreters derive CNL, a FOL reading and question answers. The existing implementation and parity fixtures remain intact.

The archive-style internal check/judge/refine loop remains available in `src/loop.mjs`; first-pass defaults explicitly set zero rounds. Refined candidates must retain their traces and be evaluated separately. Raw Prolog facts are a reified representation, not proof that an ordinary Prolog engine automatically understands the EVL operators.

`pipeline.mjs` routes original generation, internal judging and feedback-based refinement to separate predefined worker tasks. The returned native trace is retained. Nonzero rounds require `allowRepair`; no repair run was launched during restoration.

The previous batch-output truncation was an execution-budget failure, not evidence that event reification is weak. Future comparison must separate prompt size, event-role correctness, cross-reference integrity, renderer coverage and task budget.

Recovered local [semantic specification](original/evl-spec.md) and [original prompts](original/prompts.json). Native checker, renderer, FOL and question-answering tests remain in `test/`.
