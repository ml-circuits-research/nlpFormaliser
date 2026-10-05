"""Meaning-changing mutations of EVL code — used to test whether the judge notices
that a formalisation was *changed* ("change the semantics, interpret, compare")."""
from __future__ import annotations

import random
import re

from . import evl


def _facts(code):
    return [l.strip() for l in re.split(r"(?<=\.)\s*\n|(?<=\.)\s+(?=[a-z_]+\()", code) if l.strip()]


def mutations(code: str) -> dict[str, str]:
    facts = _facts(code)
    kb = evl.KB(evl.load(code).facts)
    out = {}
    events = list(kb.evs)
    if not events:
        return out
    main = events[0]
    # 1. negation flip on the first event
    if kb.evs[main].neg:
        out["negation"] = "\n".join(f for f in facts if not re.match(rf"neg\(\s*{main}\s*\)", f))
    else:
        out["negation"] = "\n".join(facts + [f"neg({main})."])
    # 2. swap the two core participants of an event
    for e, ev in kb.evs.items():
        rd = {r: a for r, a in ev.roles if isinstance(r, str)}
        subj = next((r for r in ("agent", "experiencer") if r in rd), None)
        obj = next((r for r in ("patient", "theme", "stimulus", "recipient") if r in rd), None)
        if subj and obj and rd[subj] in kb.ents and rd[obj] in kb.ents:
            a, b = rd[subj], rd[obj]
            new = []
            for f in facts:
                if re.match(rf"role\(\s*{e}\s*,\s*{subj}\s*,\s*{a}\s*\)", f):
                    f = f"role({e}, {subj}, {b})."
                elif re.match(rf"role\(\s*{e}\s*,\s*{obj}\s*,\s*{b}\s*\)", f):
                    f = f"role({e}, {obj}, {a})."
                new.append(f)
            out["role_swap"] = "\n".join(new)
            break
    # 3. quantifier / number change
    for i, f in enumerate(facts):
        m = re.match(r"quant\(\s*(\w+)\s*,\s*(\w+)\s*\)", f)
        if m:
            x, q = m.groups()
            nq = {"every": "some", "all": "some", "each": "some", "some": "every", "a": "every",
                  "no": "some", "most": "few", "few": "most", "many": "few", "the": "every"}.get(q)
            if q.isdigit():
                nq = str(int(q) + 1)
            if nq:
                out["quantifier"] = "\n".join(facts[:i] + [f"quant({x}, {nq})."] + facts[i + 1:])
                break
    # 4. tense change on the first event
    t = kb.evs[main].tense
    nt = {"past": "future", "present": "past", "future": "past"}[t]
    out["tense"] = "\n".join([f for f in facts if not re.match(rf"tense\(\s*{main}\s*,", f)] + [f"tense({main}, {nt})."])
    # 4b. speech-act change (question <-> request <-> command)
    for i, f in enumerate(facts):
        m = re.match(r"act\(\s*(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*\)", f)
        if m:
            a_, t_, c_ = m.groups()
            nt_ = {"ask": "command", "request": "ask", "command": "ask"}.get(t_, "ask")
            out["speech_act"] = "\n".join(facts[:i] + [f"act({a_}, {nt_}, {c_})."] + facts[i + 1:])
            break
    # 5. drop one non-core role / property (information loss)
    rng = random.Random(len(code))
    cands = [i for i, f in enumerate(facts)
             if re.match(r"(prop\(|role\(\s*\w+\s*,\s*(location|time|manner|recipient|instrument|purpose|cause|beneficiary|source|destination|pp\())", f)]
    if cands:
        i = rng.choice(cands)
        out["drop_fact"] = "\n".join(facts[:i] + facts[i + 1:])
    return out
