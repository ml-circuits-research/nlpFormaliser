# Semantic Evaluation

Exact string match is useful for regression but is not the scientific metric for CNL-Core.

For example, these may be semantically equivalent:

```text
REQUEST: You determine whether the test passes.
REQUEST: You check whether the test passes.
```

A real evaluation should therefore score semantic fidelity independently.

## Recommended unit of evaluation

Each dataset record contains:

- original natural-language input;
- optional conversational context;
- candidate CNL output;
- a human-authored reference CNL output;
- tags describing difficult phenomena.

At least two independent judgments should be used for a serious result.

## Primary failure metric: Silent Semantic Error Rate (SSER)

A **silent semantic error** occurs when the candidate looks valid but materially changes meaning without exposing uncertainty.

Examples include:

- dropping a negation;
- converting `may` to `must`;
- converting `not every` to `no`;
- inventing a causal relation;
- answering instead of preserving a question;
- turning a proposal into an instruction;
- resolving an ambiguous pronoun incorrectly without `UNCLEAR`;
- dropping `probably` or an attribution when it changes epistemic force.

Recommended metric:

```text
SSER = records_with_at_least_one_silent_semantic_error / all_records
```

Lower is better.

## Secondary metrics

### 1. Meaning Preservation Score (MPS), 0–4

- **4** — equivalent for all materially relevant meaning.
- **3** — essentially equivalent; only negligible stylistic/pragmatic nuance differs.
- **2** — usable but one non-critical semantic detail is missing/changed.
- **1** — major semantic distortion or omission.
- **0** — unrelated, contradictory, or unusable.

### 2. Speech-Act Accuracy

Are assertion/question/request/intention/preference/proposal/revision distinctions preserved?

### 3. Operator Preservation

Check explicit preservation of:

- negation;
- quantification;
- modality;
- uncertainty;
- attribution;
- condition/exception;
- temporal relation;
- comparison.

### 4. Ambiguity Safety

For truly ambiguous inputs:

- correct explicit ambiguity: success;
- safe underspecification: acceptable;
- silent arbitrary choice: failure.

### 5. Hallucinated Meaning Rate

Fraction of examples in which the candidate introduces a materially new proposition, constraint, entity identity, reason, or consequence.

### 6. Meaning Omission Rate

Fraction of examples in which at least one material source meaning is absent from the candidate.

### 7. Format Validity

Measured automatically with `validateCNL()`.

## Pairwise equivalence rubric for a judge

A human or strong judge model can be asked:

1. List every material proposition, speech act, modality, condition, uncertainty marker, attribution, temporal constraint, and ambiguity in the source.
2. Check whether each is preserved in the CNL candidate.
3. Check whether the CNL candidate adds anything materially unsupported.
4. Check whether an ambiguity was silently resolved.
5. Assign MPS 0–4 and `silent_semantic_error: yes/no`.

The evaluator should judge **meaning**, not wording similarity.

## Important experimental separation

Do not use the same model and same prompt to both generate and judge the final benchmark if the goal is a publishable result.

A practical development loop may use a strong model as judge, but the final evaluation should include human review and preferably adversarial cases written independently of the prompt designer.
