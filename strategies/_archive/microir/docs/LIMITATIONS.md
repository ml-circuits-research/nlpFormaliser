# Current limitations

1. **No claim of solved NL semantics.** The library is an experimental strategy and evaluation harness.
2. **Open predicate vocabulary is not canonicalized.** `buy` and `purchase` remain distinct unless a later ontology layer maps them.
3. **The CNL is intentionally mechanical.** It optimizes semantic visibility, not readability.
4. **LLM judging is not ground truth.** A same-model formalizer/judge can share blind spots. Pairwise judge evaluation and independent judges are therefore essential.
5. **No full theorem prover is included.** MicroIR captures logical structure but this package focuses on formalization fidelity, not inference completeness.
6. **Discourse/state semantics are shallow.** Cancellation, defaults, tense, presupposition, implicature and defeasible reasoning need explicit future extensions or domain predicates.
7. **Ambiguity policy is not yet formalized as a first-class fixed operator.** The formalizer should avoid inventing a reading; future versions may encode alternative readings explicitly.
