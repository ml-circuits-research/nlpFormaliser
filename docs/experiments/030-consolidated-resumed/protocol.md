# Infrastructure continuation of run 028

This run completes the same eight strategies on the same ten documents. It is an explicit continuation, not a fresh independent sample. It retains run 028's 30 saved rows wherever there is a semantic verdict or syntax failure. Only absent results, infrastructure failures and judge errors are retried. A valid formalization with judge error is rejudged without regeneration. Negative or uncertain semantic verdicts and malformed representations are never retried to improve scores. Repairs remain zero.

Changes: concurrency is reduced from five to two, per-call deadline increased from 120 to 240 seconds, and Pworker cancellation now removes queued jobs before they consume starts or call an upstream. The proxy was restarted. Model IDs, generation/judge prompts, token caps, source texts, native CNL and strategy implementations are unchanged. Resume verifies semantic source hashes and exact inputs. Each row records reuse/generation/rejudgment provenance; original run 028 is untouched.

Provider logs showed HTTP 429, a reported rate limit of 15, retry-after delays, and deferred already-aborted attempts after the client timed out. Local configuration already had a 15/minute cap; it is not evidence that a syntax strategy is worse. The cancellation fix prevents cancelled jobs from occupying the queue or consuming later rate slots. It does not promise to eliminate upstream throttling.

All calls still execute predefined Pworker tasks. Batch size stays one to isolate format failures. No simultaneous second-model experiment runs during this continuation. New-call costs in summary.json are incremental: total research cost also includes run 028 and the separate three-case review in 029. Missing timeout costs remain unknown.

Whole-document acceptance remains strict and reasoning eligibility remains only a screening aid. Independent audit has already found invalid entailment directions and renderer/schema losses missed by the judge or screen. Report those findings beside percentages; no reliability claim follows from an all-negative judge consensus.
