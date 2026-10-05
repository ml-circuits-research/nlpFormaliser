// Methods config for `nlpf bench --config js/examples/compare-evl-amr.mjs`:
// EVL (this library) vs AMR (external Python tool wrapped with commandMethod) vs the EVL+LLM-verbaliser control.
import { commandMethod, evlMethod, llmRealizerMethod, SPEC } from "../index.mjs";

const amr = (cmd) => `python3 adapters/amr_adapter.py ${cmd}`;

export default ({ llm }) => [
  evlMethod({ llm }),
  commandMethod({
    name: "amr",
    formalize: amr("formalize"), check: amr("check"), realize: amr("realize"), refine: amr("refine"),
    deterministicRealizer: false,   // amrlib's generator is a neural network
  }),
  llmRealizerMethod(evlMethod({ llm }), { llm, describe: SPEC, name: "evl+llm-realizer" }),
];
