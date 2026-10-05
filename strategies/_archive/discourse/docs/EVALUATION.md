# Evaluating this strategy against alternatives

Treat the package as one independent formalization strategy:

```text
Strategy S: symbolic NL → readable CNL + LLM semantic judge
```

Compare it with direct LLM→formal form, parser-based alternatives, fine-tuned models, or other symbolic systems on the same held-out inputs.

## Recommended dataset

Include connected conversational turns, not only isolated sentences:

- assertions and corrections;
- questions and follow-ups;
- instructions and constraints;
- pronouns/coreference;
- quantifier scope;
- modal/negation interactions;
- conditions;
- temporal order;
- causality;
- ellipsis;
- ambiguous cases where the correct output should be `uncertain`.

## Minimum metrics

For each strategy record:

- semantic adequacy judged by a strong independent evaluator/human;
- omission rate;
- invention rate;
- wrong-scope rate;
- wrong-reference rate;
- silent-error rate;
- unresolved/abstention rate;
- LLM calls per 100 turns;
- input/output tokens per 100 turns;
- wall-clock latency;
- deterministic CPU time.

## Avoid a circular evaluation

If the same LLM both repairs and judges a candidate, results can be over-optimistic. Prefer:

- generator ≠ judge model, or
- at least separate prompts and a held-out human-audited subset.

A useful hierarchy is:

```text
symbolic formalizer
   ↓
judge A (cheap, batched)
   ↓
small random sample
   ↓
judge B / human gold
```

The final metric should be calculated from the independent sample, not from the system's own confidence.
