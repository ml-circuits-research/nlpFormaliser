"""The round-trip refinement loop:

    text --LLM--> formal code --check--> (errors? -> LLM repair)
                      |
                   execute (deterministic interpreter / generator)
                      v
                 back-translated English --judge(text, back)--> equivalent? stop : LLM repair
"""
from __future__ import annotations

import time

from .judge import loop_judge


def run_item(backend, text: str, max_rounds: int = 4) -> dict:
    t0 = time.time()
    trace = []
    code = backend.formalize(text)
    for rnd in range(max_rounds + 1):
        step = {"round": rnd, "code": code}
        try:
            errors = backend.check(code)
        except Exception as e:  # noqa: BLE001
            errors = [f"checker crashed: {e}"]
        step["errors"] = errors
        realization, verdict = None, None
        if not errors:
            try:
                realization = backend.realize(code)
            except Exception as e:  # noqa: BLE001
                errors = [f"interpreter crashed: {type(e).__name__}: {e}"]
                step["errors"] = errors
        if realization is not None:
            verdict = loop_judge(text, realization)
        step["realization"] = realization
        step["verdict"] = verdict
        trace.append(step)
        if verdict and verdict["equivalent"]:
            break
        if rnd == max_rounds:
            break
        code = backend.refine(text, code, errors, realization, (verdict or {}).get("differences"))
    first_ok = next((s for s in trace if s["realization"] is not None), None)
    last_ok = next((s for s in reversed(trace) if s["realization"] is not None), None)
    return {
        "backend": backend.name,
        "text": text,
        "rounds": len(trace) - 1,
        "converged": bool(trace[-1]["verdict"] and trace[-1]["verdict"]["equivalent"]),
        "first_realization": trace[0]["realization"],
        "final_realization": last_ok["realization"] if last_ok else None,
        "first_valid_realization": first_ok["realization"] if first_ok else None,
        "final_code": last_ok["code"] if last_ok else trace[-1]["code"],
        "trace": trace,
        "seconds": round(time.time() - t0, 1),
    }
