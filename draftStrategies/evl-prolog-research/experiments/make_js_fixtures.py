"""Generate parity fixtures for the JS port from the Python reference implementation.

Collects every EVL formalisation produced in the experiments (all rounds), plus hand-written cases and
QA pairs, and records what the Python implementation outputs: checker verdict, English, FOL, QA answers.
    python experiments/make_js_fixtures.py   ->  js/test/fixtures.json
"""
import glob
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from nlpformaliser import evl, qa  # noqa: E402

codes = []
for f in sorted(glob.glob(str(ROOT / "results" / "evl_prolog*.jsonl")) + glob.glob(str(ROOT / "results" / "v2" / "*.jsonl"))):
    if f.endswith(("eval.jsonl", "mutations.jsonl")):
        continue
    for l in open(f):
        r = json.loads(l)
        for s in r.get("trace", []):
            if s.get("code"):
                codes.append(s["code"])
        for k in ("ctx_code", "q_code"):
            if r.get(k):
                codes.append(r[k])
hand = ROOT / "js" / "test" / "hand_cases.json"
if hand.exists():
    codes += json.loads(hand.read_text())["codes"]
seen, uniq = set(), []
for c in codes:
    if c not in seen:
        seen.add(c)
        uniq.append(c)

cases = []
for c in uniq:
    r = evl.load(c)
    case = {"code": c, "ok": not r.errors, "n_errors": len(r.errors)}
    try:
        case["english"] = evl.english(r.facts)
    except Exception as e:  # noqa: BLE001
        case["english_error"] = repr(e)
    try:
        case["fol"] = evl.fol(r.facts)
    except Exception as e:  # noqa: BLE001
        case["fol_error"] = repr(e)
    cases.append(case)

qa_cases = []
if hand.exists():
    for ctx, q in json.loads(hand.read_text())["qa"]:
        a = qa.answer(ctx, q)
        qa_cases.append({"context": ctx, "question": q, "answer": a.get("answer"), "mode": a.get("mode"), "support": a.get("support")})
for f in glob.glob(str(ROOT / "results" / "v2" / "qa.jsonl")):
    for l in open(f):
        r = json.loads(l)
        if r.get("q_code") and r.get("ctx_code"):
            a = qa.answer(r["ctx_code"], r["q_code"])
            qa_cases.append({"context": r["ctx_code"], "question": r["q_code"], "answer": a.get("answer"),
                             "mode": a.get("mode"), "support": a.get("support")})

(ROOT / "js" / "test" / "fixtures.json").write_text(json.dumps({"cases": cases, "qa": qa_cases}, indent=1))
print(len(cases), "EVL codes,", len(qa_cases), "QA pairs")
