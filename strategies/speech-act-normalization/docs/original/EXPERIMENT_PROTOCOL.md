# Experiment Protocol

## Goal

Find the smallest/cheapest model that can formalize realistic conversational language into CNL-Core with a very low Silent Semantic Error Rate.

## Models

Run the identical baseline prompt against multiple model sizes/providers. Do not change CNL rules per model during the comparison.

Suggested sequence:

1. a frontier model as an approximate upper bound;
2. Luna or another small hosted model;
3. local 4B class model;
4. local 1–2B class model;
5. smaller models only if results remain competitive.

## Dataset construction

The bundled 50 records are a development/regression seed, not a publishable benchmark.

A real benchmark should contain at least several hundred independently written examples and should include:

- factual assertions;
- questions;
- requests/instructions;
- intentions;
- preferences;
- proposals;
- corrections;
- irrelevant conversational filler;
- uncertainty and attribution;
- negation and quantifiers;
- conditionals and exceptions;
- time and ordering;
- numerical constraints;
- comparisons;
- anaphora/coreference;
- genuine ambiguity;
- multi-turn context;
- mixed speech acts in one turn;
- domain language from software, research, business, daily tasks, and administration.

Keep a hidden test set that is not used while tuning the prompt/rules.

## Iteration discipline

When a model fails:

1. classify the failure;
2. decide whether it represents a general missing CNL rule or merely one model error;
3. change the rules only for general recurring failures;
4. create a named candidate contract (`candidate-A`, `candidate-B`, ...);
5. rerun all previous examples against both baseline and candidate.

Do not add ad-hoc examples/rules solely to make one benchmark item pass.

## Development objective

The preferred optimization order is:

1. minimize silent semantic errors;
2. minimize hallucinated meaning;
3. minimize meaning omissions;
4. maximize ambiguity detection;
5. maximize format validity;
6. only then reduce output tokens/latency.

## Baseline/candidate rule

`v0.1` is the baseline supplied in this repository. Preserve it unchanged when starting later experiments. If rules change, copy the baseline and name the next contract `v0.2`, `v0.3`, etc.
