"""AMR as an external formalisation method for the JS benchmark (`commandMethod`).

    python adapters/amr_adapter.py formalize   < text           -> AMR (PENMAN), written by an LLM (Haiku)
    python adapters/amr_adapter.py check       < amr            -> JSON {ok, errors}          (penman)
    python adapters/amr_adapter.py realize     < amr            -> English (amrlib T5 graph-to-text generator)
    python adapters/amr_adapter.py refine      < JSON {text, formalization, feedback} -> AMR

Note: the AMR "execution" is a trained neural generator, i.e. NOT a deterministic interpreter.
Requires the Python reference environment (see scripts/setup.sh): amrlib, penman, transformers 4.x.
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("HF_HUB_OFFLINE", "1")

from nlpformaliser.backends import AMRBackend  # noqa: E402


def main():
    cmd = sys.argv[1]
    data = sys.stdin.read()
    b = AMRBackend()
    if cmd == "formalize":
        print(b.formalize(data))
    elif cmd == "check":
        errs = b.check(data)
        print(json.dumps({"ok": not errs, "errors": errs}))
    elif cmd == "realize":
        import io
        import contextlib
        with contextlib.redirect_stdout(io.StringIO()):  # keep library chatter out of stdout
            out = b.realize(data)
        print(out)
    elif cmd == "refine":
        d = json.loads(data)
        fb = d.get("feedback") or {}
        print(b.refine(d["text"], d["formalization"], fb.get("errors") or [], fb.get("realization"), fb.get("differences") or []))
    else:
        sys.exit(f"unknown command {cmd}")


if __name__ == "__main__":
    main()
