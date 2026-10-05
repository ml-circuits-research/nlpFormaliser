# Independent semantic audit

## Scope and status

Initial snapshot: the first five stored rows, all `explicit-scope-logic`, with IDs `consolidated/base/{01,04,07,10,14}-mixed-discussion`. The experiment was still running. This is a read-only inspection of source NL, stored formalization, native CNL, worker verdict, and eligibility; no model calls or changes to running code were made. Later rows have not yet been audited. These observations are debugging evidence, not a strategy ranking.

All five rows are marked `audit.eligible=true`. That flag does not certify preservation of command force, decomposition of predicate names, or operational semantics of modal/propositional arguments. The deterministic native CNL generally exposes the losses already present in the generated IR; the problems below are not repaired by fluently paraphrasing that CNL.

## Case-specific findings

### explicit-scope-logic / 01-mixed-discussion

The worker correctly rejects whole-document equivalence, but its explanation identifies only missing quantitative detail and the activity of tracking details in the frustration sentence. Its `nl_entails_cnl=true` and assertion that all requests are represented are not justified.

- Commands such as booking, renaming, ordering, cancellation, and archiving become asserted predicates or ordinary implications. No request/obligation operator distinguishes desired actions from facts. A world in which the requests have not been carried out satisfies the request text without satisfying these asserted actions.
- The second reminder is reversed: `remind(...10am) -> NOT marked_done(...)` does not request another reminder when the task remains incomplete. With no 10am reminder the implication is vacuously satisfied even if the task remains undone.
- `send(...) -> NOT cc_any(sales_team)` does not itself request sending the slides.
- The important-email exception becomes `NOT flagged_important_inbox(z)` in an archive condition. This conflates importance with inbox location and omits the positive instruction to retain important emails in the inbox.
- `NOT convinced(I, thinks(Tom, ...))` changes the object of doubt: the source doubts the crash explanation, not necessarily whether Tom holds that belief. The unary `because_of(memory_leak)` also lacks a structural link to the crash.
- `list(unresolved_questions()) -> NOT any_action()` is not the temporal prerequisite "list ... before taking any action". It may prohibit all action after listing while imposing no obligation to list first.
- The final wh-queries lack the restriction to "these requests". The separate-situations instruction is absent. Emotion is retained only approximately: `frustrated_by(I, unrelated_details(I))` loses the tracking burden and its quantity.

### explicit-scope-logic / 04-mixed-discussion

The worker's negative verdict is supported by genuine errors, including scope, hotel selection versus all hotels, and quantitative details. Some explanations need qualification.

- `NOT FORALL x(schedule(x) -> before10(x) AND Monday(x))` is the wrong formula for a prohibition on Monday-before-10 scheduling. It implies the existence of a scheduled item outside that intersection. With no scheduled items it is false, whereas the prohibition can be respected. It is therefore not merely a uniformly "weaker" restriction, as the judge describes it.
- The hotel requirement becomes a factual universal assertion about every hotel, losing both selection and deontic force. Currency and per-night units are absent.
- `budget(laptop,1200)` drops "around" and dollars. `requiresMemory(laptop,16)` omits an explicit lower-bound operator and gigabyte unit; whether that predicate means exactly or at least 16 is undefined, so the judge should not confidently infer exact equality from its name alone.
- The night-flight preference uses an unbound *constant* `f` and does not express an override of the general aisle preference.
- `relieved(I)` loses the object of relief, "we are finally making progress"; `impatient(I)` loses the continuation conveyed by "still".
- `reasonFor("x",w)` refers to a string constant, not the queried item bound by `W(v,...)`. The question about what to check and why is disconnected.
- Nullary `ignoreLastMessage`, `doNotSend`, and `independentTasks` hide reference, scope, or command content in lexical names. The pre-send paragraph change is not encoded as an ordering constraint.

### explicit-scope-logic / 07-mixed-discussion

The worker correctly rejects equivalence for loss of "usually", hypothetical/counterfactual meaning, project typing, and request force. In particular, an ordinary universal rule about every cat is stronger than "cats usually sleep during the day".

- The budget query `W(u, budgetCut(...) -> dropFirst(u))` has an additional vacuity problem: if the budget-cut antecedent is false, every entity satisfies the material implication. A query under a supposition is not that unrestricted answer set.
- The resume request becomes a yes/no query about an implication rather than a request to review the speaker's resume. `takeLookResume(you)` hides the reviewed object and its owner.
- The worry is structurally attributed to the speaker rather than asserted as a fact, which is useful, but "in this discussion" and the identity/type of the restriction are only implicit in lexical names.
- The first and last instructions keeping separate situations/requests independent are omitted.
- The judge calls the lottery hypothetical a "counter-factual past" conditional. That is too specific: a remote future hypothetical does not necessarily assert an unreal past. The underlying loss of hypothetical modality remains real.

### explicit-scope-logic / 10-mixed-discussion

The worker timed out; there is no semantic vote. Independent inspection finds definite losses, so this is not an unassessed plausible success.

- Transfer of personal data becomes a factual implication from transfer to consent, and the child-accompaniment requirement becomes an asserted regularity. These do not preserve permission/prohibition/obligation or distinguish rule violation from logical inconsistency. "Explicit" consent and "at all times" are omitted.
- `notice(u,30)` loses written form and day units. `unused(v) -> available_refund(v,14)` loses purchase-relative timing. `work_hours_gt(w,40)` loses the per-week interval.
- "Never said" becomes an unqualified negated saying predicate, without temporal scope. The request to identify and point out contradictions, and the prohibition on resolving them without asking, become only `Q(EXISTS conflict(...))` or disappear.
- `eq(x,Ana)` is an open lexical predicate; actual identity reasoning requires declared equality semantics. Its name alone is not an equality axiom.
- The delay-causation formula is unusual but should not be rejected solely for using implication: `NOT(late -> cause_data)` is classically `late AND NOT cause_data`; together with `late -> cause_holidays` it entails lateness and the holiday cause. Temporal/event-role interpretation remains underspecified, but the Boolean connective pattern itself is not necessarily a reversal.
- The annoyance distinction (delay versus helper) is substantially retained. `person_helping_me` still packages the helping relation as a constant label.

### explicit-scope-logic / 14-mixed-discussion

The worker correctly rejects equivalence for lost separation instructions and biweekly frequency. However, its `nl_entails_cnl=true` and claim that all other sentences are captured overlook substantial losses.

- Instructions to revert commits, disable/enable caches, move a call, and provide a checklist become asserted actions. Requested changes are not facts that follow from issuing those requests.
- `revertLastTwoCommits(featureBranch)` and `leaveUnrelatedTasksIndependent()` package cardinality/order or an entire instruction into predicate names. The lexical opacity screen does not catch camelCase names.
- The schedule loses "every other". `expiresAfter(contract,lastPayment,30days)` does not explicitly relate expiry to *receipt* of the last payment.
- `read(you,this) -> leftFor(I,airport)` loses the explicit before-reading temporal relation and future-perfect framing; a material conditional does not supply that ordering.
- The relief proposition about shared progress is preserved better than in case 04, but "finally" and "still" remain absent.
- The explanation question contains `shouldBeCheckedFirst("x")` with a constant string, not the variable bound in the preceding `W(x,...)`. The two question parts are not structurally linked, and `Q(why(...))` asks a truth value rather than returning a reason.

## Implications for consolidation

1. Preserve the worker's correct whole-document rejections, but do not treat its listed reasons as an exhaustive error inventory or its directional entailments as independently validated.
2. Track command force, reference binding, temporal prerequisites, quantified exceptions, and emotional content separately. A single document-level false verdict hides large differences in what was lost.
3. Eligibility needs a distinction between syntactic exportability and reasoning-ready semantics. CamelCase/nullary predicates and open lexical `eq` or modal names can pass current screening without providing the required operations.
4. No positive ranking follows from these initial five rows. The timeout is an infrastructure/judging failure, not an equivalence verdict. Additional strategies and rows require separate inspection.

## Extension: snapshot of 15 rows

This extension covers the remaining five Explicit Scope cases and the first five Evidence Guided rows. It supersedes the initial snapshot's coverage statement, not its findings. Code remains unchanged and no additional model calls were made by this auditor.

### explicit-scope-logic / lab-development/01-mixed-discussion

The overall rejection is correct. The worker notices the omitted Leo episode and final instruction, but `nl_entails_cnl=true` overlooks further generation errors. `after(audit, approved_by(report,Dana))` reverses the ordinary argument direction for the source's approval-after-audit relation; accepting a different direction would require an explicit signature. The reviewer rule turns a prohibition into `NOT approve(u,v)`, a factual non-occurrence, so a prohibited but actually performed approval cannot be represented. The source does not entail compliance. Types such as sensor, catalyst, reaction, and the owned workstation are not independently represented. `paper7` has no paper typing to satisfy the generated reviewer rule's guard. The annoyance contrast is substantially preserved, but its helper relation remains packaged in a constant.

### explicit-scope-logic / lab-development/02-mixed-discussion

No formalization/CNL is stored, so no semantic comparison is possible. This is a generation/execution failure, not a negative semantic vote.

### explicit-scope-logic / scope/01-mixed-discussion

The negative verdict is well supported, but its error inventory misses several decisive adversarial traps.

- Employees' obligation to complete training becomes `employee(x) AND handlesCustomerData(x) -> completedPrivacyTraining(x)`. With Ana's premises the IR proves completion, although the source gives only a duty. This is a definite behavioral error.
- Permission to download becomes actual `downloaded(Niko,dataset)`, and the permission condition becomes a rule about actual downloads. The registration answer may remain the same while the representation invents the completed download.
- The approval-before-release obligation is reversed into approval implying release and loses temporal precedence. `exceeds(P7,12500)` also misstates "is for 12,500": exact amount is not strictly exceeding that amount, and there is no numeric semantics automatically linking lexical `exceeds` atoms.
- The two failed sensors disappear: a universal rule says any failed object was not replaced, without asserting two failures or sensor types. The three author-paper witnesses have no explicit distinctness or paper typing.
- Archiving after reading loses its temporal relation. Question force about certainty/necessity is also reduced, as the worker notes. Frustration is reduced to `frustrated(speaker,details)`, and the before-action instruction becomes a nullary label.

The worker's sentence that all atoms correspond to some source clause is not a validation: predicates can use source words while changing modality, participants, quantities, or implication direction.

### explicit-scope-logic / speech-acts/01-mixed-discussion

The worker correctly rejects lost probability, normality, request force, emotion nuance, and checklist constraints. Additional substantial errors remain:

- `NOT FORALL x(user(x) AND hasAccess(x))` is not "not every user has access". A single non-user makes it true even if every user has access. The restricted universal must use implication, or an existential user lacking access.
- `exactly_three(active("worker"))` applies an undefined lexical predicate to a proposition about one constant. It does not structurally count three distinct active workers.
- Knowing whether a test passed differs from knowing that it passed: knowledge that it failed answers the original positively but does not satisfy `knows(we,passed(test))`.
- The minimum-latency query omits the model type and comparison domain. These are generation losses faithfully displayed by CNL.

The judge's broad statement that omissions imply failure of NL-to-CNL entailment is not generally valid; omission alone usually affects the reverse direction. Here there are independent scope/modality changes that can support rejection of both directions.

### explicit-scope-logic / dialogue/01-mixed-discussion

Generation returned `no answer within 120 s`; there is no stored formalization or CNL to audit. Do not infer that the dialogue meaning was judged non-equivalent.

### evidence-guided-logic / base/01-mixed-discussion

The overall negative verdict is justified, but one central judge claim is demonstrably wrong: archive time scope is present in both IR (`request_archive_emails(last_quarter)`) and CNL ("last quarter is request archive emails"). That awkward unary rendering is not evidence that the argument disappeared. The CC prohibition and frustration really are absent.

- The reminder timestamps are concretized to `2026_10_06t09_00` and `...10_00`. They happen to match tomorrow relative to the session date, but the source supplies no durable date/timezone anchor. Without recorded contextual authority this is an unjustified resolution, not source-grounded equivalence. "Next Tuesday" also becomes merely `tuesday`.
- Unlike Explicit Scope, the repeated-reminder rule has the correct conditional direction. Request-prefixed predicates preserve some surface force, but cancellation rules still derive actual action predicates.
- The memory-leak cause is asserted globally, outside Tom's belief. Likewise a global cancellation rule leaks the manager's reported conditional into unqualified truth. These are attribution-scope generation errors.
- The IR queries use `pred/args` atoms rather than the renderer's `vars/where` schema. The renderer emits three identical "QUESTION: find truth value." lines. This is a generator/renderer contract failure: details present in the query objects are omitted by native CNL, although some are redundantly present as opaque meta-query facts.
- Pizza quantity deserves qualified treatment: two order atoms encode two varieties, but do not explicitly encode two distinct pizza instances and exact total quantity. This is a structural counting concern, not proof that neither variety/order was represented.
- The source-text ambiguity strings are not substitute formalizations. Correct eligibility rejection for unsupported ambiguity semantics prevents them being mistaken for an executable, complete representation.

### evidence-guided-logic / base/04-mixed-discussion

The worker correctly flags the invented hotel price `120` and the change from "we" to "I" in progress. Both are visible in the generated IR. The Monday prohibition is absent. Hotel requirements become assertions about a hotel, minimum memory becomes asserted memory of 16, and temporal/quantity units remain incomplete. The emotion's object is split into independent relief and progress facts rather than their relation. Correction texts survive in ambiguity descriptions, so saying their wording entirely vanished is too strong; their revision force and targets are not operationally encoded. Reference uncertainty is reasonable, but prose in an ambiguity field does not implement the requested correction.

### evidence-guided-logic / base/10-mixed-discussion

The worker identifies a definite generation error: `explicit_consent(customer) -> transfer_allowed(personal_data,outside_eu)` makes consent sufficient for permission. The source states it as a necessary condition and prohibits transfer without it; other restrictions could still prohibit a consented transfer. This supports rejection in both directions. The prohibition is not merely a missing renderer gloss.

Further concerns are hidden in lexical names: `not_all_confirmed(guests)` and `none_cancelled(guests)` do not implement quantified guests; `not_cover`, `not_annoyed`, and `not_cause` are positive predicates rather than the IR's explicit negation field. Open predicates named `neq`, `greater_than`, or `age_less_than` require an interpreter before exclusion or arithmetic behavior can be claimed. The source's "at all times" and final requests are missing. The emotional target contrast is readable, but not grounded in shared explicit-negation semantics.

An ambiguity note presents "some guests have not confirmed" and "not all guests confirmed" as alternative scopes. Under classical quantification with the same domain they are equivalent; retaining such a note does not establish genuine source ambiguity. The final rejection remains correct despite these misleading ambiguity annotations.

### evidence-guided-logic / base/07 and base/14

Both rows have no stored formalization/CNL and are not judged. Treat them as generation/execution failures separately from the semantic failures above.

### Cross-strategy interpretation at this snapshot

The strongest demonstrated failures concern obligation-versus-completion, attribution escaping its scope, negated restricted quantifiers, permission direction, and query-schema loss. These cannot be dismissed as lexical disagreement with a reference ontology. Conversely, the Evidence Guided archive argument is genuinely present: that rejection reason is a judge error, potentially encouraged by awkward CNL, rather than a generator omission. None of these findings establishes a comparative ranking from ten heterogeneous whole-document cases.
