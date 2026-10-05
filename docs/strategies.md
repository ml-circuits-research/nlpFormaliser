# Research strategy map

The current implementations preserve the source architectures. Early restricted adapters and their scores are superseded as comparisons of the original strategies. Public names and folders describe the mechanism; old CLI IDs remain compatibility aliases so historical artifacts remain interpretable.

| Public name / ID | Native source | Distinguishing mechanism | Relevant examples | Documentation |
|---|---|---|---|---|
| Event Role Logic / `event-role-logic` | EVL research | reified events, roles, scope, acts; deterministic interpreter | events, quantification, questions, multiple roles | [docs](../strategies/event-role-logic/docs/README.md) |
| Compact Scope Logic / `compact-scope-logic` | MicroIR v2 | open predicates plus nested propositions and explicit logical binders | 30 scoped references; 11 corrupted pairs | [docs](../strategies/compact-scope-logic/docs/README.md) |
| Explicit Scope Logic / `explicit-scope-logic` | controlled MicroIR prompt variant | same complete scoped IR, explicit concrete grammar and structural examples; no repair | matched development grammar/batching experiments 018–019 | [docs](../strategies/explicit-scope-logic/docs/README.md) |
| Direct Context Logic / `direct-context-logic` | Formalizer Lab | direct NL→complete facts/rules/contexts/query IR | 31 development + 29 source-heldout lab records | [docs](../strategies/direct-context-logic/docs/README.md) |
| Evidence Guided Logic / `evidence-guided-logic` | Formalizer Lab | exact-span ProtoIR evidence→same complete IR | same lab records; coreference, modality, conditions | [docs](../strategies/evidence-guided-logic/docs/README.md) |
| Deterministic Rule Draft / `deterministic-rule-draft` | Formalizer Lab | original grammar draft and evidence, no model | draft/behavior/reuse baselines on lab data | [docs](../strategies/deterministic-rule-draft/docs/README.md) |
| Discourse Semantic Graph / `discourse-semantic-graph` | nl2cnl v1 | stateful symbolic graph + audit/risk selection/batched review | connected 30-turn conversation | [docs](../strategies/discourse-semantic-graph/docs/README.md) |
| Speech Act Normalization / `speech-act-normalization` | CNL-Core | preserve intent/scope in language before choosing formal ontology | 50 regression records + multiline sample | [docs](../strategies/speech-act-normalization/docs/README.md) |
| Draft Guided Repair / `draft-guided-repair` | Formalizer Lab | authoritative NL + ProtoIR + draft; measure retained semantics | controlled corruptions and no-op cases | [docs](../strategies/draft-guided-repair/docs/README.md) |

Repair is explicit and excluded from first-pass runs. Speech Act Normalization is a research baseline for a future compiler stage, not mislabeled as logical inference. Deterministic Rule Draft is intentionally limited in the archive; it should be judged as a component rather than mistaken for the entire evidence-guided architecture.

## Representation is not backend coverage

The lab stores contexts, ambiguities and external predicates that its small Horn engine cannot execute. The discourse archive explicitly defers the compiler. MicroIR permits nested propositions that need intensional semantics. Preserving these structures is required. Omitting them to make the backend appear complete is invalid. Backend gaps belong in `reasoning.coverage`, not in destructive normalization.

Conversely, a readable gloss is not executable semantics. The native rendering, artifact fields, metadata diagnostics, behavioral tests and independent judge must be examined together. A successful CNL round trip alone cannot establish reasoning correctness.

## Evidence needed before selecting extensions

- Compare Direct Context Logic with Evidence Guided Logic at equal model and decoding settings; measure whether extra deterministic evidence improves fidelity or supports a cheaper model.
- Compare Compact Scope Logic on quantifier/negation/nested-proposition problems against Event Role Logic on event/role/discourse problems, using the same semantic obligations but representation-specific behavioral probes.
- Measure Discourse Semantic Graph on connected turns and audit sampling policies, including silent errors in apparently safe turns. Isolated sentences omit its central design feature.
- Evaluate Draft Guided Repair separately with corruption recovery, no-op preservation and reuse; stronger final output with near-zero reuse is regeneration.
- Treat Speech Act Normalization→formal compilation as a new two-stage candidate. Measure both intermediate and final loss rather than assuming normalization is a free improvement.

No replacement winner is selected from the old five-case runs. See [restoration audit](restoration-audit.md) and [evaluation corpus](../eval/README.md).
