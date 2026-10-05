# Direct Context Logic

Public ID: `direct-context-logic`. Legacy compatibility ID: `lab-direct`.

## Research mechanism

One model maps NL into the full Formal IR 0.2: facts, rules, contexts, queries, external predicates, ambiguities and symbol metadata. Reification can express events and semantic roles. This is not restricted to a flat subject-verb-object list. Its hypothesis is a direct-generation baseline against which structured preprocessing and draft reuse can be measured.

## Restored implementation

The native strategy, prompt, IR normalizer, validator, renderer, standalone module compiler, behavioral evaluator, structural metrics and corruption generator are preserved. The adapter now retains ProtoIR and original model/draft artifacts. CNL templates and all contextual fields survive; they are no longer forbidden or discarded. The checked-in `task.mjs` uses the original prompt through Ploinky Workers. The previous Horn-only prompt/renderer is superseded, not the baseline.

## Three separate questions

1. What does the representation retain? All original IR fields.
2. What can the renderer expose? All fields supported by the native renderer, including explicit unresolved context.
3. What can the reasoner execute? The narrower Horn subset. `reasoning.coverage` records unhandled contexts/ambiguities/externals; they are never silently treated as global facts.

Templates can improve readability but can also hide semantics outside atoms. `metadataAudit` reports missing/invalid argument placeholders without deleting metadata. A passing placeholder audit is not a semantic proof. The current native reasoner ignores context semantics; the adapter blocks full-behavior claims for such records while retaining their CNL and artifacts.

## Evidence and next extensions

Use `archive-lab-development` and `archive-lab-heldout` for gold facts/rules plus semantic and anti-hallucination queries. Compare with Evidence Guided Logic on identical models and cases, and compare errors by coreference, scope, temporal and procedural categories. Add formal context semantics as an explicit versioned backend, not by dropping contexts. The original prompt's query schema omission is a documented defect; a richer schema prompt must remain a separate candidate, with full expressivity retained.

See [original architecture](original/ARCHITECTURE.md), [IR](original/IR.md), [evaluation](original/EVALUATION.md), [limits](original/LIMITATIONS.md), and [experiment plan](original/EXPERIMENT_PLAN.md).

## Prompt v2 and judged CNL

The shared Formal IR prompt now adds the 3-word symbol rule and explicit schemas for queries (`{vars, where}`), contexts (`{id, kind, holder}` plus `context` on atoms), ambiguities (`{id, options, description}`) and externals. Every symbol (predicate, relation, concept, entity/constant, context id, label, template words) has at most 3 words, counted on underscores, hyphens, spaces, digit and camelCase boundaries (`tools/lib/symbols.mjs`); quoted proper names have at most 3 tokens. The prompt states the rule with a good and a bad example and asks to decompose long ideas; the audit makes any violation ineligible (category `symbolLength`). `validateIR` checks query projections, declared context references and one arity per predicate. The judged CNL is structure-derived: a label is used only when it restyles its own symbol, a template only when it has every argument slot plus at most 3 words, and glosses/descriptions are never rendered (ambiguities appear as `NOTED AMBIGUITY #k`). Contextual atoms render as `Within context c1 (belief of bob): ...`, the Horn closure keeps each context in its own partition, and a contradiction makes queries `INCONSISTENT`.
