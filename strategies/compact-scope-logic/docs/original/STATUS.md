# Current status

## Implemented and executable

- compact MicroIR builders with dynamic `$.predicate(...)` functions;
- safe wire parser/serializer without `eval`;
- structural validation and normalization;
- deterministic readable CNL renderer;
- deterministic compact judge-CNL renderer;
- provider-agnostic formalize/judge/repair pipeline;
- OpenAI-compatible HTTP adapter;
- bounded repair loop that retains the best candidate;
- CLI for render/validate/formalize/judge/pipeline;
- 30-case realistic semantic benchmark;
- 11 good-vs-corrupted judge pairs;
- unit/integration tests;
- static and compactness evaluations.

## Requires an external/local LLM endpoint to execute

- real `NL -> MicroIR` formalization evaluation;
- real `NL vs CNL` semantic judge evaluation;
- automatic repair quality evaluation.

No LLM accuracy numbers are bundled as if they had been measured. The scripts are present so the same benchmark can be run against local Qwen/other models and an independent judge.

## Not implemented yet

- ontology/predicate canonicalization (`buy` vs `purchase`);
- theorem proving or general inference engine;
- first-class ambiguity operator;
- ERG/ACE/UDepLambda integration;
- tokenizer-specific token accounting.

These are intentionally deferred until the minimal strategy is empirically evaluated.
