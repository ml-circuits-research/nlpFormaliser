#!/usr/bin/env node
// NL → formalisation → CNL with a strategy from strategies/.
//
//   node tools/formalize.mjs --strategy evl "Cancel all my meetings on Friday except the one with the investors."
//   node tools/formalize.mjs --strategy evl --opt rounds=0 eval/base/negation-scope/01-not-every-email-you-flagged.txt
//   node tools/formalize.mjs --list
import { parseArgs } from "node:util";
import { DEFAULT_MODEL, makeLLM, parseOpts, readArg } from "./lib/cli.mjs";
import { formalizeToCNL, listStrategies, loadStrategy } from "./lib/strategies.mjs";

const { values: o, positionals } = parseArgs({ allowPositionals: true, options: {
  strategy: { type: "string", short: "s" }, opt: { type: "string", multiple: true }, model: { type: "string" },
  provider: { type: "string" }, cache: { type: "string" }, list: { type: "boolean" }, "cnl-only": { type: "boolean" },
  trace: { type: "boolean" }, help: { type: "boolean", short: "h" } } });

if (o.list) { console.log(listStrategies().join("\n")); process.exit(0); }
if (o.help || !o.strategy) {
  console.log(`usage: formalize.mjs --strategy NAME [--opt key=value]... [--model M] [--cnl-only] [--trace] TEXT|FILE|-
strategies: ${listStrategies().join(", ")}`);
  process.exit(o.help ? 0 : 1);
}
const strategy = await loadStrategy(o.strategy);
const llm = makeLLM(o.model ?? DEFAULT_MODEL, { provider: o.provider, cache: o.cache });
const options = { ...(strategy.defaultOptions ?? {}), ...parseOpts(o.opt) };
const log = o.trace ? (step) => console.error(JSON.stringify(step)) : undefined;
const r = await formalizeToCNL(strategy, readArg(positionals[0]), { llm, options, log });
if (o["cnl-only"]) { if (!r.ok) { console.error(r.errors.join("\n")); process.exit(1); } console.log(r.cnl); }
else console.log(JSON.stringify(r, null, 2));
process.exit(r.ok ? 0 : 1);
