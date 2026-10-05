# Architecture

## Goal

Turn arbitrary NL into a compact symbolic candidate whose semantics can be exposed again as deterministic Controlled Natural Language (CNL). A separate LLM judge estimates whether the original NL and the generated CNL are semantically equivalent.

## Components

1. **Formalizer LLM**: `NL -> MicroIR wire`.
2. **Safe parser + validator**: rejects malformed syntax, free variables, invalid arities, unknown fixed operators.
3. **Deterministic CNL renderer**: `MicroIR -> CNL`; no LLM call. A readable rendering is retained for humans and a compact rendering is used for the judge by default.
4. **Judge LLM**: `NL + CNL -> score/equivalence/differences`.
5. **Repairer LLM**: receives NL, current IR and judge differences; returns corrected IR.
6. **Best-candidate selector**: never replaces a higher-scoring candidate with a worse repair.

## Why the judge compares NL to CNL, not NL to IR

The judge should assess a human-readable execution of the formal object. This catches losses introduced by the formal representation itself and keeps the validator independent from the formalizer's internal syntax.

## Why no question fuzzing by default

Generating dozens of semantic questions is expensive. The default judge performs one batched semantic audit covering negation, quantifier scope, modality, attribution, time/order, quantities, coreference and question force. Semantic fuzzing can later be an optional escalation only when confidence is low.

## Cost model

- accepted first candidate: 1 formalizer + 1 judge = 2 calls;
- one repair: +1 repair +1 judge = 4 calls total;
- `maxRepairs` is explicit and defaults to 1.

## Open vocabulary

All domain semantics live in dynamic predicates (`$.name(...)`). Fixed syntax only encodes logical operations whose scope cannot safely be hidden inside predicate names.
