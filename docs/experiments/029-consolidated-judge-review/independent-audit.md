# Independent audit of the judge review

The three Explicit Scope source texts, stored formalizations, and native CNL strings are unchanged from experiment 028 (direct equality checks passed for all three fields in all three cases). This experiment changes the judge execution, not the generated candidates. This audit used no model calls and changed no code or baseline results.

All three whole-document negative verdicts are independently defensible. The new explanations are not a reliable error inventory: they mix genuine losses with formatting complaints, claims contradicted by the CNL, and statements that retract earlier claims within the same output. Agreement on rejection does not establish superiority of this judge or validate each directional justification.

## consolidated/base/01-mixed-discussion

Correct concerns include omitted separation instructions, missing positive retention of important emails in the inbox, the shifted object of the speaker's doubt, the unrestricted final wh-queries, and replacement of the before-action prerequisite by `list -> NOT any_action`. Both-direction rejection is supportable because commands become asserted actions and several conditional relations change.

Questionable or incorrect reasons:

- Ordered arguments, explicit quantifiers, and formal representation of a belief are not semantic additions merely because the source expresses them in English. In particular, "every file" licenses universal quantification and "all my meetings" licenses the ownership restriction the judge lists as an addition.
- The 9am and 10am time strings are present. Normalizing one hour after 9am to 10am is ordinarily valid; it is not the decisive reminder error. The actual error is reversal: `remind_at_10 -> NOT marked_done`, instead of requesting the reminder when not done. The review's wording does not clearly diagnose that reversal.
- Window-seat content and an `earliest` argument are present. Whether the latter implements a true superlative is a legitimate concern, but reporting the entire window-seat/earliest-flight content as absent is inaccurate.
- `asked(Maria,Q(EXISTS u seen(u,her_keys)))` does retain existential question content. Missing person typing, key ownership resolution, or tense are defensible issues; introducing an existential for "anyone" is not itself an addition.
- Two questions about handling now and clarification are licensed by the two original question clauses. The real omission is the domain restriction "these requests", not their separation into two queries.
- `if not found then cancelled` is an ordinary truth-functional rendering of the stated unless-condition; concerns should identify the omitted finder "we", attribution, temporal or modal semantics rather than reject the connective rewrite categorically.
- The flight counterexample overstates what is asserted: the flight formula occurs as a proposition argument of `book`, not as a standalone asserted flight. The request-versus-fact distinction remains valid, but the counterexample must respect nested proposition scope.

Compared with 028, the changed `nl_entails_cnl=false` is more defensible. The reason is substantive force/scope error, not the extra formal notation named in `added`.

## consolidated/base/10-mixed-discussion

The review fills a baseline timeout with an independently defensible rejection. Clear losses include the written/day specification of notice, purchase-relative refund window, weekly overtime interval, permission/prohibition versus actual occurrence, explicit consent, all-times accompaniment, and the final request to identify contradictions without resolving them.

The explanation also contains substantial self-contradiction:

- It initially says the report's lateness is absent, later correctly derives it, and retains both accounts in `lost`. Let `L` be lateness and `D/H` the data-team/holiday causes. `NOT(L -> D) AND (L -> H)` is classically equivalent to `L AND NOT D AND H`. The lateness claim is not missing. Representing a cause with a predicate is not automatically a loss of causality.
- It alternately calls Ana's access an unsupported addition and accepts that the original licenses it. This should not be counted as a definite error without a declared treatment of "except".
- Several `lost` items explicitly conclude that the guest quantifiers, warranty negation, and annoyance distinction are correct. Such entries are confirmations, not losses.
- Many `added` items name source-licensed predicates or explicitly admit they are losses or "fine". They must not be counted as added facts.
- Inferring "per week" from an unspecified `work_hours_gt` name violates the requirement not to fill missing information. Likewise, declaring unqualified `NOT said(...)` equivalent to quantification over all times requires a specified temporal interpretation.
- `unused(item) -> available_refund(item,14)` does not explain the second argument's units or purchase anchor. The judge is right to flag that omission; its stronger claim that the CNL necessarily authorizes a refund after 20 days assumes a meaning of the undefined predicate that is not provided.

The categorical modality loss is sufficient to explain failure: a rule prohibiting an unconsented transfer can exist and be violated; an asserted implication from every actual transfer to consent rules out that violation. These meanings are different even if their vocabulary overlaps.

## consolidated/speech-acts/01-mixed-discussion

The overall rejection is correct. Lost probability/default status, model-domain restriction, explanation question, checklist ordering, and request force provide real evidence.

Definite review mistakes:

- Every entry in `added` is merely a `Statement N` or `Question N` label. Labels organize CNL and add no substantive proposition.
- The original explicitly says "Do **we** know whether...". Claiming that the CNL invents a specific "we" or loses an impersonal source reading is a reading error.
- `enough(small_model)` remains inside `believes(I,...)`; it is not promoted to an unqualified fact. The missing element is "probably" within the belief content, not the entire attribution or "I think".
- The resume-style check request changes speech-act force, not merely politeness. Describing that as a politeness loss understates the defect.

Important missed errors:

- `NOT FORALL x(user(x) AND hasAccess(x))` can be true merely because a non-user exists, even when every user has access. This is not the restricted universal from the source.
- `exactly_three(active("worker"))` does not structurally count three distinct active workers.
- Knowing whether includes knowing that the test failed; `knows(we,passed(test))` represents only knowledge of success. The judge discusses the nonexistent "we" change instead of this actual semantic distinction.

## Interpretation

Keep 029 as a separate rejudgment of fixed candidates; do not replace 028's stored evidence. Record the three independently supported whole-document rejections separately from confidence in their reasons. Do not use counts of `lost`, `added`, or `changed` entries as a quality metric here. This review supplies additional rejection evidence and resolves one timeout, but repeated negatives on already flawed documents do not measure false-positive resistance or prove that a stronger judge is consistently accurate.
