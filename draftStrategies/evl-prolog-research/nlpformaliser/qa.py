"""Answer an EVL-formalised question by EXECUTING it as a Prolog query over an EVL fact base.

    context text --(formalise)--> EVL facts  ┐
    question     --(formalise)--> EVL act(ask, ...) ──compile──> Prolog goal ──run with kb.pl──> answer

Answers: "yes" / "no" / "probably yes" / "probably no" / "unknown" for yes/no questions, the rendered
filler(s) for wh-questions, plus the supporting context sentence(s) (provenance).
"""
from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

from . import evl
from .evl import KB, English, _adj, number_words

HERE = Path(__file__).resolve().parent
KB_PL = HERE / "kb.pl"
OK_STATUS = ("asserted", "derived", "generic")


def _q(atom) -> str:
    return "'" + str(atom).replace("\\", "\\\\").replace("'", "\\'") + "'"


class Compiler:
    def __init__(self, ctx_facts, q_facts):
        self.ctx = KB(ctx_facts)
        self.q = KB(q_facts)
        self.ctx_ents = {x for x, e in self.ctx.ents.items() if e.inst or e.name or e.pron or e.members or e.measure}
        self.goals_names, self.goals_main, self.goals_late = [], [], []
        self.modes = []
        self.n = 0

    def var(self, i):
        if i in self.q.evs:
            return f"E_{i}"
        e = self.q.ents.get(i)
        if e is not None and not e.wh and i in self.ctx_ents and not (e.inst or e.name):
            return _q(i)  # question re-uses a context id
        return f"X_{i}"

    def term(self, a) -> str:
        if isinstance(a, (int, float)):
            return str(a)
        if isinstance(a, list):
            return "[" + ",".join(self.term(x) for x in a) + "]"
        if isinstance(a, tuple):
            return f"{_q(a[0])}({','.join(self.term(x) for x in a[1:])})"
        if a in self.q.evs or a in self.q.ents:
            return self.var(a)
        return _q(a)

    def mode(self):
        self.n += 1
        m = f"M{self.n}"
        self.modes.append(m)
        return m

    def entity_goals(self, x):
        e = self.q.ents[x]
        v = self.var(x)
        if not v.startswith("X_"):
            return
        if e.name:
            self.goals_names.append(f"fact(name({v}, {_q(e.name)}))")
        for c in e.inst:
            self.goals_late.append(f"isa({v}, {_q(c)})")
        for p in e.props:
            self.goals_late.append(f"attr({v}, {self.term(p)})")
        for r, y in e.rels:
            self.goals_late.append(f"fact(rel({v}, {self.term(r)}, {self.term(y)}))")
        if e.quant in evl.UNIVERSAL_Q:
            self.goals_late.append(f"generic_ent({v}, _)")
        if e.measure and isinstance(e.measure[0], (int, float)):
            self.goals_late.append(f"fact(measure({v}, N_{x}, {_q(e.measure[1])})), amount_ok(N_{x}, {e.measure[0]})")

    def event_goals(self, e, main=False):
        ev = self.q.evs[e]
        E = self.var(e)
        out = [f"ev_type({E}, {_q(ev.verb)})"]
        for r, a in ev.roles:
            rt = self.term(r)
            if isinstance(a, str) and a in self.q.ents and self.q.ents[a].wh == "why":
                out.append(f"cause_of({E}, {self.var(a)})")
                continue
            if isinstance(a, str) and a in self.q.ents and self.q.ents[a].members:
                for m in self.q.ents[a].members:
                    out.append(f"fills({E}, {rt}, {self.term(m)}, {self.mode()})")
                continue
            if r in ("time", "manner") and not (isinstance(a, str) and a in self.q.ents):
                continue  # adverbial atoms are not constraints
            if isinstance(a, str) and a in self.q.ents and self.q.ents[a].pron and not self.q.ents[a].inst:
                out.append(f"fills({E}, {rt}, _, {self.mode()})")  # pronoun: any filler
                continue
            out.append(f"fills({E}, {rt}, {self.term(a)}, {self.mode()})")
        return out

    def compile(self):
        acts = [a for a in self.q.acts.values() if a.type == "ask"]
        if not acts:
            raise ValueError("question has no act(_, ask, _)")
        main = acts[0].content
        wh = self.q.wh_in(main)
        if wh is None:  # wh possibly in a nested event (e.g. content)
            wh = next((x for x, e in self.q.ents.items() if e.wh), None)
        for x in self.q.ents:
            if not self.q.ents[x].wh:
                self.entity_goals(x)
            elif self.q.ents[x].inst and self.q.ents[x].wh in ("which", "how_many", "what", "who"):
                for c in self.q.ents[x].inst:
                    self.goals_late.append(f"isa({self.var(x)}, {_q(c)})")
        self.goals_main += self.event_goals(main, main=True)
        for e in self.q.evs:
            if e != main:
                self.goals_late += self.event_goals(e)
        E = self.var(main)
        W = self.var(wh) if wh else "none"
        goal = ", ".join(self.goals_names + self.goals_main + self.goals_late +
                         [f"status({E}, S)", f"polarity({E}, P)"])
        template = f"sol({E}, S, P, {W}, [{', '.join(self.modes)}])"
        return main, wh, goal, template


def run_prolog(ctx_code: str, template: str, goal: str, timeout=60):
    with tempfile.TemporaryDirectory() as d:
        ctx = Path(d) / "ctx.pl"
        ctx.write_text(ctx_code)
        script = Path(d) / "q.pl"
        script.write_text(f""":- consult({_q(str(KB_PL))}).
:- initialization(main, main).
main :- load_kb({_q(str(ctx))}),
        catch(emit_all({template}, ({goal})), Err, (print_message(error, Err), format("[]~n"))).
""")
        p = subprocess.run(["swipl", "-q", str(script)], capture_output=True, text=True, timeout=timeout)
    lines = [l for l in p.stdout.splitlines() if l.strip()]
    sols = evl._term(json.loads(lines[-1])) if lines else []
    return sols, p.stderr.strip()


def _render(ctx_kb_facts, x, wh=None) -> str:
    eng = English(KB(ctx_kb_facts))
    if isinstance(x, str) and x in eng.kb.evs:
        s = eng.clause(x)
        return ("because " + s) if wh == "why" else s
    if isinstance(x, str) and x in eng.kb.ents:
        ent = eng.kb.ents[x]
        if wh == "how_many":
            q = ent.quant
            if isinstance(q, (int, float)):
                return number_words(q)
            if ent.members:
                return number_words(len(ent.members))
            if ent.measure:
                return eng.np(x)
            return "all" if q in evl.UNIVERSAL_Q else str(q)
        return eng.np(x, "obj")
    return _adj(x)


def answer(ctx_code: str, q_code: str) -> dict:
    ctx = evl.load(ctx_code)
    q = evl.load(q_code)
    if ctx.errors or q.errors:
        return {"answer": "error", "detail": (ctx.errors + q.errors)[:3]}
    comp = Compiler(ctx.facts, q.facts)
    try:
        main, wh, goal, template = comp.compile()
    except ValueError as e:
        return {"answer": "error", "detail": [str(e)]}
    qev = comp.q.evs[main]
    out = {"goal": goal}

    # copular class questions: "Is Willy a mammal?"
    attrs = [a for r, a in qev.roles if r == "attribute"]
    theme = next((a for r, a in qev.roles if r == "theme"), None)
    if (qev.verb == "be" and wh is None and attrs and isinstance(attrs[0], str) and attrs[0] in comp.q.ents
            and comp.q.ents[attrs[0]].inst and theme is not None):
        cls = comp.q.ents[attrs[0]].inst[0]
        t = comp.var(theme)
        pre = ", ".join(comp.goals_names) or "true"
        for test, ans in ((f"isa({t}, {_q(cls)})", "yes"), (f"not_isa({t}, {_q(cls)})", "no")):
            sols, err = run_prolog(ctx_code, "ok", f"{pre}, {test}")
            if sols:
                out.update(answer=ans, mode="taxonomy")
                return out
        out.update(answer="unknown", mode="taxonomy")
        return out

    sols, err = run_prolog(ctx_code, template, goal)
    out["n_solutions"] = len(sols)
    if err and "error" in err.lower():
        out["prolog_error"] = err[-300:]
    good = [s for s in sols if s[2] in OK_STATUS]
    support = []

    def direct(s):
        return all(m == "direct" for m in s[5])

    if wh is None:  # yes/no
        dsols = [s for s in good if direct(s)]
        if dsols:
            pos = [s for s in dsols if s[3] == "pos"]
            ans = "yes" if pos else "no"
            support = [s[1] for s in (pos or dsols)]
            out.update(answer=ans, mode="direct")
        else:
            gsols = []
            for s in good:
                gm = [m for m in s[5] if isinstance(m, tuple) and m[0] == "gen"]
                if gm:
                    gsols.append((min(m[3] for m in gm), s, gm))
            if gsols:
                best = min(d for d, _, _ in gsols)
                top = [(s, gm) for d, s, gm in gsols if d == best]
                negs = [s for s, gm in top if s[3] == "neg" or any(m[2] == "no" for m in gm)]
                if negs:
                    out.update(answer="no", mode="generic")
                    support = [s[1] for s in negs]
                else:
                    weak = any(m[2] in ("most", "many") for _, gm in top for m in gm)
                    few = any(m[2] == "few" for _, gm in top for m in gm)
                    out.update(answer="probably no" if few else ("probably yes" if weak else "yes"), mode="generic")
                    support = [s[1] for s, _ in top]
            else:
                out.update(answer="unknown", mode="none")
    else:
        qneg = "neg" if qev.neg else "pos"
        cands = [s for s in good if s[3] == qneg and direct(s)]
        vals = []
        for s in cands:
            if s[4] not in vals and s[4] != "_":
                vals.append(s[4])
        support = [s[1] for s in cands]
        if not vals:
            out.update(answer="unknown", mode="none")
        else:
            w = comp.q.ents[wh].wh
            if w == "how_many" and len(vals) > 1:
                out.update(answer=number_words(len(vals)), mode="count")
            else:
                out.update(answer=", ".join(_render(ctx.facts, v, w) for v in vals), mode="direct")
    seen = []
    for e in support:
        if e not in seen:
            seen.append(e)
    out["support"] = [_cap(_render(ctx.facts, e)) for e in seen[:3]]
    return out


def _cap(s):
    return s[:1].upper() + s[1:]
