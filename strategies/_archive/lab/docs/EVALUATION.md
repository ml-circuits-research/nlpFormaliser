# Evaluation protocol

## What counts as evidence?

The project should avoid the circular test "the same LLM formalizes the text and then says its own output is correct". The harness therefore treats LLM judging as one metric, not ground truth.

### A. Behavioral tests

Before repair/formalization is inspected, define queries whose answers follow from the text.

```json
{
  "query":{"pred":"owns","args":["mira","workstation"],"neg":false},
  "expected":"TRUE",
  "kind":"semantic"
}
```

Controls test what must remain unknown or false. Query outcomes are `TRUE`, `FALSE` when the explicit opposite is derivable, and `UNKNOWN` otherwise.

Primary metric:

```text
BehaviorAccuracy = passed executable tests / all executable tests
```

Report semantic tests and controls separately.

### B. Structural gold

When a benchmark contains a gold IR, the evaluator computes exact fact/rule precision, recall, and F1 after canonical normalization. This catches concrete representation errors but may penalize semantically equivalent alternative formalisms.

### C. NL -> IR -> CNL semantic round trip

The deterministic CNL renderer exposes what the program actually states. An independent LLM judge scores:

- `coverage`: NL meaning retained by CNL;
- `faithfulness`: CNL assertions supported by NL;
- scope;
- coreference;
- temporal/modality handling.

A balanced directional metric is reported as:

```text
semanticF1 = harmonic_mean(coverage, faithfulness)
```

Coverage alone rewards hallucinating extra detail. Faithfulness alone rewards deleting difficult information. Both are required.

### D. Repair reuse

For a repair strategy:

```text
finalReuse     = final items unchanged from draft / final items
draftRetention = draft items retained / draft items
```

High final quality with very low `finalReuse` means the model mostly regenerated from NL rather than repairing the draft. That may still be useful, but it does not validate the hypothesis that deterministic preprocessing reduced semantic work.

## Recommended quick falsification test

Use at least four partitions:

1. development examples;
2. held-out paraphrases of the same semantics;
3. new semantic constructions/domains;
4. deliberately corrupted correct IRs for isolated repair tests.

For corruption recovery, inject one known error at a time:

- drop atom;
- swap arguments;
- flip negation;
- wrong coreference;
- `FORALL`/`EXISTS` scope error (once scope execution is implemented);
- delete condition;
- add unsupported fact.

A repair model should recover the error without changing unrelated correct items.

## No-op test

Give the repairer a correct draft. It should make no semantic change. Measure exact or canonical semantic no-op rate.

## Paraphrase invariance

Multiple NL paraphrases that express the same semantics should yield programs with identical executable behavior even when their predicate naming differs.

## Judge hygiene

For credible experiments:

- freeze benchmark and tests before model evaluation;
- hide strategy identity from the judge;
- use an independent judge model when possible;
- run multiple judge samples and report mean/stddev;
- manually audit disagreements, not only aggregate scores;
- do not train on the held-out benchmark;
- preserve raw model outputs and generated CNL.
