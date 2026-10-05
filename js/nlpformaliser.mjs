// nlpformaliser.mjs — use the formaliser from JavaScript (Node >= 18), no npm dependencies.
//
// Spawns `nlpf serve` once and talks JSON lines over stdin/stdout, so every call is cheap
// (no Python start-up per call) and calls can run concurrently.
//
//   import { Formaliser } from "./js/nlpformaliser.mjs";
//   const f = await Formaliser.start();
//   const code = await f.formalize("Mary bought a red car yesterday.");   // LLM
//   const chk  = await f.check(code);                                    // Prolog checker
//   const back = await f.verbalize(code);                                // deterministic English
//   const v    = await f.judge("Mary bought a red car yesterday.", back); // LLM judge
//   await f.close();

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export class Formaliser {
  /**
   * @param {object} [opts]
   * @param {string} [opts.python="python3"]  Python interpreter
   * @param {string} [opts.root]              repository root (defaults to the parent of this file)
   * @param {string} [opts.model]             default LLM model for LLM steps (e.g. "claude-haiku-4-5")
   * @param {object} [opts.env]               extra environment variables (e.g. ANTHROPIC_API_KEY)
   */
  static async start(opts = {}) {
    const f = new Formaliser(opts);
    await f.#ready;
    return f;
  }

  #proc; #rl; #next = 1; #pending = new Map(); #ready; #model;

  constructor({ python = "python3", root = ROOT, model, env = {} } = {}) {
    this.#model = model;
    this.#proc = spawn(python, ["-m", "nlpformaliser", "serve"], {
      cwd: root,
      env: { ...process.env, PYTHONPATH: root + (process.env.PYTHONPATH ? ":" + process.env.PYTHONPATH : ""), ...env },
      stdio: ["pipe", "pipe", "inherit"],
    });
    this.#rl = createInterface({ input: this.#proc.stdout });
    this.#ready = new Promise((ok, fail) => {
      this.#proc.once("error", fail);
      this.#proc.once("exit", (c) => fail(new Error(`nlpf serve exited with code ${c}`)));
      this.#rl.on("line", (line) => {
        let msg;
        try { msg = JSON.parse(line); } catch { return; }
        if (msg.id === null && msg.result === "ready") return ok();
        const p = this.#pending.get(msg.id);
        if (!p) return;
        this.#pending.delete(msg.id);
        msg.error ? p.reject(Object.assign(new Error(msg.error), { trace: msg.trace })) : p.resolve(msg.result);
      });
    });
    this.#proc.on("exit", () => {
      for (const p of this.#pending.values()) p.reject(new Error("nlpf serve exited"));
      this.#pending.clear();
    });
  }

  /** Low-level RPC call. */
  call(method, params = {}) {
    const id = this.#next++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#proc.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  }

  #m(p) { return this.#model && p.model === undefined ? { ...p, model: this.#model } : p; }

  // ---- deterministic steps (no LLM) ----
  /** Validate EVL code with the SWI-Prolog checker → {ok, errors, warnings} */
  check(code) { return this.call("check", { code }); }
  /** Execute EVL code back into English (rule-based, deterministic) → string */
  verbalize(code) { return this.call("verbalize", { code }); }
  /** First-order-logic reading of EVL code → string */
  fol(code) { return this.call("fol", { code }); }
  /** Execute an EVL question against EVL context facts → {answer, support, mode, ...} */
  ask(contextCode, questionCode) { return this.call("ask", { context_code: contextCode, question_code: questionCode }); }
  /** System prompts, refine template and DSL spec — to drive the loop with your own LLM */
  prompts(ctxCode) { return this.call("prompts", ctxCode ? { ctx_code: ctxCode } : {}); }

  // ---- LLM steps ----
  /** One-shot formalisation (pass ctxCode when formalising a question about a context) → EVL code */
  formalize(text, { ctxCode, model } = {}) { return this.call("formalize", this.#m({ text, ctx_code: ctxCode, model })); }
  /** Repair code given feedback → EVL code */
  refine(text, code, { realization, differences, errors, ctxCode, model } = {}) {
    return this.call("refine", this.#m({ text, code, realization, differences, errors, ctx_code: ctxCode, model }));
  }
  /** Meaning-equivalence verdict → {equivalent, differences} */
  judge(original, candidate, { model } = {}) { return this.call("judge", this.#m({ original, candidate, model })); }

  // ---- whole loop ----
  /** formalise → check → verbalise → judge → refine, until equivalent → {converged, final_code, ...} */
  roundtrip(text, { rounds = 4, ctxCode, trace = false, model } = {}) {
    return this.call("roundtrip", this.#m({ text, rounds, ctx_code: ctxCode, trace, model }));
  }
  /** Formalise context and question, then execute the question → {answer, support, ...} */
  answer(context, question, { rounds = 4, model } = {}) { return this.call("answer", this.#m({ context, question, rounds, model })); }

  /** LLM usage counters of the server process */
  stats() { return this.call("stats"); }

  async close() {
    this.#proc.stdin.end();
    await new Promise((r) => (this.#proc.exitCode !== null ? r() : this.#proc.once("exit", r)));
  }
}

/**
 * A custom loop built from the separate steps — the same algorithm as `roundtrip`, written in JS so you can
 * change any step (another judge, another stopping rule, logging, human-in-the-loop...).
 */
export async function customLoop(f, text, { rounds = 4, onStep = () => {} } = {}) {
  let code = await f.formalize(text);
  for (let round = 0; round <= rounds; round++) {
    const chk = await f.check(code);
    let realization = null, verdict = null;
    if (chk.ok) {
      realization = await f.verbalize(code);
      verdict = await f.judge(text, realization);
    }
    onStep({ round, code, errors: chk.errors, realization, verdict });
    if (verdict?.equivalent) return { converged: true, code, realization, rounds: round };
    if (round === rounds) break;
    code = await f.refine(text, code, { realization, differences: verdict?.differences, errors: chk.errors });
  }
  return { converged: false, code, rounds };
}
