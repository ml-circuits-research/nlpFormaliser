# Judge calibration for consolidated documents

Experiments 024–027 compare four models through predefined Ploinky Workers tasks and the configured Openference subscription. No direct model API calls or repair are used. Each control is an individual request, with at most two concurrent requests, a 6,000-token output cap, 90-second timeout and caching disabled.

The 16 controls contain six positives and ten negatives: long-document identity, lexical and question paraphrases, conjunction ordering, deterministic scoped CNL with ordered arguments, omitted emotion/question/instruction, invented authorization, question-to-assertion and instruction-to-completion changes, negation scope, role reversal, modality and attribution. Labels follow controlled transformations, not another LLM. Identity positives calibrate the judge only; copying input is not an acceptable formalization.

The judge compares NL against CNL in both directions. For questions and requests it compares requested information/action and constraints, not truth entailment. Both directions must be true without reported differences for equivalence. False in either direction means non-equivalence; unknown remains uncertain. Malformed or contradictory JSON is a judge error, never a semantic rejection.

| Requested model | Correct / attempted | False accepts | False rejects | Errors | Reported subscription credits |
|---|---:|---:|---:|---:|---:|
| GPT-OSS-120B | 16/16 | 0 | 0 | 0 | 1.6 |
| DeepSeek-V4-Flash-0731 | 15/16 | 0 | 1 | 0 | 12 |
| Qwen3.8 27b | 12/16 | 0 | 0 | 4 | 1.4 known; two requests unknown |
| DeepSeek-V4.1-Flash | 0/2 | 0 | 0 | 2 | Unknown |

DeepSeek V4 rejected the positive ordered-argument native CNL. Qwen errors occurred on question paraphrase, conjunction ordering, modality and formal ordered arguments. V4.1 stopped after two provider failures: availability evidence, not an accuracy estimate. Missing costs are not zero. Catalog token-price estimates are separate and are not subscription charges.

Decision: **GPT-OSS-120B is the provisional judge**. This small control set does not establish general reliability on long imperfect generated CNL. Independent artifact review remains necessary.

Evidence: [Qwen](../experiments/024-judge-qwen-consolidated/summary.json), [GPT-OSS](../experiments/025-judge-gptoss-consolidated/summary.json), [DeepSeek V4](../experiments/026-judge-deepseek-flash-consolidated/summary.json), [DeepSeek V4.1](../experiments/027-judge-deepseek41-consolidated/summary.json). Each directory preserves controls, rubric, requests, responses, progress, settings and catalog. The served-header list is empty for explicitly routed requests; requested upstream/model and raw responses are preserved. An empty list is not independent confirmation of the serving model.

Run 028 also uses GPT-OSS for generation, with one fixed model across strategies. Judge calibration does not calibrate generation. Shared model errors can correlate: do not treat agreement as proof. The ten cases are selected development material, not heldout data. No formalization is repaired during this run.
