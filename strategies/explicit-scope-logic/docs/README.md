# Explicit Scope Logic

A controlled prompt variant of [Compact Scope Logic](../../compact-scope-logic/docs/README.md), not an independent vote or a new formal language. The recovered design documentation remains in that parent's `docs/original/`; the parser, full IR, CNL renderer and reasoning export are shared unchanged.

## Hypothesis and observed failure

Experiment 017 used the original source prompt with medium-tier Ploinky Workers tasks, batch size two. All eight scoped outputs failed parsing. Stored responses show bare predicate calls, infix conjunctions and `$.p(predicate(...))` wrappers. The original terse `$.p(a,...)` notation did not communicate the concrete grammar reliably to that model in this setting.

This variant adds the actual wire grammar, generic valid structural examples, explicit predicate-prefix and binder rules, and a syntax checklist. No source corpus answers or judge feedback are supplied. It does not shrink the language, add sentence-specific extraction rules, silently repair responses or change the parser to accept ambiguous pseudo-code. The original strategy is retained as the baseline.

## Experiment contract

One predefined formalizer task per case; zero repair attempts. Compare against the parent on matched development inputs, model tier, output budget, batch size and judge protocol. Measure syntax validity separately from semantic preservation and request/token cost. Improvements on these development cases require confirmation on untouched examples. Both variants belong to the same correlated strategy family.
