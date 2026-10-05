"""Cross-check: take the formalisations accepted in the LLM-realiser control condition and execute
them with the deterministic EVL interpreter instead. If the LLM verbaliser was 'repairing' missing
content, the deterministic realisation will be judged worse."""
import json
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from nlpformaliser import evl  # noqa: E402
from nlpformaliser.judge import eval_judge  # noqa: E402

rs = [json.loads(l) for l in (ROOT / "results/evl_prolog_llm_realizer.jsonl").read_text().splitlines()]


def work(r):
    det = evl.english(r["final_code"])
    j = eval_judge(r["text"], det)
    return {"id": r["id"], "text": r["text"], "llm_realization": r["final_realization"],
            "deterministic_realization": det, **j}


with ThreadPoolExecutor(8) as ex:
    out = list(ex.map(work, rs))
(ROOT / "results/crosscheck.jsonl").write_text("".join(json.dumps(o) + "\n" for o in out))
ev = {d["id"]: d["label"] for d in map(json.loads, (ROOT / "results/eval.jsonl").read_text().splitlines())
      if d["backend"] == "evl_prolog_llm_realizer" and d["stage"] == "final"}
print("LLM realiser (Sonnet labels):          ", Counter(ev.values()))
print("same code, deterministic interpreter:  ", Counter(o["label"] for o in out))
for o in out:
    if ev.get(o["id"]) == "equivalent" and o["label"] == "major":
        print(f"- {o['text']}\n    LLM: {o['llm_realization']}\n    DET: {o['deterministic_realization']}\n    {o['reason']}")
