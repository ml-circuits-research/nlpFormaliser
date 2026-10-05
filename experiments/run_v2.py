"""EVL v2 experiment: new primitives (generics, scope, groups, measures, focus, frequency, counterfactuals),
speech acts / questions, and question answering by executing questions as Prolog queries.

    python experiments/run_v2.py            # runs everything, resumable
    python experiments/run_v2.py --report-only
Outputs in results/v2/.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from nlpformaliser import evl, llm  # noqa: E402
from nlpformaliser.backends import EVLBackend, EVLQuestionBackend  # noqa: E402
from nlpformaliser.judge import eval_judge, loop_judge, qa_judge  # noqa: E402
from nlpformaliser.loop import run_item  # noqa: E402
from nlpformaliser.mutate import mutations  # noqa: E402
from nlpformaliser.qa import answer  # noqa: E402

OUT = ROOT / "results" / "v2"
OUT.mkdir(parents=True, exist_ok=True)
SETS = {"old40": "sentences.jsonl", "new_phenomena": "v2_statements.jsonl", "speech_acts": "v2_acts.jsonl"}


def jl(path):
    return [json.loads(l) for l in Path(path).read_text().splitlines() if l.strip()] if Path(path).exists() else []


def append(path, rec):
    with open(path, "a") as f:
        f.write(json.dumps(rec) + "\n")


def pmap(fn, items, workers):
    with ThreadPoolExecutor(workers) as ex:
        return list(ex.map(fn, items))


# ------------------------------------------------------------------ round trip on the three sets
def run_sets(rounds, workers):
    backend = EVLBackend()
    for name, fname in SETS.items():
        out = OUT / f"{name}.jsonl"
        done = {r["id"] for r in jl(out)}
        items = [it for it in jl(ROOT / "data" / fname) if it["id"] not in done]

        def work(it, name=name, out=out):
            r = run_item(backend, it["text"], max_rounds=rounds)
            r.update({k: v for k, v in it.items() if k != "text"})
            append(out, r)
            print(f"[{name}] {it['id']} rounds={r['rounds']} conv={r['converged']} :: {r['final_realization']}", flush=True)

        pmap(work, items, workers)


def evaluate_sets(workers):
    out = OUT / "eval.jsonl"
    seen = {(d["set"], d["id"], d["stage"]) for d in jl(out)}
    jobs = []
    for name in SETS:
        for r in jl(OUT / f"{name}.jsonl"):
            for stage, key in (("first", "first_valid_realization"), ("final", "final_realization")):
                if (name, r["id"], stage) not in seen:
                    jobs.append((name, r["id"], stage, r["text"], r.get(key)))
    # v1 baseline on the old 40, re-judged with the same (v2) eval prompt
    for r in jl(ROOT / "results" / "evl_prolog.jsonl"):
        if ("v1_old40", r["id"], "final") not in seen:
            jobs.append(("v1_old40", r["id"], "final", r["text"], r["final_realization"]))

    def work(j):
        name, iid, stage, text, cand = j
        d = eval_judge(text, cand) if cand else {"label": "major", "reason": "no valid formalisation"}
        append(out, {"set": name, "id": iid, "stage": stage, "candidate": cand, **d})

    pmap(work, jobs, workers)


def mutation_test(workers):
    out = OUT / "mutations.jsonl"
    if out.exists():
        return
    jobs = []
    for name in ("new_phenomena", "speech_acts"):
        for r in jl(OUT / f"{name}.jsonl"):
            if not r.get("converged"):
                continue
            for kind, code in mutations(r["final_code"]).items():
                if evl.load(code).errors:
                    continue
                real = evl.english(code)
                if real != r["final_realization"]:
                    jobs.append((name, r["id"], kind, r["text"], real))

    def work(j):
        name, iid, kind, text, real = j
        v = loop_judge(text, real)
        append(out, {"set": name, "id": iid, "mutation": kind, "realization": real, "detected": not v["equivalent"]})

    pmap(work, jobs, workers)


# ------------------------------------------------------------------ question answering
BASELINE_SYS = ("Answer the question using ONLY the given text. Answer briefly (a word or a short phrase). "
                "For yes/no questions answer yes, no, probably yes, probably no, or unknown if the text does not settle it.")


def run_qa(rounds, workers):
    out = OUT / "qa.jsonl"
    done = {(r["ctx_id"], r["q"]) for r in jl(out)}
    backend = EVLBackend()
    ctxs = jl(ROOT / "data" / "qa.jsonl")

    def work_ctx(c):
        todo = [q for q in c["questions"] if (c["id"], q["q"]) not in done]
        if not todo:
            return
        cr = run_item(backend, c["context"], max_rounds=rounds)
        ctx_code = cr["final_code"]
        for q in todo:
            qr = run_item(EVLQuestionBackend(ctx_code), q["q"], max_rounds=rounds)
            try:
                a = answer(ctx_code, qr["final_code"]) if qr["final_realization"] else {"answer": "error: no valid question"}
            except Exception as e:  # noqa: BLE001
                a = {"answer": f"error: {e}"}
            base = llm.complete(f"TEXT:\n{c['context']}\n\nQUESTION: {q['q']}", BASELINE_SYS).strip()
            g_sym = qa_judge(c["context"], q["q"], q["gold"], a.get("answer", ""))
            g_base = qa_judge(c["context"], q["q"], q["gold"], base)
            rec = {"ctx_id": c["id"], "context": c["context"], "ctx_converged": cr["converged"],
                   "ctx_realization": cr["final_realization"], "ctx_code": ctx_code,
                   "q": q["q"], "type": q["type"], "gold": q["gold"],
                   "q_converged": qr["converged"], "q_realization": qr["final_realization"], "q_code": qr["final_code"],
                   "symbolic": a, "symbolic_correct": g_sym["correct"], "symbolic_reason": g_sym.get("reason"),
                   "baseline": base, "baseline_correct": g_base["correct"]}
            append(out, rec)
            print(f"[qa] {c['id']} {q['q']} -> {a.get('answer')} ({g_sym['correct']}) | haiku: {base} ({g_base['correct']})", flush=True)

    pmap(work_ctx, ctxs, workers)


# ------------------------------------------------------------------ report
def pct(a, b):
    return f"{100 * a / b:.0f}%" if b else "–"


def report():
    ev = defaultdict(dict)
    for d in jl(OUT / "eval.jsonl"):
        ev[(d["set"], d["stage"])][d["id"]] = d["label"]
    lines = ["## Round trip (Sonnet judge, % of test cases)", "",
             "| set | test cases | equivalent – first formalisation | equivalent – after loop | equivalent or minor – after loop | major – after loop | Haiku loop judge accepted |",
             "|---|---|---|---|---|---|---|"]
    summary = {}
    rows = [("v1_old40", None)] + [(k, k) for k in SETS]
    for name, f in rows:
        rs = jl(OUT / f"{f}.jsonl") if f else jl(ROOT / "results" / "evl_prolog.jsonl")
        n = len(rs)
        if not n:
            continue
        fin = Counter(ev[(name, "final")].values())
        first = Counter(ev[(name, "first")].values())
        conv = sum(r["converged"] for r in rs)
        label = "old 40 (EVL v1, earlier run)" if name == "v1_old40" else {"old40": "old 40 (EVL v2)", "new_phenomena": "new phenomena",
                                                                          "speech_acts": "questions & speech acts"}[name]
        lines.append(f"| {label} | {n} | {pct(first['equivalent'], n) if first else '–'} | {pct(fin['equivalent'], n)} | "
                     f"{pct(fin['equivalent'] + fin['minor'], n)} | {pct(fin['major'], n)} | {pct(conv, n)} |")
        summary[name] = {"n": n, "first": dict(first), "final": dict(fin), "loop_converged": conv}
    # per category for new sets
    lines += ["", "### Per category (after loop, % equivalent / % equivalent-or-minor)", "",
              "| set | category | test cases | equivalent | equivalent or minor |", "|---|---|---|---|---|"]
    for name in ("new_phenomena", "speech_acts"):
        bycat = defaultdict(list)
        for r in jl(OUT / f"{name}.jsonl"):
            bycat[r["cat"]].append(ev[(name, "final")].get(r["id"]))
        for cat, labs in bycat.items():
            n = len(labs)
            lines.append(f"| {name} | {cat} | {n} | {pct(labs.count('equivalent'), n)} | "
                         f"{pct(labs.count('equivalent') + labs.count('minor'), n)} |")
    # speech act type accuracy
    acts = jl(OUT / "speech_acts.jsonl")
    if acts:
        ok = 0
        for r in acts:
            m = re.search(r"act\(\s*\w+\s*,\s*(\w+)", r["final_code"] or "")
            ok += (m.group(1) if m else "assert") == r["act"]
        lines += ["", f"**Intent (speech-act type) recognised correctly:** {pct(ok, len(acts))} of {len(acts)} test cases."]
        summary["act_type_accuracy"] = [ok, len(acts)]
    ms = jl(OUT / "mutations.jsonl")
    if ms:
        by = defaultdict(list)
        for m in ms:
            by[m["mutation"]].append(m["detected"])
        lines += ["", f"**Judge mutation test** ({len(ms)} mutated formalisations): detected "
                  f"{pct(sum(m['detected'] for m in ms), len(ms))} — " +
                  ", ".join(f"{k} {pct(sum(v), len(v))} of {len(v)}" for k, v in sorted(by.items()))]
        summary["mutations"] = {k: [sum(v), len(v)] for k, v in by.items()}
    qa = jl(OUT / "qa.jsonl")
    if qa:
        n = len(qa)
        s_ok = sum(r["symbolic_correct"] for r in qa)
        b_ok = sum(r["baseline_correct"] for r in qa)
        lines += ["", "## Question answering by executing the question in Prolog", "",
                  f"Test cases: {n} questions over {len({r['ctx_id'] for r in qa})} short texts.", "",
                  "| method | correct |", "|---|---|",
                  f"| EVL formalisation + Prolog execution | {pct(s_ok, n)} ({s_ok}/{n}) |",
                  f"| Haiku reading the text directly (baseline) | {pct(b_ok, n)} ({b_ok}/{n}) |", "",
                  "| question type | test cases | EVL + Prolog | Haiku baseline |", "|---|---|---|---|"]
        byt = defaultdict(list)
        for r in qa:
            byt[r["type"]].append(r)
        for t, rs in sorted(byt.items()):
            lines.append(f"| {t} | {len(rs)} | {pct(sum(r['symbolic_correct'] for r in rs), len(rs))} | "
                         f"{pct(sum(r['baseline_correct'] for r in rs), len(rs))} |")
        summary["qa"] = {"n": n, "symbolic": s_ok, "baseline": b_ok}
    (OUT / "summary.md").write_text("\n".join(lines) + "\n")
    (OUT / "summary.json").write_text(json.dumps(summary, indent=2))
    print("\n".join(lines))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rounds", type=int, default=4)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--report-only", action="store_true")
    ap.add_argument("--only", choices=["sets", "qa"])
    a = ap.parse_args()
    if not a.report_only:
        if a.only in (None, "sets"):
            run_sets(a.rounds, a.workers)
            evaluate_sets(a.workers)
            mutation_test(a.workers)
        if a.only in (None, "qa"):
            run_qa(a.rounds, max(2, a.workers // 2))
    report()


if __name__ == "__main__":
    main()
