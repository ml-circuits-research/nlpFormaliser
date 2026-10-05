# Benchmark format

A dataset is a JSON array:

```json
[
  {
    "id":"E01",
    "category":"facts/simple",
    "text":"Mira is a physicist.",
    "gold_ir":{
      "facts":[{"pred":"physicist","args":["mira"],"neg":false}],
      "rules":[]
    },
    "tests":[
      {
        "query":{"pred":"physicist","args":["mira"],"neg":false},
        "expected":"TRUE",
        "kind":"semantic"
      }
    ]
  }
]
```

`gold_ir` is optional. Behavioral tests are strongly recommended.

For a serious benchmark, author tests before observing the candidate strategy output. Add control tests for unsupported claims and separate development from held-out data.
