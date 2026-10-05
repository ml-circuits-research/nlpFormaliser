# Evaluation protocol

The prototype separates four questions that are often conflated.

## A. Syntax reliability

Can generated MicroIR be parsed and validated?

Metrics:

- parse success rate;
- validation success rate;
- wire serialize/parse round-trip.

Run:

```bash
npm run eval:static
```

## B. Semantic fidelity

Does the generated CNL express the same meaning as the input NL?

Primary operational metrics:

- mean judge score;
- fraction accepted above a calibrated threshold;
- missing/added/changed semantics by category;
- repair rate and calls per accepted case.

This is more important than exact predicate-string equality.

## C. Judge quality

A judge that approves everything makes the pipeline meaningless. `judge_pairs.jsonl` contains good IR and a deliberately corrupted IR for the same NL.

Metric:

**pairwise accuracy** = fraction of cases where `score(good) > score(bad)`.

Also report:

- equivalence rate on good candidates;
- rejection rate on corrupted candidates.

Run with an endpoint configured:

```bash
npm run eval:judge
```

## D. Gold structural agreement

`semantic_cases.jsonl` contains 30 hand-authored reference formalizations. Exact-match is useful for regression and controlled experiments, but should be treated as secondary because equivalent open-vocabulary predicate choices may differ.

Run:

```bash
npm run eval:formalizer
```

## Recommended experiment

Evaluate several small formalizers (for example different 0.5B-4B models) against one stronger, independent judge. Keep:

- the prompt identical;
- temperature 0;
- CNL renderer identical;
- `maxRepairs=0` first, then `1`;
- the same held-out texts.

Report semantic fidelity versus model size, calls, latency and actual tokenizer counts. This directly tests whether a small model + judge/repair loop can become a practical formalizer.
