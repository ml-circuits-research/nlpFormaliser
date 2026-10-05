# Independent paired-rendering audit

A separate read-only agent inspected all eight pairs from 019 and 021. Stored formalizations are byte-for-byte identical. The common projection preserves operators, variable binding, argument order, constants and proposition-valued arguments on these cases. No projection loss was identified. This is sample-specific evidence, not certification of every future adapter.

- C06: both renderings lack the temporal relation licensed by "then". The negative-to-uncertain judgment change does not remove this generation error.
- C07: the judge's argument about an existential antecedent is logically unsound: `(exists x P(x)) implies Q` is equivalent to `forall x (P(x) implies Q)` when x is not free in Q. The actual concern is the existential single-job consequent versus generic/plural movement of new jobs. It predates projection.
- C05: report/audit type atoms are not automatically unsupported additions; those types are already expressed by the source nouns. `person(Dana)` is an additional assumption, and past tense is not explicit. The judge's negative verdict needs these specific grounds, not a blanket rejection of type atoms.
- C27: both positive judgments overlook the stronger exclusive reading chosen for an ambiguous disjunction, and possible loss in attributing unresolved identity to the log.
- C25: both correctly reject the replacement of a counterfactual by material implication. A `Statement 1` label is presentation, not an added semantic assertion.
- C10/C31/C01: equivalence is plausible; faithful modal projection does not imply an implemented modal reasoning engine.

Single judgments cannot separate model variability from rendering sensitivity. Repeat paired judgments and control semantic perturbations before claiming one CNL is better or training a competence router.
