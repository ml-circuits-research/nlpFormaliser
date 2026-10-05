import {normalizeIR} from "./ir.mjs";

function cloneIR(ir) { return normalizeIR(ir); }

export function generateCorruptions(input, {max = Infinity} = {}) {
  const ir = normalizeIR(input);
  const out = [];
  const push = (kind, detail, mutate) => {
    if (out.length >= max) return;
    const x = cloneIR(ir);
    mutate(x);
    out.push({kind, detail, ir: x});
  };

  for (let i = 0; i < ir.facts.length && out.length < max; i += 1) {
    push("drop_fact", `drop facts[${i}]`, (x) => x.facts.splice(i, 1));
    if (ir.facts[i].args.length >= 2) push("swap_arguments", `swap first two arguments of facts[${i}]`, (x) => {
      [x.facts[i].args[0], x.facts[i].args[1]] = [x.facts[i].args[1], x.facts[i].args[0]];
    });
    push("flip_negation", `flip polarity of facts[${i}]`, (x) => { x.facts[i].neg = !x.facts[i].neg; });
  }

  for (let i = 0; i < ir.rules.length && out.length < max; i += 1) {
    if (ir.rules[i].body.length) push("drop_condition", `drop first body atom of rules[${i}]`, (x) => x.rules[i].body.splice(0, 1));
    if (ir.rules[i].head.args.length >= 2) push("swap_head_arguments", `swap first two head arguments of rules[${i}]`, (x) => {
      [x.rules[i].head.args[0], x.rules[i].head.args[1]] = [x.rules[i].head.args[1], x.rules[i].head.args[0]];
    });
  }

  if (out.length < max) push("unsupported_fact", "add an unsupported sentinel fact", (x) => {
    x.facts.push({pred:"unsupported_probe", args:["unsupported_probe_entity"], neg:false});
  });

  return out.slice(0, max);
}
