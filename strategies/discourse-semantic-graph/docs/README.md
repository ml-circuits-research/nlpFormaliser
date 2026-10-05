# Discourse Semantic Graph

Public ID: `discourse-semantic-graph`. Legacy compatibility ID: `symbolic`.

The source proposes a symbolic transducer plus selective batched validation, not merely isolated sentence parsing. Its state tracks recent entities/propositions across turns. The AST includes speech acts, events/roles, quantifiers, negation/modality, conditions/alternatives, temporal/causal relations, attitudes, queries, directives/selectors, goals/preferences, corrections and unresolved nodes.

Restored outputs include complete turns, speakers/addressees, discourse state, ambiguity alternatives/questions, confidence, symbolic audits, helper batches and load estimates. The native CNL is regenerated from the AST and diagnostics; cached CNL is not used as authoritative meaning. The 30-turn source conversation remains one evaluation unit and a parity test reproduces its state and rendering.

Review policies `all`, `risky`, and `sampled` are preserved. Source-aware review batches include conversational context and symbolic audit failures. The archive's validator checks protocol, batch/turn IDs, coverage, confidence and detailed error fields. `judge-task.mjs` supplies this native review through Ploinky Workers. The independent common judge is a separate measurement, not a replacement for the strategy's own audit architecture.

Unresolved nodes must remain visible, not disappear or cause the complete candidate to be discarded. They block claims of completed reasoning. A downstream reasoning compiler is explicitly outside the archive's implementation; the adapter preserves the complete graph and marks that backend gap. Extending it requires binder/reference integrity and operator semantics; labels such as `x2 you flagged` cannot substitute for a flag relation.

The helper replacement protocol is preserved in the source API but is not activated in first-pass runs. Prior false-positive judge findings remain useful failure hypotheses, not a verdict against a pipeline that had been partially omitted.

Recovered [architecture](original/ARCHITECTURE.md), [CNL node families](original/CNL.md), [native judge protocol](original/JUDGE_PROTOCOL.md), and [evaluation](original/EVALUATION.md).

## Review changes

The sentence splitter keeps abbreviations, times and decimals (".tmp", "9 a.m.", "3.5", "Dr.") inside one sentence, and the tokenizer keeps decimals and file extensions. Contracted negation and auxiliaries (haven't, don't, can't, won't, isn't) are expanded before parsing, so they produce NOT/modal nodes. Unparsed text is rendered as `UNRESOLVED_FRAGMENT#k`, never verbatim; the fragment stays in the AST. Ambiguities are listed as `NOTED AMBIGUITY #k` with id, severity, kind and a span or options only when they are at most 3 words; helper questions and messages are not rendered into the judged CNL. The 30-turn AST and state are unchanged from the archive. Every symbol (predicate, relation, concept, entity/constant, context id, label, template words) has at most 3 words, counted on underscores, hyphens, spaces, digit and camelCase boundaries (`tools/lib/symbols.mjs`); quoted proper names have at most 3 tokens. The prompt states the rule with a good and a bad example and asks to decompose long ideas; the audit makes any violation ineligible (category `symbolLength`).
