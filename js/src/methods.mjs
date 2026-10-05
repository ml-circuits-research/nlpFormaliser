// Formalisation METHODS that the benchmark can compare.
//
// A method is a plain object:
//   {
//     name: string,
//     formalize(text): Promise<string>                       NL → formalisation (any string format)
//     realize(formalization): Promise<string> | string        EXECUTION of the formalisation → CNL text
//     check?(formalization): {ok:boolean, errors:string[]}   optional validator (syntax/well-formedness)
//     refine?(text, formalization, feedback): Promise<string> optional repair step for the round-trip loop
//                       feedback = {errors, realization, differences}
//     deterministicRealizer?: boolean                         true if realize() involves no LLM (recommended)
//   }
//
// The benchmark judges ONLY whether the CNL emitted by realize() means the same as the original text.
// It does not judge how the formalisation could be turned into program code — that is a separate question.
import { spawn } from "node:child_process";
import { check } from "./check.mjs";
import { englishFromFacts } from "./english.mjs";
import { Formaliser } from "./formaliser.mjs";

/** The EVL method of this library: LLM formalises into Prolog-style facts, deterministic interpreter emits CNL. */
export function evlMethod({ llm, name = "evl" } = {}) {
  const f = new Formaliser({ llm });
  return {
    name,
    deterministicRealizer: true,
    formalize: (text) => f.formalize(text),
    check: (code) => {
      const r = check(code);
      const errors = [...r.errors, ...r.warnings.filter((w) => w.includes("unknown predicate"))];
      return { ok: errors.length === 0, errors };
    },
    realize: (code) => englishFromFacts(check(code).facts),
    refine: (text, code, fb) => f.refine(text, code, fb),
  };
}

/**
 * Control condition: same formalisation as `base`, but an LLM turns it into English instead of a deterministic
 * interpreter. Useful to measure how much an LLM verbaliser silently "repairs" incomplete formalisations.
 */
export function llmRealizerMethod(base, { llm, name = `${base.name}+llm-realizer`, describe = "" } = {}) {
  const system = "You translate a formal representation into English. Express exactly what it states — do not add " +
    "anything that is not encoded. Output only the English text." + (describe ? `\n\n${describe}` : "");
  return { ...base, name, deterministicRealizer: false, realize: async (code) => (await llm(system, code)).trim() };
}

function run(cmd, input, { timeoutMs = 600_000, env } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, { shell: true, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, ...env } });
    let out = "", err = "";
    const t = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => {
      clearTimeout(t);
      code === 0 ? resolve(out.trim()) : reject(new Error(`\`${cmd}\` exited ${code}: ${err.slice(-500)}`));
    });
    p.stdin.end(input);
  });
}

/**
 * Wrap ANY external formaliser (any language) as a method. Each command reads stdin and writes stdout:
 *   formalize: stdin = text                                   → stdout = formalisation
 *   realize:   stdin = formalisation                          → stdout = CNL
 *   check:     stdin = formalisation                          → stdout = JSON {ok, errors}     (optional)
 *   refine:    stdin = JSON {text, formalization, feedback}   → stdout = formalisation          (optional)
 */
export function commandMethod({ name, formalize, realize, check: checkCmd, refine, deterministicRealizer = true, env, timeoutMs }) {
  const o = { env, timeoutMs };
  const m = {
    name, deterministicRealizer,
    formalize: (text) => run(formalize, text, o),
    realize: (f) => run(realize, f, o),
  };
  if (checkCmd) m.check = async (f) => { try { return JSON.parse(await run(checkCmd, f, o)); } catch (e) { return { ok: false, errors: [e.message] }; } };
  if (refine) m.refine = (text, formalization, feedback) => run(refine, JSON.stringify({ text, formalization, feedback }), o);
  return m;
}
