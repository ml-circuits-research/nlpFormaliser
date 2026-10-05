# Architecture: the formalization strategy

## Scope

This project tests one hypothesis only:

> A cheap symbolic transducer can produce a useful CNL candidate, while an LLM can cheaply validate semantic equivalence because both the source and the candidate remain human-readable language-like structures.

The downstream compiler is deliberately out of scope.

## End-to-end procedure

### 1. Read the source turn in discourse context

Input:

```json
{"id":"t10","speaker":"user","text":"Before Ada approves the report, Bob must review it."}
```

The state contains recent entities/propositions so references can sometimes be resolved without an LLM.

### 2. Symbolic analysis

The formalizer performs lightweight deterministic analysis:

- speech-act classification;
- sentence/clause segmentation;
- lexical predicate recognition;
- noun-phrase/entity recognition;
- common quantifier handling;
- modal and negation handling;
- conditions and temporal clauses;
- common semantic roles;
- discourse reference heuristics;
- risk/ambiguity detection.

The output is a restricted AST and its canonical CNL rendering.

### 3. Symbolic audit

The source and AST are compared for high-value semantic signals. Examples:

- source has `must` → AST must contain a deontic modal;
- source has explicit negation → AST must preserve negation/operator scope;
- source has `before`/`after` → temporal order must be represented;
- source has `if`/`unless` → a condition must be represented;
- unresolved references prevent confident automatic acceptance.

This audit is cheap and deterministic, but incomplete.

### 4. Select candidates for LLM validation

Three useful policies:

- **all**: validate every candidate; appropriate for benchmarks;
- **risky**: validate only symbolic-risk cases; cheapest;
- **sampled**: risky + some apparently safe cases; appropriate when estimating silent errors.

### 5. Batch candidates

Each batch item includes:

- original NL;
- candidate CNL;
- local conversational context;
- symbolic warnings;
- symbolic audit failures.

Many items can be judged in one request. This is the main cost reduction mechanism.

### 6. LLM semantic equivalence judgment

The judge checks two directions:

```text
SOURCE_NL meaning ⊆ CNL meaning ?
CNL meaning ⊆ SOURCE_NL meaning ?
```

Operationally it reports:

- missing meaning;
- invented meaning;
- scope errors;
- reference errors;
- speech-act error;
- equivalent / not_equivalent / uncertain.

It is explicitly told not to use world knowledge to fill gaps.

### 7. Acceptance

A strict experiment should accept only if:

```text
symbolic audit = pass
AND LLM verdict = equivalent
AND judge confidence >= configured threshold
```

`uncertain` is not failure of the architecture; it means the source/context itself did not license one unambiguous formalization or the judge could not establish equivalence.

## What this architecture does not claim

- Symbolic ambiguity detection is not complete.
- The LLM judge is not a formal proof system.
- A judge can share biases with the generator if the same model is used.
- A readable CNL helps semantic inspection but does not guarantee semantic completeness.
- The current symbolic parser is English-focused and heuristic.

For serious evaluation, use independent held-out examples and preferably a different model/prompt for judging than for any repair stage.
