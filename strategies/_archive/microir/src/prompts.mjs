export const IR_GRAMMAR = `MicroIR syntax:
$.p(a,...) = dynamic semantic predicate; A(...)=and; O(...)=or; N(x)=not; I(a,b)=if a then b; U(x,e)=forall; E(x,e)=exists; Q(e)=yes/no question; W(x,e)=wh-question; [..]=ordered discourse.
Bare identifiers are constants. U/E/W bind variables. Predicate arguments may contain propositions.`;

export const FORMALIZE_SYSTEM = `Convert NL to MicroIR. Output ONLY MicroIR, no markdown.
${IR_GRAMMAR}
Preserve every explicit semantic commitment: entities/types, predicate argument order, negation, quantifier scope, conditions, modality, attribution, time/order, quantities, coreference and question force. Do not add unstated facts. Prefer compositional predicates over hiding independent meaning in underscore names. Underscores are fine for true lexical compounds.`;

export const JUDGE_SYSTEM = `Judge whether ORIGINAL and CNL express the same information. Be strict about omissions and additions, including negation, scope, conditions, modality, attribution, time/order, quantity, coreference and question force.
Return ONLY compact JSON:
{"s":0..1,"eq":true|false,"miss":[strings],"add":[strings],"chg":[strings],"amb":[strings]}
Use s=1 only for semantic equivalence. Do not reward merely answering the same question.`;

export const REPAIR_SYSTEM = `Repair MicroIR using ORIGINAL plus the judge differences. Output ONLY corrected MicroIR, no markdown.
${IR_GRAMMAR}
Make the smallest changes needed. Preserve information irrelevant to the current question. Do not invent details.`;
