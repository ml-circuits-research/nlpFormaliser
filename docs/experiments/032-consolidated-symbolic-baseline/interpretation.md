# Symbolic baseline while provider capacity is unavailable

Both deterministic variants ran on all ten selected consolidated cases without any LLM calls. Deterministic Rule Draft produced nonempty valid CNL for 3/10 cases; only 1/10 passed the existing reasoning screen. Discourse Semantic Graph produced structurally valid CNL for 10/10, but its archive explicitly lacks a complete downstream reasoning compiler, so 0/10 are reasoning-eligible.

No equivalence judgments were requested. Equivalence accuracy is **unmeasured**, not 0% or 100%. Files under `eval/fail/032-consolidated-symbolic-baseline/<strategy>/...` mean not accepted, including not-yet-judged cases. The matching `mirror-index.json` records the precise statuses. These results show extraction/representation coverage only; they do not validate whole-document semantics.
