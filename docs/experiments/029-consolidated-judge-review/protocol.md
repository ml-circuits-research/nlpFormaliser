# Targeted second-model review

This experiment rejudges three frozen Explicit Scope Logic artifacts from run 028: base/01 (independent audit disputes one entailment direction), base/10 (initial judge timeout), and speech-acts/01 (mixed force and modality). Selection is diagnostic and deliberately not random; do not estimate judge accuracy or strategy success from this subset.

The original full rows are preserved in `../028-consolidated-first10/review-inputs.jsonl`. No NL, formalization, CNL or strategy is regenerated or repaired. The same bidirectional rubric and native CNL are used with `openference/DeepSeek-V4-Flash-0731`, through the predefined Pworker judge task. Cache, fallback and cut retries are disabled; batch size is one, concurrency two, output cap 6,000 tokens and timeout 120 seconds.

This is a different-model check, not a claim that DeepSeek is universally stronger or ground truth. Compare verdict directions and concrete reasons against the independent audit. Keep run 028's original outcomes unchanged, including its timeout.
