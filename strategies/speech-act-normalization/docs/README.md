# Speech Act Normalization

Public ID: `speech-act-normalization`. Legacy compatibility ID: `cnl-core`.

This source intentionally separates semantic normalization from ontology/program construction. It preserves ASSERT, ASK, REQUEST, INTEND, PREFER, PROPOSE, REVISE and UNCLEAR, along with natural-language scope, modality, attribution, reference ambiguity, time and constraints. Its research question is whether smaller models normalize meaning more reliably than they design symbolic programs directly.

The frozen baseline rules, examples, prompt builder, parser, validator and canonicalizer are retained. The 50 regression records preserve gold CNL, tags and supplied context; the multiline sample is imported separately. A valid prefix or a fluent round trip is not a reasoning result.

A future Normalization→Logic composition must expose and measure both stages: NL→normalized CNL and normalized CNL→formal representation. It must compare final formal CNL to original NL and quantify compounded loss. This is a valid extension hypothesis, not a reason to rewrite this baseline into predicate extraction.

Recovered [design](original/DESIGN.md), [normative rules](original/FORMALIZATION_RULES.md), [semantic evaluation](original/SEMANTIC_EVAL.md), [improvement priorities](original/IMPROVEMENT_TARGETS.md), and [experiment protocol](original/EXPERIMENT_PROTOCOL.md). The source explicitly prioritizes fidelity before compactness.
