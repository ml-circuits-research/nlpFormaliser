# Research roadmap

1. **Calibrate the judge** on corrupted pairs until pairwise discrimination is reliable.
2. **Benchmark small formalizer models** with `maxRepairs=0` and `1`.
3. Measure real tokenizer counts and latency, not character proxies.
4. Add held-out public semantic datasets and free-form technical/conversational text.
5. Add optional predicate canonicalization/ontology mapping without enlarging the fixed IR core.
6. Add explicit ambiguity alternatives when the input has genuinely multiple readings.
7. Only then test whether symbolic parsers (ERG/ACE/etc.) improve small-model accuracy enough to justify their complexity.
