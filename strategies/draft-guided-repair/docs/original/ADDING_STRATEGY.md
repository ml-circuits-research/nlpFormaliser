# Adding a formalization strategy

A strategy only needs a name and an asynchronous `formalize` method.

```js
export class MyStrategy {
  name = "my-strategy";

  async formalize(text, {proto}) {
    const ir = /* produce Formal IR */;
    return {
      ir,
      proto,
      artifacts: {
        // optional: draft, raw model output, traces, timings...
      }
    };
  }
}
```

Then pass the instance directly to `evaluateDataset`:

```js
import fs from "node:fs/promises";
import {evaluateDataset} from "./src/evaluator.mjs";

const dataset = JSON.parse(await fs.readFile("benchmarks/pilot-heldout.json", "utf8"));
const result = await evaluateDataset({strategy: new MyStrategy(), dataset});
console.log(result.summary);
```

For CLI use, add the strategy to `bin/common.mjs`.

## Suggested future strategies

- dependency parser -> ProtoIR -> deterministic compiler;
- AMR/UMR/DRS/MRS adapter -> Formal IR;
- small fine-tuned NL -> Formal IR model;
- small model performing only ProtoIR -> Formal IR normalization;
- deterministic draft + local small-model repair;
- multi-parser vote/merge;
- large model direct baseline;
- SOP Lang backend compiler.

Keep the evaluator unchanged. That is the main experimental control.
