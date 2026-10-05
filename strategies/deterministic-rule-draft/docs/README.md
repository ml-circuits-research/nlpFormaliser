# Deterministic Rule Draft

Public ID: `deterministic-rule-draft`. Legacy compatibility ID: `lab-heuristic`.

This is the archive's deliberately limited deterministic draft, not its proposed universal solution. It extracts selected types, properties, transitive relations, negation and conditional rules, carries mention state, and attaches a ProtoIR summary. The full draft, ProtoIR and source artifacts are retained for inspection and for the distinct Draft Guided Repair experiment.

The adapter reproduces the original IR and CNL on all 60 supplied lab examples. Low coverage must be reported together with its intended role: draft quality, retained correct atoms, silent errors and the downstream repair's reuse. Evaluating it only on unrelated conversational instructions is not enough to decide whether preprocessing helps.

No new ad-hoc grammar rules were added. Improvements should target recurrent constructions and paraphrase invariance, while preserving evidence on unsupported spans. The native renderer/compiler supports the complete IR; execution coverage is reported separately. Gold semantic queries and UNKNOWN controls remain in the imported evaluation records.

Recovered [architecture](original/ARCHITECTURE.md), [pilot limitations](original/LIMITATIONS.md), [behavior and reuse metrics](original/EVALUATION.md), and [experiment plan](original/EXPERIMENT_PLAN.md).
