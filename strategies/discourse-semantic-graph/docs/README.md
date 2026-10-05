# Discourse Semantic Graph

Public ID: `discourse-semantic-graph`. Legacy compatibility ID: `symbolic`.

The source proposes a symbolic transducer plus selective batched validation, not merely isolated sentence parsing. Its state tracks recent entities/propositions across turns. The AST includes speech acts, events/roles, quantifiers, negation/modality, conditions/alternatives, temporal/causal relations, attitudes, queries, directives/selectors, goals/preferences, corrections and unresolved nodes.

Restored outputs include complete turns, speakers/addressees, discourse state, ambiguity alternatives/questions, confidence, symbolic audits, helper batches and load estimates. The native CNL is regenerated from the AST and diagnostics; cached CNL is not used as authoritative meaning. The 30-turn source conversation remains one evaluation unit and a parity test reproduces its state and rendering.

Review policies `all`, `risky`, and `sampled` are preserved. Source-aware review batches include conversational context and symbolic audit failures. The archive's validator checks protocol, batch/turn IDs, coverage, confidence and detailed error fields. `judge-task.mjs` supplies this native review through Ploinky Workers. The independent common judge is a separate measurement, not a replacement for the strategy's own audit architecture.

Unresolved nodes must remain visible, not disappear or cause the complete candidate to be discarded. They block claims of completed reasoning. A downstream reasoning compiler is explicitly outside the archive's implementation; the adapter preserves the complete graph and marks that backend gap. Extending it requires binder/reference integrity and operator semantics; labels such as `x2 you flagged` cannot substitute for a flag relation.

The helper replacement protocol is preserved in the source API but is not activated in first-pass runs. Prior false-positive judge findings remain useful failure hypotheses, not a verdict against a pipeline that had been partially omitted.

Recovered [architecture](original/ARCHITECTURE.md), [CNL node families](original/CNL.md), [native judge protocol](original/JUDGE_PROTOCOL.md), and [evaluation](original/EVALUATION.md).
