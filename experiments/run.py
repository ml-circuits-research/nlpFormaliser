"""Run the round-trip formalisation experiment.

    python experiments/run.py --backends evl_prolog amr gf_rgl evl_prolog_llm_realizer --rounds 4
    python experiments/run.py --report-only

Writes results/<backend>.jsonl, results/eval.jsonl, results/mutations.jsonl, results/summary.{md,json}.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from nlpformaliser import llm  # noqa: E402
from nlpformaliser.backends import BACKENDS  # noqa: E402
from nlpformaliser.erg_backend import register as _reg_erg  # noqa: E402

_reg_erg()
from nlpformaliser.judge import eval_judge, loop_judge  # noqa: E402
from nlpformaliser.loop import run_item  # noqa: E402

RES = ROOT / "results"
RES.mkdir(exist_ok=True)


def load_data(limit=None):
    items = [json.loads(l) for l in (ROOT / "data" / "sentences.jsonl").read_text().splitlines() if l.strip()]
    return items[:limit] if limit else items


def run_backend(name, items, rounds, workers):
    backend = BACKENDS[name]()
    out = RES / f"{name}.jsonl"
    done = {}
    if out.exists():
        for l in out.read_text().splitlines():
            r = json.loads(l)
            done[r["id"]] = r

    def work(it):
        if it["id"] in done:
            return done[it["id"]]
        try:
            r = run_item(backend, it["text"], max_rounds=rounds)
        except Exception as e:  # noqa: BLE001
            r = {"backend": name, "text": it["text"], "error": repr(e), "rounds": 0, "converged": False,
                 "first_realization": None, "final_realization": None, "first_valid_realization": None,
                 "final_code": None, "trace": []}
        r.update(id=it["id"], cat=it["cat"])
        with open(out, "a") as f:
            f.write(json.dumps(r) + "\n")
        print(f"[{name}] {it['id']} rounds={r['rounds']} conv={r['converged']} :: {r['final_realization']}", flush=True)
        return r

    with ThreadPoolExecutor(workers) as ex:
        return list(ex.map(work, items))


def evaluate(names, items, workers):
    """Independent judge (Sonnet) on first valid vs final back-translation."""
    out = RES / "eval.jsonl"
    seen = set()
    if out.exists():
        seen = {(d["backend"], d["id"], d["stage"]) for d in map(json.loads, out.read_text().splitlines())}
    jobs = []
    for name in names:
        f = RES / f"{name}.jsonl"
        if not f.exists():
            continue
        for r in map(json.loads, f.read_text().splitlines()):
            for stage, key in (("first", "first_valid_realization"), ("final", "final_realization")):
                if (name, r["id"], stage) not in seen:
                    jobs.append((name, r["id"], stage, r["text"], r.get(key)))

    def work(j):
        name, iid, stage, text, cand = j
        d = eval_judge(text, cand) if cand else {"label": "major", "reason": "no valid formalisation"}
        rec = {"backend": name, "id": iid, "stage": stage, "candidate": cand, **d}
        with open(out, "a") as f:
            f.write(json.dumps(rec) + "\n")
        return rec

    with ThreadPoolExecutor(workers) as ex:
        list(ex.map(work, jobs))


def mutation_test(workers):
    """Does the loop judge notice when a converged EVL formalisation is deliberately changed?"""
    from nlpformaliser import evl
    from nlpformaliser.mutate import mutations

    src = RES / "evl_prolog.jsonl"
    out = RES / "mutations.jsonl"
    if out.exists() or not src.exists():
        return
    jobs = []
    for r in map(json.loads, src.read_text().splitlines()):
        if not r.get("converged"):
            continue
        for kind, code in mutations(r["final_code"]).items():
            if evl.load(code).errors:
                continue
            real = evl.english(code)
            if real == r["final_realization"]:
                continue
            jobs.append((r["id"], kind, r["text"], real))

    def work(j):
        iid, kind, text, real = j
        v = loop_judge(text, real)
        rec = {"id": iid, "mutation": kind, "realization": real, "detected": not v["equivalent"], "verdict": v}
        with open(out, "a") as f:
            f.write(json.dumps(rec) + "\n")
        return rec

    with ThreadPoolExecutor(workers) as ex:
        list(ex.map(work, jobs))


def report(names):
    ev = defaultdict(dict)
    if (RES / "eval.jsonl").exists():
        for d in map(json.loads, (RES / "eval.jsonl").read_text().splitlines()):
            ev[(d["backend"], d["stage"])][d["id"]] = d["label"]
    rows, summary = [], {}
    for name in names:
        f = RES / f"{name}.jsonl"
        if not f.exists():
            continue
        rs = [json.loads(l) for l in f.read_text().splitlines()]
        n = len(rs)
        valid0 = sum(1 for r in rs if r["trace"] and not r["trace"][0]["errors"])
        anyvalid = sum(1 for r in rs if r["final_realization"])
        conv = sum(r["converged"] for r in rs)
        rounds = [r["rounds"] for r in rs if r["converged"]]
        s = {"n": n, "valid_first_try": valid0, "valid_eventually": anyvalid, "loop_judge_converged": conv,
             "mean_rounds_when_converged": round(sum(rounds) / len(rounds), 2) if rounds else None}
        for stage in ("first", "final"):
            c = Counter(ev[(name, stage)].values())
            s[f"sonnet_{stage}"] = {k: c.get(k, 0) for k in ("equivalent", "minor", "major")}
        summary[name] = s
        rows.append(s | {"backend": name})
    mut = {}
    if (RES / "mutations.jsonl").exists():
        ms = [json.loads(l) for l in (RES / "mutations.jsonl").read_text().splitlines()]
        by = defaultdict(list)
        for m in ms:
            by[m["mutation"]].append(m["detected"])
        mut = {k: f"{sum(v)}/{len(v)}" for k, v in sorted(by.items())}
        mut["ALL"] = f"{sum(m['detected'] for m in ms)}/{len(ms)}"
    summary["_judge_mutation_detection"] = mut
    summary["_llm_stats"] = llm.STATS
    (RES / "summary.json").write_text(json.dumps(summary, indent=2))

    lines = ["| backend | n | valid@1st | valid@end | loop-judge OK | rounds | Sonnet first (eq/minor/major) | Sonnet final (eq/minor/major) |",
             "|---|---|---|---|---|---|---|---|"]
    for s in rows:
        f1, f2 = s["sonnet_first"], s["sonnet_final"]
        lines.append(f"| {s['backend']} | {s['n']} | {s['valid_first_try']} | {s['valid_eventually']} | "
                     f"{s['loop_judge_converged']} | {s['mean_rounds_when_converged']} | "
                     f"{f1['equivalent']}/{f1['minor']}/{f1['major']} | {f2['equivalent']}/{f2['minor']}/{f2['major']} |")
    if mut:
        lines += ["", "Judge mutation detection (EVL, converged items): " + ", ".join(f"{k}: {v}" for k, v in mut.items())]
    (RES / "summary.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backends", nargs="+", default=["evl_prolog", "amr", "gf_rgl", "evl_prolog_llm_realizer"])
    ap.add_argument("--rounds", type=int, default=4)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--report-only", action="store_true")
    ap.add_argument("--no-eval", action="store_true")
    a = ap.parse_args()
    items = load_data(a.limit)
    if not a.report_only:
        for name in a.backends:
            run_backend(name, items, a.rounds, a.workers)
        if not a.no_eval:
            evaluate(a.backends, items, a.workers)
            mutation_test(a.workers)
    report(a.backends)


if __name__ == "__main__":
    main()
