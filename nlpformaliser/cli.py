"""nlpf — command-line / JSON-RPC interface to the formaliser.

Every step of the round-trip loop is a separate command, so you can build your own loop
(in a shell script, in JS via nlpformaliser.mjs, or with your own LLM):

  deterministic (no LLM):
    nlpf check      [FILE|-]                 validate EVL code (SWI-Prolog)          -> JSON
    nlpf verbalize  [FILE|-]                 execute EVL code back into English     -> text
    nlpf fol        [FILE|-]                 first-order-logic reading              -> text
    nlpf ask        --context FILE --question-code FILE   run a question as a Prolog query -> JSON
    nlpf prompts    [--ctx-code FILE]        the system prompts / DSL spec, to use with your own LLM -> JSON

  LLM steps (Haiku by default; --model to change):
    nlpf formalize  "TEXT" [--ctx-code FILE] one-shot formalisation                 -> EVL code
    nlpf judge      "ORIGINAL" "CANDIDATE"   meaning-equivalence verdict            -> JSON
    nlpf refine     "TEXT" --code FILE [--realization R] [--differences D ...] [--errors E ...] -> EVL code

  whole loop:
    nlpf roundtrip  "TEXT" [--rounds 4] [--ctx-code FILE] [--trace]                  -> JSON
    nlpf answer     --context "TEXT" --question "TEXT" [--rounds 4]                  -> JSON (formalise both, execute)

  server:
    nlpf serve      JSON lines on stdin: {"id":1,"method":"verbalize","params":{"code":"..."}}
                    replies on stdout:   {"id":1,"result":...} or {"id":1,"error":"..."}

Text arguments may be given as "-" to read stdin.
"""
from __future__ import annotations

import argparse
import json
import sys
import traceback

from . import evl, llm, qa
from .backends import EVLBackend, EVLQuestionBackend
from .judge import loop_judge
from .loop import run_item


def _read(arg: str | None) -> str:
    if arg in (None, "-"):
        return sys.stdin.read()
    try:
        with open(arg) as f:
            return f.read()
    except OSError:
        return arg  # literal code / text


# ------------------------------------------------------------------ API (shared by CLI and server)
def _backend(model=None, ctx_code=None):
    b = EVLQuestionBackend(ctx_code) if ctx_code else EVLBackend()
    if model:
        b.model = model
    return b


def api_check(code: str) -> dict:
    r = evl.load(code)
    return {"ok": not r.errors, "errors": r.errors, "warnings": r.warnings}


def api_verbalize(code: str) -> str:
    return evl.english(code)


def api_fol(code: str) -> str:
    return evl.fol(code)


def api_formalize(text: str, model=None, ctx_code=None) -> str:
    return _backend(model, ctx_code).formalize(text)


def api_refine(text: str, code: str, realization=None, differences=None, errors=None, model=None, ctx_code=None) -> str:
    return _backend(model, ctx_code).refine(text, code, errors or [], realization, differences or [])


def api_judge(original: str, candidate: str, model=None) -> dict:
    return loop_judge(original, candidate, **({"model": model} if model else {}))


def api_roundtrip(text: str, rounds: int = 4, model=None, ctx_code=None, trace=False) -> dict:
    r = run_item(_backend(model, ctx_code), text, max_rounds=rounds)
    keys = ["text", "converged", "rounds", "final_code", "final_realization", "first_realization", "seconds"]
    out = {k: r[k] for k in keys}
    if trace:
        out["trace"] = r["trace"]
    return out


def api_ask(context_code: str, question_code: str) -> dict:
    return qa.answer(context_code, question_code)


def api_answer(context: str, question: str, rounds: int = 4, model=None) -> dict:
    c = api_roundtrip(context, rounds, model)
    q = api_roundtrip(question, rounds, model, ctx_code=c["final_code"])
    a = api_ask(c["final_code"], q["final_code"])
    return {"answer": a.get("answer"), "support": a.get("support"), "mode": a.get("mode"),
            "context": c, "question": q, "detail": a}


def api_prompts(ctx_code=None) -> dict:
    from .judge import EVAL_SYSTEM, LOOP_SYSTEM
    from .backends import REFINE_TMPL
    b = _backend(None, ctx_code)
    return {"formalize_system": b.system, "refine_template": REFINE_TMPL, "judge_system": LOOP_SYSTEM,
            "eval_judge_system": EVAL_SYSTEM, "spec": evl.SPEC,
            **({"question_context_note": b.ctx_note} if ctx_code else {})}


METHODS = {
    "check": lambda p: api_check(p["code"]),
    "verbalize": lambda p: api_verbalize(p["code"]),
    "fol": lambda p: api_fol(p["code"]),
    "formalize": lambda p: api_formalize(p["text"], p.get("model"), p.get("ctx_code")),
    "refine": lambda p: api_refine(p["text"], p["code"], p.get("realization"), p.get("differences"),
                                   p.get("errors"), p.get("model"), p.get("ctx_code")),
    "judge": lambda p: api_judge(p["original"], p["candidate"], p.get("model")),
    "roundtrip": lambda p: api_roundtrip(p["text"], p.get("rounds", 4), p.get("model"), p.get("ctx_code"), p.get("trace", False)),
    "ask": lambda p: api_ask(p["context_code"], p["question_code"]),
    "answer": lambda p: api_answer(p["context"], p["question"], p.get("rounds", 4), p.get("model")),
    "prompts": lambda p: api_prompts(p.get("ctx_code")),
    "stats": lambda p: dict(llm.STATS),
}


def serve():
    """JSON-lines RPC. Requests are handled concurrently; replies carry the request id."""
    import threading
    from concurrent.futures import ThreadPoolExecutor

    lock = threading.Lock()
    pool = ThreadPoolExecutor(8)

    def reply(obj):
        with lock:
            sys.stdout.write(json.dumps(obj) + "\n")
            sys.stdout.flush()

    def handle(req):
        rid = req.get("id")
        try:
            fn = METHODS[req["method"]]
            reply({"id": rid, "result": fn(req.get("params", {}))})
        except Exception as e:  # noqa: BLE001
            reply({"id": rid, "error": f"{type(e).__name__}: {e}", "trace": traceback.format_exc()[-800:]})

    reply({"id": None, "result": "ready", "methods": sorted(METHODS)})
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as e:
            reply({"id": None, "error": f"bad JSON: {e}"})
            continue
        pool.submit(handle, req)
    pool.shutdown(wait=True)


# ------------------------------------------------------------------ CLI
def main(argv=None):
    ap = argparse.ArgumentParser(prog="nlpf", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", help="LLM model id (default claude-haiku-4-5)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for c in ("check", "verbalize", "fol"):
        s = sub.add_parser(c)
        s.add_argument("code", nargs="?", default="-", help="EVL file, literal code, or - for stdin")
    s = sub.add_parser("formalize")
    s.add_argument("text")
    s.add_argument("--ctx-code")
    s = sub.add_parser("judge")
    s.add_argument("original")
    s.add_argument("candidate")
    s = sub.add_parser("refine")
    s.add_argument("text")
    s.add_argument("--code", required=True)
    s.add_argument("--realization")
    s.add_argument("--differences", nargs="*")
    s.add_argument("--errors", nargs="*")
    s.add_argument("--ctx-code")
    s = sub.add_parser("roundtrip")
    s.add_argument("text")
    s.add_argument("--rounds", type=int, default=4)
    s.add_argument("--ctx-code")
    s.add_argument("--trace", action="store_true")
    s = sub.add_parser("ask")
    s.add_argument("--context", required=True, help="EVL code of the context (file or literal)")
    s.add_argument("--question-code", required=True)
    s = sub.add_parser("answer")
    s.add_argument("--context", required=True, help="context text")
    s.add_argument("--question", required=True)
    s.add_argument("--rounds", type=int, default=4)
    s = sub.add_parser("prompts")
    s.add_argument("--ctx-code")
    sub.add_parser("serve")
    a = ap.parse_args(argv)

    def show(x):
        print(x if isinstance(x, str) else json.dumps(x, indent=2, ensure_ascii=False))

    ctx = _read(a.ctx_code) if getattr(a, "ctx_code", None) else None
    if a.cmd == "check":
        r = api_check(_read(a.code))
        show(r)
        sys.exit(0 if r["ok"] else 1)
    elif a.cmd == "verbalize":
        show(api_verbalize(_read(a.code)))
    elif a.cmd == "fol":
        show(api_fol(_read(a.code)))
    elif a.cmd == "formalize":
        show(api_formalize(_read(a.text), a.model, ctx))
    elif a.cmd == "judge":
        show(api_judge(_read(a.original), a.candidate, a.model))
    elif a.cmd == "refine":
        show(api_refine(_read(a.text), _read(a.code), a.realization, a.differences, a.errors, a.model, ctx))
    elif a.cmd == "roundtrip":
        show(api_roundtrip(_read(a.text), a.rounds, a.model, ctx, a.trace))
    elif a.cmd == "ask":
        show(api_ask(_read(a.context), _read(a.question_code)))
    elif a.cmd == "answer":
        show(api_answer(a.context, a.question, a.rounds, a.model))
    elif a.cmd == "prompts":
        show(api_prompts(ctx))
    elif a.cmd == "serve":
        serve()


if __name__ == "__main__":
    main()
