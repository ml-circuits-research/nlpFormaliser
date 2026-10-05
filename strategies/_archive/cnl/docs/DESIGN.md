# CNL-Core Baseline Design

## Research question

Can a relatively small language model reliably convert realistic conversational English into a constrained, explicit, simple-English representation while preserving meaning and exposing ambiguity?

The crucial comparison is not whether the output is elegant. It is whether the transformation has a substantially lower semantic error rate than direct NL -> symbolic representation.

## Architecture

```text
free natural language
        |
        v
  small language model
        |
        v
     CNL-Core
        |
        +---- human/model semantic evaluation
        |
        +---- later deterministic compiler (future work)
```

Only the first arrow is part of this baseline.

## Design decision: English vocabulary remains open

CNL-Core Baseline does not define predicates such as `owns`, `plan_time`, or `is_member_of`.

For example:

```text
ASSERT: Alice plans the meeting time.
```

is valid CNL-Core.

The representation intentionally postpones the decision whether a later compiler should interpret this as a relation, event, frame, predicate, or program operation.

This is important because forcing predicate selection during NL normalization mixes two independent failure modes:

1. understanding/paraphrasing the original text;
2. designing a formal ontology/program representation.

CNL-Core evaluates the first problem in isolation.

## Design decision: speech acts are explicit

Ordinary factual English does not distinguish enough between conversational actions. These are semantically different:

```text
ASSERT: Sol is faster.
ASK: Is Sol faster?
REQUEST: You determine whether Sol is faster.
INTEND: I want to determine whether Sol is faster.
PROPOSE: We determine whether Sol is faster.
```

The small fixed prefix set prevents these differences from being lost during simplification.

## Design decision: ambiguity is an output, not a failure

When the input does not determine one interpretation, the formalizer must not manufacture certainty.

Example:

```text
Maria told Ana that she should leave.
```

becomes:

```text
ASSERT: Maria told Ana that PERSON_1 should leave.
UNCLEAR: PERSON_1 refers to Maria or Ana.
```

The placeholder is deliberately lightweight. It does not imply an entity model.

## Design decision: semantic operators remain natural-language operators

The following should normally survive normalization explicitly:

- negation: not;
- quantification: every, some, no, exactly, at least, at most, only;
- modality: must, should, may, can;
- uncertainty: probably, possibly, apparently, perhaps;
- attribution: X says/thinks/reports that ...;
- conditionals: if, only if, unless;
- time: before, after, while, until;
- comparison: more/less/faster/slower than.

No logical notation is required in the baseline.

## Non-goals

CNL-Core Baseline does not attempt to:

- prove that two sentences are logically equivalent;
- resolve world knowledge;
- infer unstated causal relations;
- build a knowledge graph;
- identify a universal set of semantic primitives;
- optimize the representation for minimum token count;
- execute the representation.

These may be later experiments once the normalization hypothesis is measured.
