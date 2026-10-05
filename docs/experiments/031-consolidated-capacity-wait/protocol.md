# Capacity-aware continuation

This is the canonical continuation of run 028 after Worker hardening. Same eight variants, ten cases, models, prompts and token caps. Reuse all completed semantic/syntax outcomes from 028; retry only infrastructure and judge errors, and generate unfinished cases. Run 030 was interrupted before adding new semantic evidence. Run 029 remains a separate targeted second-model audit and is not substituted into these scores.

Concurrency: two; batch size: one; cache: off; repairs: zero. The 240-second timeout now bounds an upstream generation attempt only. Provider 429 and local queue waits do not consume it or fail the task after a retry count. Capacity-aware waiting, cancellation cleanup, persistent server phase checkpoints, cooldown restoration and independently published results are covered by 78 passing Worker tests. The NLP suite also passes.

The evaluator uses the Pworker library plus proxy; its per-phase checkpoints are recorded in tasks.jsonl by onProgress. It remains responsible for restarting its own experiment process. Native server-owned Worker tasks additionally recover automatically by persistent task ID. Do not claim the evaluator's local process is itself a server-owned persistent task.

Every CNL mirror is isolated by experiment and strategy, for example `eval/fail/031-consolidated-capacity-wait/explicit-scope-logic/consolidated/base/01-mixed-discussion.txt`. Writes use exclusive creation and refuse overwrite. Source texts and frozen earlier results are unchanged.

Costs in the summary cover new calls only. Add the preserved 028, interrupted 030 and separate 029 costs when reporting total research expense. Provider retry attempts are logged separately by Worker; a high-level call count is not a provider-attempt count. Timeout costs can be unknown.
