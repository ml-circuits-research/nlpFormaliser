# Independent audit of the restored comparison

Read-only inspection of all 16 Lab candidates by a separate agent after experiment completion; no additional model-provider calls. This is an independent qualitative audit, not adjudicated ground truth. Original artifacts and labels are unchanged.

| Case | Evidence and implication |
|---|---|
| C10 | Direct and evidence-guided candidates have the same source and CNL but opposite labels. The evidence-guided rejection relies only on capitalization. Do not treat duplicate outputs as independent votes. |
| C31 | Direct uses `allowed(robot,move)` while evidence-guided uses `allowed(move,robot)` and renders "move allowed robot". Without declared predicate signatures, accepting both obscures role ambiguity. |
| C06 | Direct omits the temporal ordering expressed by "then". Evidence-guided reifies the events and preserves `before(e1,e2)`; its failed reference queries partly reflect vocabulary/arity differences. Its judge call failed, which is not a semantic rejection. |
| C27 | Direct adds exclusivity; evidence-guided also records an exclusive alternative whose type the native CNL renderer omits. Original attribution to the log is not faithfully represented. |
| C07 | Direct encodes the conclusion in the zero-argument predicate `scheduler_moves_new_jobs_elsewhere()`. A fluent paraphrase is not proof of compositional argument structure. Evidence-guided represents the rule more explicitly despite the judge's uncertainty. |
| C25 | Both convert the counterfactual into an ordinary Horn implication. Negative/UNKNOWN controls do not validate preservation of counterfactual semantics. |
| C05 | Direct encodes event types only through identifiers `e_approval` and `e_audit`, with unary `event_type(...)`. Renaming those identifiers removes the meaning inferred by the judge. Evidence-guided explicitly represents approval/audit and their roles; failed native reference queries do not alone refute that reified representation. |
| C01 | Evidence-guided explicitly types a workstation witness. Direct relies on a constant named `workstation`. The native probe's exact constant match can favor the less explicit representation. |

Follow-up controls: rename opaque event identifiers; reverse arguments with explicit signatures; remove/restore temporal edges; verify preservation of ambiguity alternatives. Keep semantic fidelity, compositionality and reference-vocabulary compatibility as separate axes. None of these eight-case observations establishes a reliable competence router yet.
