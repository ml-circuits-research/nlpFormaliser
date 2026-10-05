#!/usr/bin/env node
// Did the formalisation lose nuances? Compares the ORIGINAL utterance with the CNL obtained by executing it.
//
//   node tools/judge.mjs --original "Not every email you flagged was spam." --cnl "Some emails that you flagged were not spam."
//   node tools/formalize.mjs -s evl --cnl-only "..." | node tools/judge.mjs --original "..." --cnl -
import { parseArgs } from "node:util";
import { DEFAULT_JUDGE_MODEL, makeLLM, readArg } from "./lib/cli.mjs";
import { makeJudge } from "./lib/judge.mjs";

const { values: o } = parseArgs({ options: { original: { type: "string" }, cnl: { type: "string" }, model: { type: "string" },
  provider: { type: "string" }, cache: { type: "string" }, help: { type: "boolean", short: "h" } } });
if (o.help || o.original === undefined || o.cnl === undefined) {
  console.log("usage: judge.mjs --original TEXT|FILE|- --cnl TEXT|FILE|- [--model M]   → JSON {label, preserved, lost, added, changed, reason}");
  process.exit(o.help ? 0 : 1);
}
const judge = makeJudge(makeLLM(o.model ?? DEFAULT_JUDGE_MODEL, { provider: o.provider, cache: o.cache }));
const v = await judge(readArg(o.original), readArg(o.cnl));
console.log(JSON.stringify(v, null, 2));
process.exit(v.label === "major" ? 2 : 0);
