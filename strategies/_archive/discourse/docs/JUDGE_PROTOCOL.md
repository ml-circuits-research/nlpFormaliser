# Semantic judge protocol

Protocol identifier: `nl2cnl-semantic-judge/1`.

## Why the judge sees CNL rather than the AST

The AST is the machine representation, but the CNL is intentionally a faithful readable serialization of the AST. Showing the CNL to the judge:

- reduces prompt complexity;
- lets the model compare language with language;
- makes omissions and additions easy to cite;
- avoids teaching the judge implementation-specific JavaScript objects.

The symbolic audit still works over the AST.

## Required checks

For every candidate, the judge checks:

1. conversational speech act;
2. entity identity and coreference;
3. events/predicates and roles;
4. quantifiers/cardinality;
5. negation and scope;
6. modality;
7. conditions/alternatives;
8. temporal semantics;
9. causality/purpose;
10. comparisons/constraints/exclusions;
11. missing source meaning;
12. invented CNL meaning.

## Verdicts

`equivalent`
: The candidate preserves the material meaning of the source in context and does not add material meaning.

`not_equivalent`
: There is at least one material omission, addition, wrong role, wrong scope, wrong reference, or wrong speech act.

`uncertain`
: Context does not license a unique reading, or the judge cannot establish equivalence confidently.

## Response shape

```json
{
  "protocol": "nl2cnl-semantic-judge/1",
  "batch_id": "judge-1",
  "results": [
    {
      "turn_id": "t10",
      "verdict": "equivalent",
      "confidence": 0.94,
      "missing": [],
      "invented": [],
      "scope_errors": [],
      "reference_errors": [],
      "speech_act_error": null,
      "reason": "Temporal order, obligation, agent and theme are preserved."
    }
  ]
}
```

The library validates the protocol, batch ID, completeness, verdict vocabulary, arrays and confidence range before accepting the judge response.

## Batched validation

`buildJudgeBatches()` respects `maxItems` and `maxChars`. A single LLM call can therefore judge tens of candidates.

For benchmarking, `policy: "all"` is preferable because it allows direct estimation of judge-detected failures. For runtime use, `policy: "sampled"` usually offers a better cost/risk trade-off.
