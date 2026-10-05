# LLM protocol

## Formalizer

Input: NL text.

Output: **only** MicroIR wire syntax. No Markdown and no explanation.

The prompt instructs the model to preserve:

- explicit entities/types and relations;
- predicate argument order;
- negation and its scope;
- quantifier scope;
- conditions and exceptions;
- modality and attribution/belief;
- time and event order;
- quantities;
- coreference;
- question force.

## Judge

Input: ORIGINAL NL + deterministic CNL.

Output:

```json
{"s":0.97,"eq":false,"miss":["next month"],"add":[],"chg":[],"amb":[]}
```

The compact keys reduce protocol tokens.

- `s`: semantic fidelity score in `[0,1]`;
- `eq`: semantic equivalence judgment;
- `miss`: information present in NL but absent from CNL;
- `add`: information added by CNL;
- `chg`: changed meaning;
- `amb`: unresolved ambiguity that materially affects equivalence.

## Repair

Input: original NL, current IR, and the judge's compact differences.

Output: corrected MicroIR only.

The pipeline re-renders CNL and re-judges. The best score seen is retained.

## Independence

For research evaluation, use a judge model different from the formalizer whenever possible. Same-model judging is useful operationally but is not strong evidence of correctness.
