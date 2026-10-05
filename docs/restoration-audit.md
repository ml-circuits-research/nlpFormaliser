# Fidelity restoration audit

## Why earlier comparisons are insufficient

The first adapters conflated three distinct properties: representable meaning, deterministic renderability and executable reasoning coverage. Lab contexts, ambiguity, externals and CNL metadata were removed or forbidden to fit a narrow Horn export. The discourse adapter dropped state/diagnostics and turned unresolved content into whole-candidate failure. The MicroIR bounded pipeline, compact judge view and native paired controls were omitted. Those changes made the measured systems different from the archive proposals.

The old experiments remain evidence about those exact adapters and service behavior, not a ranking of the original proposals. Their source hashes and outputs are preserved. The locally invented tiny closed grammar is withdrawn from the registry; it is not an archive strategy or an established improvement.

## Source-by-source restoration

| Family | Restored | Deliberate integration differences | Test evidence |
|---|---|---|---|
| Formalizer Lab | full IR/ProtoIR/artifacts; CNL templates; standalone compiler; behavior/structural/reuse metrics; corruption generator; original repair strategy | provider adapter replaced by predefined Pworker tasks; backend coverage and template-slot diagnostics added non-destructively; later review divergences below | all 60 original heuristic outputs matched IR, evidence and CNL at restoration (now: evidence matches, IR/CNL diverge as recorded below); native tests; full-field compiler round trip |
| MicroIR | original prompt; full scoped vocabulary; readable/compact CNL; judge/repair pipeline with history and best selection; source benchmark and corrupted pairs | safe formula validation and constant quoting fixes; default repairs disabled; all runtime transports Pworker | 30 gold readable+compact CNL parity; original pipeline tests; finite-scope probes |
| Discourse parser | conversation state; complete turns/acts/ambiguities; source audit; helper requests and load; all/risky/sampled judging; native response validation | direct HTTP caller removed; Pworker review task; explicit backend gap | full 30-turn state/AST/CNL parity and native review tests |
| CNL-Core | frozen rules/prompts/examples; all speech acts; explicit ambiguity; surface contract | Pworker task replaces model transport; control-only research status | native tests and lossless 50-record dataset import |
| EVL | existing checker, interpreter, FOL and QA implementation; original spec/prompts | first-pass rounds=0; task integration | original checker/CNL/FOL/QA fixtures |

## Intentional divergences after the strategy review

`strategies/_archive` stays untouched as provenance. `test/archive-parity.test.mjs` compares behaviour that is intentionally unchanged against the archive and changed behaviour against recorded fixtures (`test/fixtures/*.json`, re-recorded only deliberately with `test/fixtures/record-divergences.mjs`). `test/native-on-active.test.mjs` runs the archive's own lab, discourse, MicroIR and CNL-Core unit tests against the active modules; only the MicroIR assertions listed below are rewritten, by exact-match transforms.

| Family | Divergence | Reason | Evidence |
|---|---|---|---|
| all | 3-word symbol rule in every prompt; audit category `symbolLength`; echo detector | user decision: long names hide untranslatable meaning | `test/symbols-audit.test.mjs` |
| Lab | judged CNL ignores glosses, long labels/templates; labels only restyle their symbol; ambiguities render as `NOTED AMBIGUITY #k` | model-written metadata leaked meaning into the judged CNL | `test/strategy-regressions.test.mjs` (H1) |
| Lab | contextual atoms render inside their context; closure partitions facts by context | contextual facts unified with global rules | (M1) |
| Lab | `queryStatus` returns `INCONSISTENT` for p and not p in one partition | no contradiction detection | (M2) |
| Lab | prompt v2 (schemas for queries/contexts/ambiguities/externals, symbol rule); `validateIR` checks queries, context references, arity | unchecked query and context structure | (Low) |
| Lab | draft v2: questions, conditionals, modal/attitude clauses, unresolved pronouns and long objects become `unsupported_*`/`unrepresented_*` notes; subject coordination and relative type clauses handled; negation updates the antecedent; camelCase-aware, Unicode-preserving slugs | questions and conditionals were asserted as facts and clause text was copied into names | 58 of 60 archive cases recorded in `lab-divergences.json` (H4) |
| Lab | ProtoIR negation markers for `n't`/`cannot`; one question marker per interrogative sentence | missed negation and multi-sentence questions | (M5); unchanged on the 60 archive cases |
| Lab | common view ignores `version`/`meta`/`symbols` and empty sections | the Lab common view could never be complete | `test/common-cnl.test.mjs` (M3) |
| MicroIR | constants serialized quoted (earlier fix); free variable-like identifiers (`x`, `v2`) rejected; nested lists, malformed numbers and nested Q/W rejected; strict judge types | unbound `x` silently became a constant; `Boolean("false")` was true | (H3, M8); archive gold `merge_approvals` leaves `c` unbound and is now rejected |
| EVL | FOL nests content/cause/purpose events, conditionals, links and acts; entities quantified at the lowest covering proposition | embedded content was asserted as fact with free variables | 143 of 325 FOL fixtures differ, recorded in `fol-nested.json`; native FOL kept and still matches the Python reference (H6) |
| EVL | QA compares modality, stated tense, frequency and `no`/`few` participants | operators were ignored | all 53 QA fixtures unchanged (H5) |
| EVL | `name/2` must be a proper name of at most 3 tokens; lemmas counted with camelCase | free text in names | checker verdicts unchanged on all fixtures (M6) |
| EVL | negation scoped over a name/pronoun/group stays on the verb; `modal(E, need)` and `scope(neg(E), modal)` | negation was dropped; "need not" was inexpressible | English fixtures unchanged (M7) |
| Discourse | abbreviation/decimal-aware splitting and tokens; contraction expansion; `UNRESOLVED_FRAGMENT#k`; ambiguity questions/messages not rendered | verbatim source in the judged CNL; ".tmp", "9 a.m." split sentences | CNL recorded in `discourse-divergences.json` (M4) |
| Discourse | symbolic parser v2 (see the strategy's `docs/README.md`): compromise lexicon for verbs, roots and imperatives; clause connectives (but/although/while/so/which is why/then/since/unless/provided/whenever); attitude, adjective-that and that-less complements, embedded whether-questions with NOT over the attitude; noun-phrase decomposition (relative clauses as restrictions, AND/OR groups, prepositional relations, pronoun recipients); discourse markers; ONLY keeps its focus restriction | most sentences stayed unparsed or kept whole clauses as one entity label | 12 of 30 dialogue turns recorded in `discourse-divergences.json`; the other 18 equal the archive (ids aside) |
| CNL-Core | no empty `INPUT:` block in the predefined task | malformed prompt | (Low) |

## What is not claimed

These tests establish integration fidelity on the supplied material. They do not certify native semantic correctness, universal NLP coverage, operational semantics for every context/modal operator, or judge validity. Native weaknesses remain visible instead of being erased. Source reference annotations may themselves be wrong; they are labeled archive-provided references.

The old lab query-schema clarification is a useful candidate idea, but restoring the original baseline takes precedence. Future prompt v2 must specify richer query/context handling without banning the features being studied, and compare against the frozen baseline.

## Extension priorities

1. Formal schema and scope-aware interpretation for lab contexts/ambiguities, preserving uncertainty instead of selecting arbitrary readings.
2. Discourse binding/reference integrity and a typed compiler for supported operators; unresolved material remains represented outside the executable subset.
3. Predicate signatures/canonicalization and ambiguity alternatives for Compact Scope Logic, preserving its open vocabulary and nested propositions.
4. An evidence-guided scoped candidate combining the lab's conservative ProtoIR with MicroIR's richer quantifier structure. It should use identical output semantics and one extraction task, isolating the value/cost of evidence.
5. A normalization→logic candidate that measures compounded error and task granularity; it is not presumed cheaper or better.

Extensions should be implemented only with explicit representational contracts, source-level failure examples, negative controls and regression tests. Ad-hoc grammar additions that merely match selected benchmark sentences do not answer these research questions.
