# MicroIR specification

## Principle

MicroIR intentionally does **not** define predicate types such as `event`, `relation`, `attribute`, etc. There is one dynamic predicate form:

```text
$.predicate(arg1,...,argN)
```

A predicate may take constants, variables, numbers, booleans, null, or nested propositions as arguments.

Examples:

```text
$.researcher(alice)
$.buy(alice,laptop)
$.believe(alice,$.leave(bob))
$.time($.submit(alice,paper),monday)
```

This makes predicate vocabulary dynamic while logical scope remains explicit.

## Fixed operators

| Operator | Meaning |
|---|---|
| `A(a,b,...)` | conjunction |
| `O(a,b,...)` | disjunction |
| `N(x)` | negation |
| `I(a,b)` | implication |
| `U(x,e)` | universal quantification |
| `E(x,e)` | existential quantification |
| `Q(e)` | yes/no question |
| `W(x,e)` | wh-question |
| `[a,b,...]` | ordered discourse |

## Underscore policy

Use `_` for a lexical unit whose internal words should normally behave as one symbol:

```text
$.credit_card(c1)
$.machine_learning(topic1)
```

Do not use it to hide independently queryable structure:

```text
// weaker
$.plan_time(ravi,next_month)

// preferred
$.time($.plan(ravi,$.buy(ravi,laptop)),next_month)
```

The second version lets a reasoner or later transformation operate independently on `plan`, `buy`, and `time`.

## Canonicalization limits

Predicate naming is currently open. Therefore `purchase` and `buy` are different symbols unless an ontology/normalizer later maps them. This is intentional in this prototype; semantic fidelity is evaluated through CNL + judge rather than predicate-string equality alone.
