# CNL-Core Baseline

CNL-Core is a deliberately small controlled-English intermediate representation for conversations and task-oriented text.

Its purpose is to test a simple hypothesis:

> A language model may be substantially more reliable at **natural language -> constrained simple English** than at direct natural language -> RDF / logic / predicates / graphs / executable code.

This repository is the frozen starting point for that experiment.

## What CNL-Core is

CNL-Core normalizes free English into one or more simple English lines. Each line has one explicit speech-act type:

- `ASSERT` — stated content, including attributed or uncertain statements.
- `ASK` — a question whose answer is requested.
- `REQUEST` — an instruction or requested action.
- `INTEND` — an intention or goal stated by the speaker.
- `PREFER` — a preference or soft constraint.
- `PROPOSE` — a proposed joint action or choice.
- `REVISE` — a correction/retraction/replacement of prior content.
- `UNCLEAR` — a material ambiguity that should not be silently guessed.

Example:

```text
Okay, I think Luna is probably enough, but don't switch yet. Check whether it gets at least 95%; if not, stay with Sol.
```

becomes:

```text
ASSERT: I think Luna is probably enough.
REQUEST: You do not switch yet.
REQUEST: You determine whether Luna gets at least 95%.
REQUEST: If Luna gets less than 95%, then you continue to use Sol.
```

## What CNL-Core is not

The baseline formalizer is **not** a symbolic reasoner and should not contain:

- an ontology;
- a predicate catalogue;
- RDF or knowledge graphs;
- Prolog/Datalog/Z3;
- theorem proving;
- semantic inference;
- hidden entity/relation extraction;
- automatic consequence generation.

The formalizer performs controlled rewriting only.

A later deterministic compiler may translate CNL-Core into symbolic structures, but that is explicitly outside this baseline.

## Why this repository contains code if formalization is done by an LLM

The code freezes the experiment around the model:

1. `buildFormalizationPrompt()` constructs the same formalization contract for any model.
2. `parseCNL()` parses model output.
3. `validateCNL()` checks only the surface format.
4. `canonicalizeCNL()` supports regression comparisons.
5. `eval.mjs` computes format validity and exact-match regression scores.

It does **not** claim to verify semantic correctness.

## Repository layout

```text
cnl-core-v0.1/
  cnl-core.mjs                 dependency-free library
  cli.mjs                      small CLI
  eval.mjs                     exact/format regression evaluator
  tests.mjs                    library tests
  package.json                 no external dependencies
  prompts/
    formalizer-system.txt      fixed small-model prompt
  examples/
    regression.jsonl           50-case baseline dataset
    sample-input.txt
    sample-output.cnl
  docs/
    DESIGN.md
    FORMALIZATION_RULES.md
    SEMANTIC_EVAL.md
    EXPERIMENT_PROTOCOL.md
```

## Requirements

Node.js 18+.

There are no npm dependencies and no installation step is required.

## Run tests

```bash
node tests.mjs
```

or:

```bash
npm test
```

## Generate a formalization prompt

```bash
cat examples/sample-input.txt | node cli.mjs prompt -
```

The resulting text can be sent to Luna, Qwen, or any other model.

The library deliberately does not contain a provider-specific API client.

## Validate model output

```bash
node cli.mjs validate examples/sample-output.cnl
```

## Parse CNL

```bash
node cli.mjs parse examples/sample-output.cnl
```

## Regression evaluation

Create a JSONL prediction file:

```json
{"id":"a01","output":"ASSERT: The server is running now."}
{"id":"a02","output":"ASSERT: I think the small model is probably enough."}
```

Then run:

```bash
node eval.mjs --gold examples/regression.jsonl --pred predictions.jsonl
```

This reports format validity and exact match. Exact match is intentionally **not** treated as semantic equivalence.

## Primary research metric

For the real experiment, the main target should be:

> **Silent Semantic Error Rate (SSER)**

A silent semantic error is a valid-looking CNL output that materially changes, invents, drops, strengthens, weakens, or guesses meaning without marking the issue as `UNCLEAR`.

A model that produces an `UNCLEAR` line is preferable to a model that confidently invents a meaning.

The semantic rubric and recommended evaluation protocol are in `docs/SEMANTIC_EVAL.md`.

## Baseline principle

CNL-Core Baseline intentionally optimizes for **semantic fidelity before compactness**.

Candidate experiments may reduce tokens or change the controlled form. Those changes must be measured against this baseline rather than silently folded into it.


## What can be improved

See `docs/IMPROVEMENT_TARGETS.md`. It separates open research questions from the fixed baseline contract and uses `candidate-A`, `candidate-B`, etc. instead of version numbers during experimentation.
