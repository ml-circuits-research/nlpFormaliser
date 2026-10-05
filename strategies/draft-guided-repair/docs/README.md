# Draft Guided Repair

Public ID/folder: `draft-guided-repair`.

This is the lab archive's original heuristic+repair strategy, restored as a separate experiment. The deterministic draft and conservative ProtoIR accompany the authoritative NL in one model task. Correct draft items should survive; wrong roles, polarity, reference and scope can be changed; missing content can be added. The full final IR and original draft are retained.

`reuseMetrics` reports retained/deleted/added items, draft retention and final reuse. A high semantic score with low reuse means regeneration, not evidence that drafting reduced the semantic work. Gold corruption tests and no-op tests distinguish localized repair from unbounded rewriting.

This strategy is excluded from the default first-pass registry and requires `options.allowRepair=true`. Its task file exists and the adapter can be tested with a stub Pworker transport, but no new repair experiment was run during fidelity restoration.

Recovered [repair experiment plan](original/EXPERIMENT_PLAN.md), [evaluation](original/EVALUATION.md), [architecture](original/ARCHITECTURE.md), and [IR](original/IR.md).

## Symbol diagnostics in repair

The repair prompt receives the deterministic symbol-length violations of the draft ("Symbol violations to fix") and is asked to decompose them. It uses the Formal IR prompt v2 of [Direct Context Logic](../../direct-context-logic/docs/README.md). Every symbol (predicate, relation, concept, entity/constant, context id, label, template words) has at most 3 words, counted on underscores, hyphens, spaces, digit and camelCase boundaries (`tools/lib/symbols.mjs`); quoted proper names have at most 3 tokens. The prompt states the rule with a good and a bad example and asks to decompose long ideas; the audit makes any violation ineligible (category `symbolLength`).
