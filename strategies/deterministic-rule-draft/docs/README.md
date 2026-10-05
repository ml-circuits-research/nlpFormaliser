# Deterministic Rule Draft

Public ID: `deterministic-rule-draft`. Legacy compatibility ID: `lab-heuristic`.

This is the archive's deliberately limited deterministic draft, not its proposed universal solution. It extracts selected types, properties, transitive relations, negation and conditional rules, carries mention state, and attaches a ProtoIR summary. The full draft, ProtoIR and source artifacts are retained for inspection and for the distinct Draft Guided Repair experiment.

The adapter reproduced the original IR and CNL on all 60 supplied lab examples before the draft v2 review changes below. Low coverage must be reported together with its intended role: draft quality, retained correct atoms, silent errors and the downstream repair's reuse. Evaluating it only on unrelated conversational instructions is not enough to decide whether preprocessing helps.

The v2 changes are refusals and general coordination/NP rules, not sentence-specific patterns. Improvements should target recurrent constructions and paraphrase invariance, while preserving evidence on unsupported spans. The native renderer/compiler supports the complete IR; execution coverage is reported separately. Gold semantic queries and UNKNOWN controls remain in the imported evaluation records.

Recovered [architecture](original/ARCHITECTURE.md), [pilot limitations](original/LIMITATIONS.md), [behavior and reuse metrics](original/EVALUATION.md), and [experiment plan](original/EXPERIMENT_PLAN.md).

## Review changes (draft v2)

The draft no longer asserts facts for questions, conditionals outside its explicit rule patterns, modal or attitude clauses, unresolved pronouns, or objects that are not a short noun phrase. Those sentences become `ambiguities` notes such as `{"id":"u1","kind":"unsupported_question","span":[0,22]}` (source offsets, never source text), which the reasoning coverage reports as gaps. Coordinated subjects are distributed ("Ana and Bob own the lab" gives two facts), an elided subject is reused ("is a researcher and owns GPU1"), a non-restrictive ", which is a GPU" adds a type fact, trailing temporal adverbs and prepositional modifiers are reported instead of being copied into entity names, and negated clauses update the pronoun antecedent. 58 of the 60 archive lab cases therefore differ from the archive draft; their recorded outputs are in `test/fixtures/lab-divergences.json`. Every symbol (predicate, relation, concept, entity/constant, context id, label, template words) has at most 3 words, counted on underscores, hyphens, spaces, digit and camelCase boundaries (`tools/lib/symbols.mjs`); quoted proper names have at most 3 tokens. The prompt states the rule with a good and a bad example and asks to decompose long ideas; the audit makes any violation ineligible (category `symbolLength`).
