# Matched strategy complementarity

Diagnostic based on judge labels; not a validated ensemble.

| Left | Right | Shared / labeled | Left only | Right only | Both wrong | Oracle gain |
|---|---|---:|---:|---:|---:|---:|
| compact-scope-logic | direct-context-logic | 8 / 0 | 0 | 0 | 0 | unmeasured |
| compact-scope-logic | evidence-guided-logic | 8 / 0 | 0 | 0 | 0 | unmeasured |
| compact-scope-logic | explicit-scope-logic | 8 / 0 | 0 | 0 | 0 | unmeasured |
| direct-context-logic | evidence-guided-logic | 8 / 4 | 1 | 0 | 0 | 0.0% |
| direct-context-logic | explicit-scope-logic | 8 / 6 | 0 | 0 | 1 | 0.0% |
| evidence-guided-logic | explicit-scope-logic | 8 / 4 | 0 | 1 | 0 | 0.0% |

- Labels are model judgments, not independently established semantic truth.
- Oracle selects using the evaluation label: it is an optimistic diagnostic, not a deployable selector.
- Unknown/unpaired outcomes are reported, not converted into semantic failures or successes.
- Intervals assume independent cases; corpus duplicates and correlated judgments weaken that assumption.
- Do not learn routing rules on heldout data or treat related strategies as independent votes.
