import base from '../compact-scope-logic/index.mjs';
import {FORMALIZE_SYSTEM} from '../compact-scope-logic/src/prompts.mjs';
import {fromWire, toWire} from '../compact-scope-logic/src/wire.mjs';
import {toCNL} from '../compact-scope-logic/src/cnl.mjs';

export const SYSTEM = `${FORMALIZE_SYSTEM}

Concrete wire grammar (not JavaScript and not mathematical infix notation):
document := formula | '[' formula (',' formula)* ']'
formula := predicate | 'A(' formula ',' formula (',' formula)* ')'
  | 'O(' formula ',' formula (',' formula)* ')' | 'N(' formula ')'
  | 'I(' formula ',' formula ')' | 'U(' variable ',' formula ')'
  | 'E(' variable ',' formula ')' | 'Q(' formula ')'
  | 'W(' variable ',' formula ')'
predicate := '$.' predicate_name '(' [term (',' term)*] ')'
term := quoted_constant | number | boolean | null | bound_variable | formula
predicate_name := an ASCII identifier such as owns, person, believes, before

The p in $.p is a placeholder for the predicate name, not a wrapper.
Every predicate application MUST have the $. prefix, including nested ones.
Use A and O instead of &, &&, | or infix words. Bind variables with U(x,...),
E(x,...) or W(x,...), never arrows. Quote entity constants with JSON double
quotes to distinguish them from variables. Do not emit declarations or code.

Well-formed structural examples (not facts to add to the input):
$.owns("ada","device")
U(x,I($.person(x),E(y,A($.device(y),$.owns(x,y)))))
N(U(x,I($.person(x),$.ready(x))))
$.believes("ada",N($.open("door")))
[ $.arrives("ada"), Q($.ready("ada")) ]

Before returning, check prefix, delimiter balance, operator arity and variable
binding. Preserve the full meaning; syntax correctness alone is insufficient.`;

export default {
  ...base,
  name: 'explicit-scope-logic',
  async formalize(text, {llm}) {
    const rawWire = await llm(SYSTEM, text);
    const ir = fromWire(rawWire);
    return {formalization: toWire(ir), rawWire, compactCNL: toCNL(ir, {compact: true})};
  },
};
