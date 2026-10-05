# Event Role Logic

Public ID: `event-role-logic`. Legacy compatibility ID: `evl`.

EVL constructs reified event/role facts with entity types, quantification, negation, modality, tense, scope, links and conversational acts. A checker validates the vocabulary and references, and deterministic interpreters derive CNL, a FOL reading and question answers. The existing implementation and parity fixtures remain intact.

The archive-style internal check/judge/refine loop remains available in `src/loop.mjs`; first-pass defaults explicitly set zero rounds. Refined candidates must retain their traces and be evaluated separately. Raw Prolog facts are a reified representation, not proof that an ordinary Prolog engine automatically understands the EVL operators.

`pipeline.mjs` routes original generation, internal judging and feedback-based refinement to separate predefined worker tasks. The returned native trace is retained. Nonzero rounds require `allowRepair`; no repair run was launched during restoration.

The previous batch-output truncation was an execution-budget failure, not evidence that event reification is weak. Future comparison must separate prompt size, event-role correctness, cross-reference integrity, renderer coverage and task budget.

Recovered local [semantic specification](original/evl-spec.md) and [original prompts](original/prompts.json). Native checker, renderer, FOL and question-answering tests remain in `test/`.

## Symbol rule and review changes

Every symbol (predicate, relation, concept, entity/constant, context id, label, template words) has at most 3 words, counted on underscores, hyphens, spaces, digit and camelCase boundaries (`tools/lib/symbols.mjs`); quoted proper names have at most 3 tokens. The prompt states the rule with a good and a bad example and asks to decompose long ideas; the audit makes any violation ineligible (category `symbolLength`). The checker counts lemma words with the shared rule (camelCase included) and requires `name/2` to hold a capitalised proper name of at most 3 tokens. `modal(E, need)` and `scope(neg(E), modal)` express "need not"/"not required to". Negation scoped over a name, pronoun or group stays on the verb instead of being dropped. The FOL reading (`src/fol.mjs`) nests content, cause and purpose events as `role(e,⟦φ⟧)`, conditionals as implications, other links as closed `CONN(φ1, φ2)` and speech acts over their content only, and quantifies each entity at the lowest proposition containing all its uses (donkey indefinites with their universal), so valid cases have no free variables; the native reading remains as `nativeFolFromFacts`. Question answering compares modality, explicitly stated tense, frequency and `no`/`few` participants: `freq(never)` or a `no` participant flips polarity, other mismatches give `unknown`.
