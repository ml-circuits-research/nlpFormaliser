# Improvement Targets

This document records what is intentionally *open for improvement* after the baseline is measured.

The baseline itself should remain unchanged during comparison. New ideas should first be tested as named candidates (`candidate-A`, `candidate-B`, ...). This avoids confusing changes in the CNL contract with genuine model improvements.

## Primary objective

Reduce **Silent Semantic Error Rate (SSER)** without materially increasing omissions, hallucinations, or unnecessary `UNCLEAR` outputs.

## Improvement targets

### 1. Better semantic fidelity

Potential failures to reduce:

- dropped negation or quantifiers;
- weakened/strengthened modality (`may` -> `must`, etc.);
- lost uncertainty or attribution;
- altered scope of conditions, exceptions, or temporal relations;
- speech-act confusion (question vs request, proposal vs instruction, intention vs fact);
- incorrect pronoun/coreference resolution;
- hidden assumptions or inferred facts.

### 2. Better ambiguity handling

The model should mark a genuinely material ambiguity with `UNCLEAR` rather than guess.

However, excessive `UNCLEAR` is also undesirable. We should measure both:

- silent arbitrary resolution;
- false-positive ambiguity.

### 3. Better handling of realistic conversation

The baseline dataset should be expanded with:

- multi-turn context;
- corrections and changing intent;
- irrelevant filler mixed with useful content;
- incomplete sentences and conversational shorthand;
- multiple speech acts in one utterance;
- domain-specific language;
- long turns containing nested conditions and constraints.

### 4. Smaller prompts

After fidelity is stable, reduce the formalization prompt while checking that SSER does not rise.

This matters for:

- smaller local models;
- lower latency;
- lower token cost;
- batching.

### 5. More compact CNL output

Only after semantic fidelity is demonstrated, test whether output can be shortened without losing explicit meaning.

Possible experiments:

- fewer repeated nouns after safe coreference;
- canonical shorthand for repeated conditions;
- a smaller speech-act vocabulary if two categories prove redundant;
- optional compact syntax for machine-only use.

Do **not** optimize compactness before fidelity.

### 6. Better evaluator independence

The current 50 examples are only a development/regression seed.

A serious evaluation should add:

- independently authored examples;
- hidden test data;
- human judgments;
- at least one judge model different from the generator;
- adversarial cases designed after the rules are frozen.

### 7. Model-size frontier

Measure how small the formalizer can become while retaining acceptable SSER.

Compare the same baseline contract across:

- frontier/reference model;
- Luna-class model;
- local ~4B;
- local ~1-2B;
- smaller models if results justify it.

## What should NOT be added yet

Do not add the following merely to improve normalization scores:

- ontologies;
- fixed predicate inventories;
- RDF/knowledge graphs;
- Prolog/Datalog/Z3;
- symbolic inference;
- theorem proving;
- hidden entity/relation extraction;
- automatic consequence generation.

Those belong to a later compiler/reasoner stage and would contaminate the experiment we are trying to measure.

## Experimental naming

Use:

- `baseline` — the fixed starting contract;
- `candidate-A`, `candidate-B`, ... — experimental rule/prompt changes;
- `model-X` — a model being evaluated with a fixed contract.

Example:

```text
baseline + Luna
baseline + Qwen-4B
candidate-A + Luna
candidate-A + Qwen-4B
```

Only after a candidate clearly outperforms the baseline on a held-out evaluation should we consider replacing the baseline.
