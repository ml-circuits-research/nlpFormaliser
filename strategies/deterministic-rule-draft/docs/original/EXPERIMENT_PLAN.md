# Recommended experiment sequence

The current package is designed to answer one central question: **does structured deterministic preprocessing allow a smaller/cheaper model to produce a formal representation as faithfully as direct formalization?**

## Strategies to compare

Run exactly the same frozen benchmark through:

1. `heuristic` - no LLM; sanity baseline.
2. `direct` - NL -> LLM -> Formal IR.
3. `proto` - NL + conservative ProtoIR -> LLM normalizer -> Formal IR.
4. `repair` - NL + ProtoIR + heuristic draft -> LLM repair -> Formal IR.

The most informative comparison is `direct` vs `proto` using the **same model** and decoding parameters. If `proto` wins at equal cost, surface structure helps. If it reaches the same fidelity with a smaller model/fewer completion tokens, the hypothesis is stronger.

## Minimum reporting table

For each strategy/model pair report:

- executable behavioral accuracy;
- semantic-only accuracy;
- control accuracy;
- fact/rule structural F1 where gold exists;
- judge coverage;
- judge faithfulness;
- judge semantic F1;
- mean formalization latency;
- prompt/completion/total tokens when the endpoint reports usage;
- repair `finalReuse` and `draftRetention` where applicable.

## Fast decision thresholds

The exact targets should be frozen before running a serious benchmark, but a useful early gate is:

- `proto` or `repair` should not merely match the direct strategy; it should do so with a materially smaller model or lower token/latency cost;
- judge coverage and faithfulness should both be high; optimizing one at the expense of the other is not sufficient;
- controls should stay near 100% to detect semantic over-generation;
- repair reuse should be high enough to show actual repair rather than regeneration;
- held-out paraphrase performance must remain close to development performance.

## Repair-specific experiment

Use `bin/corruption-eval.mjs` against gold programs. The harness injects controlled defects such as dropped facts, swapped arguments, flipped negation, dropped rule conditions and unsupported facts. Measure both exact structural recovery and behavioral recovery.

Also run the no-op path: a correct gold IR is supplied as the draft. A safe repairer should preserve its semantics and ideally its canonical structure.

## Next benchmark expansion

The preserved pilot is small. Expand with independently authored examples covering:

- existential/universal quantifier scope;
- nested negation;
- conditionals and exceptions;
- deontic modality (must/may/prohibited);
- temporal ordering/durations;
- event roles;
- coreference and bridging;
- ambiguity that must remain unresolved;
- questions and instructions;
- procedures/tool predicates;
- scientific/technical prose;
- conversational ellipsis and context;
- paragraphs where several sentences interact.

Freeze source texts, behavioral tests and gold annotations before testing candidate models.
