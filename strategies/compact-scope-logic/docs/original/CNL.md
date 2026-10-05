# Controlled Natural Language renderer

`toCNL(ir)` is deterministic and has no model dependency.

The renderer does not assume that an unknown predicate is a verb or noun. Instead it names the predicate explicitly and preserves argument order.

Example IR:

```text
U(x,I($.student(x),E(y,A($.book(y),$.read(x,y)))))
```

Representative CNL:

```text
for every x, (if (the predicate “student” holds for x), then
(there exists a y such that ((the predicate “book” holds for y) and
(the predicate “read” holds for x, in that order, y))))
```

This is deliberately mechanical. The purpose is not literary quality; it is to expose the semantic content of the formal representation to a judge without another generative step.

`toCNL(ir,{compact:true})` emits a shorter judge-oriented form while preserving logical connectives explicitly.
