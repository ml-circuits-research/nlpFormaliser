# Current limitations

This is a research harness, not yet a universal semantic parser.

- The deterministic heuristic is intentionally shallow and performs poorly on the held-out semantic benchmark. It is a baseline/draft, not the proposed final solution.
- The bundled reasoner handles a Horn/Datalog-like subset with conjunction and explicit negative atoms. It does not execute arbitrary quantifier scope, nested modality, counterfactuals, probabilities, or full temporal logic.
- `contexts` and `ambiguities` preserve difficult semantics but are not yet given a complete operational semantics.
- The CNL renderer is deliberately mechanical. Predicate-specific templates improve readability, but semantic preservation is more important than fluent English.
- The LLM judge is a measurement instrument, not proof. Independent behavioral tests and human audits remain necessary.
- The preserved pilot benchmark is small (31 development + 29 held-out texts) and was partly model-authored/annotated. It is adequate for regression and falsification of shallow heuristics, not for publication-grade generalization claims.
- The OpenAI-compatible client assumes `/v1/chat/completions`; providers with a different protocol need a small adapter.
- External predicates are declarative only; the current runtime does not invoke arbitrary tools/code.

The immediate research task is to determine whether `proto-llm` or `repair` can match/directly beat `direct-llm` using a smaller model or materially lower cost while maintaining held-out semantic fidelity.
