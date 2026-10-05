# Current CNL

The CNL is a canonical readable rendering of a restricted semantic AST. It is not intended to be elegant prose.

Typical forms include:

```text
TURN t1:
  ACT ASSERT
  CONTENT:
    FOR_EVERY reviewer x1:
      OBLIGATORY:
        EVENT e1 accept:
          AGENT x1:reviewer
          THEME e2:"paper"
```

and:

```text
IF:
  EVENT ... fail:
    AGENT ...
THEN:
  FORBIDDEN:
    EVENT ... delete:
      AGENT ...
      THEME ...
```

Core node families currently include:

- `event`
- `quantifier`
- `modal`
- `not`
- `only`
- `if`, `if_else`, `even_if`
- `and`, `or`
- `temporal`
- `causal`
- `attitude`
- `comparison`
- `query`
- `directive`
- `selector`, `search`
- `goal`, `preference`
- `correction`, `confirm`, `resolution_hint`
- `raw` / unresolved

The format intentionally exposes unresolved material instead of hiding it in fluent text.

## Important design rule

The CNL must preserve source meaning, not complete the source. If a deadline, method, recipient, cause, or condition is absent from the source, the formalizer must not invent one.

## Current limitation

The CNL vocabulary is broad enough for many conversational examples, but the project does not claim semantic completeness for arbitrary natural language. This package evaluates the **formalization strategy**, not a final universal representation language.
