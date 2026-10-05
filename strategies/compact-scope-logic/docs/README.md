# Compact Scope Logic

Public ID: `compact-scope-logic`. Legacy compatibility ID: `microir`.

MicroIR is compact in syntax, not a flat representation. Open-vocabulary predicates accept entities, bound variables, values and nested propositions. Fixed operators expose negation, conjunction/disjunction, implication, existential/universal scope and polar/wh questions. Ordered discourse can contain multiple statements and questions. Belief, planning, time and modality are expressible compositionally with proposition arguments; those require a downstream theory beyond extensional first-order model checking.

The original readable and compact CNL views, judge protocol, bounded repair loop, complete history and best-candidate retention are restored. `pipeline.mjs` connects each operation to its own predefined Ploinky Workers task. Repairs default to zero and require explicit enabling. The regular first-pass adapter invokes only formalization; independent judging is separate.

Local parser improvements reject scalar values used as formulas and preserve a quoted constant named x when it appears under a binder named x. These changes are documented deviations, tested against all 30 original gold cases: readable and compact CNL agree with the source implementation. The original tests still run against the preserved source snapshot, and `test/native-on-active.test.mjs` runs them against the active modules with the documented divergences.

The finite model checker is an additional probe for the extensional fragment, not a replacement semantics. It must reject modal proposition arguments and questions as assertions. Promising extension directions are predicate signatures, explicit ambiguity alternatives and evidence-guided extraction, rather than replacing the syntax with hard-coded sentence rules.

Recovered [IR specification](original/IR.md), [architecture](original/ARCHITECTURE.md), [pipeline protocol](original/LLM_PROTOCOL.md), [evaluation](original/EVALUATION.md), [status](original/STATUS.md), and [roadmap](original/ROADMAP.md). Imported data includes 30 semantic references and 11 good/bad judge pairs.

## Symbol rule and review changes

Every symbol (predicate, relation, concept, entity/constant, context id, label, template words) has at most 3 words, counted on underscores, hyphens, spaces, digit and camelCase boundaries (`tools/lib/symbols.mjs`); quoted proper names have at most 3 tokens. The prompt states the rule with a good and a bad example and asks to decompose long ideas; the audit makes any violation ineligible (category `symbolLength`). `src/symbols.mjs` lists predicate names and string constants. In the bounded repair pipeline a symbol violation is a deterministic repair trigger (`JUDGE_DIFF.sym`) and blocks acceptance; best-candidate selection prefers rule-conforming candidates.

The wire parser now rejects a free variable-like identifier (single letters, `v1`, `x2`, ...) instead of reading it as a constant (`I($.dog(x),$.barks(x))` is an error naming the missing binder); constants are quoted or multi-letter names, as the prompt now says. Lists are only the top-level document, numbers follow JSON (`1e3`) and must not run into identifiers, and Q/W may only appear as a document item or directly as a predicate argument, so question force cannot be labelled "Statement". The native judge reply is parsed with strict types (`"false"` is an error, not `true`). The archive gold `merge_approvals` leaves `c` unbound and is now rejected; see the [restoration audit](../../../docs/restoration-audit.md).
