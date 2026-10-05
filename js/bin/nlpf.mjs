#!/usr/bin/env node
// nlpf — command-line front-end of the nlpformaliser library. Every step of the loop is a command.
import { readFileSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { Formaliser, anthropicLLM, ask, check, claudeCliLLM, fol, verbalize } from "../index.mjs";

const HELP = `nlpf <command> [args]

deterministic (no LLM):
  check     [FILE|CODE|-]                         validate EVL code → JSON (exit 1 if invalid)
  verbalize [FILE|CODE|-]                         execute EVL code back into English
  fol       [FILE|CODE|-]                         first-order-logic reading
  ask       --context FILE --question-code FILE   execute a question against context facts → JSON
  prompts   [--context FILE]                      system prompts + DSL spec (to use your own LLM) → JSON

LLM steps (default Haiku via ANTHROPIC_API_KEY, else the claude CLI; --model, --provider sdk|cli):
  formalize "TEXT" [--context FILE]               → EVL code
  judge "ORIGINAL" "CANDIDATE"                    → JSON {equivalent, differences}
  refine "TEXT" --code FILE [--realization R] [--difference D]... [--error E]...  → EVL code
  roundtrip "TEXT" [--rounds 4] [--context FILE] [--trace]   whole loop → JSON
  answer --context-text "TEXT" --question "TEXT" [--rounds 4] formalise both + execute → JSON

Arguments that name an existing file are read from it; "-" reads stdin.`;

const read = (x) => (x === undefined || x === "-" ? readFileSync(0, "utf8") : existsSync(x) ? readFileSync(x, "utf8") : x);
const show = (x) => console.log(typeof x === "string" ? x : JSON.stringify(x, null, 2));

const { values: o, positionals: pos } = parseArgs({
  allowPositionals: true,
  options: {
    context: { type: "string" }, "context-text": { type: "string" }, "question-code": { type: "string" }, question: { type: "string" },
    code: { type: "string" }, realization: { type: "string" }, difference: { type: "string", multiple: true },
    error: { type: "string", multiple: true }, rounds: { type: "string" }, trace: { type: "boolean" },
    model: { type: "string" }, provider: { type: "string" }, help: { type: "boolean", short: "h" },
  },
});
const [cmd, ...args] = pos;
if (!cmd || o.help) { console.log(HELP); process.exit(cmd ? 0 : 1); }

const mkF = () => {
  const model = o.model;
  const llm = o.provider === "sdk" ? anthropicLLM({ model }) : o.provider === "cli" ? claudeCliLLM({ model })
    : (process.env.ANTHROPIC_API_KEY ? anthropicLLM({ model }) : claudeCliLLM({ model }));
  return new Formaliser({ llm });
};
const ctx = o.context ? read(o.context) : undefined;

switch (cmd) {
  case "check": { const r = check(read(args[0])); show({ ok: r.ok, errors: r.errors, warnings: r.warnings }); process.exit(r.ok ? 0 : 1); }
  case "verbalize": show(verbalize(read(args[0]))); break;
  case "fol": show(fol(read(args[0]))); break;
  case "ask": show(ask(read(o.context), read(o["question-code"]))); break;
  case "prompts": show(new Formaliser({ llm: async () => "" }).prompts({ context: ctx })); break;
  case "formalize": show(await mkF().formalize(read(args[0]), { context: ctx })); break;
  case "judge": show(await mkF().judge(read(args[0]), args[1])); break;
  case "refine": show(await mkF().refine(read(args[0]), read(o.code), { realization: o.realization, differences: o.difference, errors: o.error, context: ctx })); break;
  case "roundtrip": {
    const r = await mkF().roundtrip(read(args[0]), { rounds: Number(o.rounds ?? 4), context: ctx });
    if (!o.trace) delete r.trace;
    show(r); break;
  }
  case "answer": {
    const r = await mkF().answer(o["context-text"], o.question, { rounds: Number(o.rounds ?? 4) });
    show({ answer: r.answer, support: r.support, mode: r.mode, contextCode: r.context.code, questionCode: r.question.code }); break;
  }
  default: console.error(`unknown command: ${cmd}\n\n${HELP}`); process.exit(1);
}
