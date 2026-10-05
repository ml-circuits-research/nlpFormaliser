# Draft Guided Repair

Public ID/folder: `draft-guided-repair`.

This is the lab archive's original heuristic+repair strategy, restored as a separate experiment. The deterministic draft and conservative ProtoIR accompany the authoritative NL in one model task. Correct draft items should survive; wrong roles, polarity, reference and scope can be changed; missing content can be added. The full final IR and original draft are retained.

`reuseMetrics` reports retained/deleted/added items, draft retention and final reuse. A high semantic score with low reuse means regeneration, not evidence that drafting reduced the semantic work. Gold corruption tests and no-op tests distinguish localized repair from unbounded rewriting.

This strategy is excluded from the default first-pass registry and requires `options.allowRepair=true`. Its task file exists and the adapter can be tested with a stub Pworker transport, but no new repair experiment was run during fidelity restoration.

Recovered [repair experiment plan](original/EXPERIMENT_PLAN.md), [evaluation](original/EVALUATION.md), [architecture](original/ARCHITECTURE.md), and [IR](original/IR.md).
