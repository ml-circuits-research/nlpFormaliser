# Formalization Rules — CNL-Core Baseline

This file is normative for the v0.1 experiment.

## 1. Allowed line types

Exactly these eight prefixes are allowed:

```text
ASSERT:
ASK:
REQUEST:
INTEND:
PREFER:
PROPOSE:
REVISE:
UNCLEAR:
```

## 2. Preserve explicit meaning

Do not add information that the source does not state.

Source:

```text
John is Mary's father.
```

Allowed:

```text
ASSERT: John is Mary's father.
```

Do not additionally emit `Mary is John's child.` even if that inference is normally valid.

## 3. One main semantic unit per line

Split independently assertable/requested units.

```text
John opened the file and read the report.
```

becomes:

```text
ASSERT: John opened the file.
ASSERT: John read the report.
```

Do not split expressions when doing so destroys scope or conditions.

## 4. Preserve scope

`Not every A is B` is not `No A is B`.

`John did not say that Maria failed` is not `John said that Maria did not fail`.

A formalizer must prefer a slightly less simplified sentence over a scope-changing rewrite.

## 5. Preserve quantification

Preserve explicit words such as:

```text
every
some
no
not every
only
exactly
at least
at most
```

Do not silently insert quantifiers that are absent.

## 6. Preserve modality

Preserve distinctions among:

```text
must
should
may
can
might
```

Do not normalize all of them to one relation.

## 7. Preserve uncertainty and epistemic stance

```text
I think X.
Probably X.
Apparently X.
Maria reports that X.
```

must not be reduced to:

```text
ASSERT: X.
```

unless the source itself states X directly.

## 8. Questions

Questions use `ASK`.

The formalizer must never answer the question.

## 9. Requests and polite questions

An imperative uses `REQUEST`.

A grammatical question such as:

```text
Could you check whether the tests pass?
```

uses `REQUEST` when its pragmatic function is clearly to ask the assistant to perform the check.

A genuine capability question remains `ASK`:

```text
Can Luna run on this hardware?
```

## 10. Intentions

Statements of a speaker's intended future action or desired task use `INTEND`.

```text
I'm going to test Luna tomorrow.
```

becomes:

```text
INTEND: I will test Luna tomorrow.
```

## 11. Preferences

Soft constraints or preferred alternatives use `PREFER`.

```text
I'd rather use the smaller model.
```

becomes:

```text
PREFER: I prefer to use the smaller model.
```

## 12. Proposals

Suggestions for joint or future action use `PROPOSE`.

```text
Let's use Luna first.
```

becomes:

```text
PROPOSE: We use Luna first.
```

## 13. Revisions

Corrections to previously mentioned content use `REVISE` when the correction is explicit.

```text
Actually, Monday, not Friday.
```

with adequate context becomes:

```text
REVISE: The deadline is Monday, not Friday.
```

## 14. Coreference

Resolve a reference only when its intended referent is unambiguous from supplied text/context.

If ambiguity is material, preserve it explicitly:

```text
ASSERT: Maria told Ana that PERSON_1 should leave.
UNCLEAR: PERSON_1 refers to Maria or Ana.
```

Placeholders are local labels, not ontology entities.

## 15. Filler

Remove discourse filler only when it contributes no propositional or pragmatic content:

```text
well
okay
hmm
let's see
you know
```

However, do not remove stance hidden inside conversational language:

```text
I guess
I think
probably
maybe
apparently
```

## 16. Conditions and exceptions

Preserve `if`, `only if`, and `unless` explicitly.

Avoid converting them into logically stronger or weaker expressions during normalization.

## 17. Temporal relations

Preserve meaningful temporal relations:

```text
before
after
while
until
first
then
```

Splitting a sequence into lines must not erase the ordering constraint.

## 18. Output discipline

Model output contains only CNL-Core lines.

Do not emit:

- explanations;
- markdown;
- JSON;
- predicates;
- RDF;
- code;
- confidence scores;
- inferred facts.
