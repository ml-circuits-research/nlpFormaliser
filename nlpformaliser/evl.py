"""EVL: load (via SWI-Prolog), validate and *interpret* the Event-Logic DSL.

Interpretations ("semantics") of the same Prolog facts:
  * english(...)  deterministic English realisation (rule-based, no LLM)
  * fol(...)      first-order-logic rendering (neo-Davidsonian)
Both are plain functions over the fact base, so new semantics (another language,
a database, a planner...) can be plugged in without touching the formalisation.
"""
from __future__ import annotations

import json
import subprocess
import tempfile
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from lemminflect import getAllInflectionsOOV, getInflection

HERE = Path(__file__).resolve().parent
EVL_PL = HERE / "evl.pl"
SPEC = (HERE / "prolog_dsl_spec.md").read_text()


# --------------------------------------------------------------------- loading
@dataclass
class Loaded:
    ok: bool
    facts: list
    errors: list
    warnings: list


def load(code: str) -> Loaded:
    """Parse + integrity-check EVL code with SWI-Prolog (evl.pl)."""
    with tempfile.NamedTemporaryFile("w", suffix=".pl", delete=False) as f:
        f.write(code)
        path = f.name
    p = subprocess.run(["swipl", "-q", str(EVL_PL), "--", path], capture_output=True, text=True, timeout=60)
    Path(path).unlink(missing_ok=True)
    try:
        d = json.loads(p.stdout.strip().splitlines()[-1])
    except Exception:  # noqa: BLE001
        return Loaded(False, [], [f"prolog loader crashed: {p.stderr[-400:]}"], [])
    return Loaded(bool(d["ok"]) and d["ok"] != "false", [_term(t) for t in d["facts"]], d["errors"], d["warnings"])


def _term(j):
    if isinstance(j, dict):
        return (j["f"], *[_term(a) for a in j["a"]])
    if isinstance(j, list):
        return tuple(_term(a) for a in j)
    return j


# --------------------------------------------------------------------- model
@dataclass
class Ent:
    inst: list = field(default_factory=list)
    name: str | None = None
    pron: str | None = None
    props: list = field(default_factory=list)
    quant: object = None
    plural: bool = False
    rels: list = field(default_factory=list)
    restrict: list = field(default_factory=list)


@dataclass
class Ev:
    verb: str
    roles: list = field(default_factory=list)
    tense: str = "present"
    aspect: str | None = None
    modal: str | None = None
    neg: bool = False
    passive: bool = False


class KB:
    def __init__(self, facts):
        self.ents: dict[str, Ent] = defaultdict(Ent)
        self.evs: dict[str, Ev] = {}
        self.links = []
        self.kinds = []
        pending = []
        for f in facts:
            p, a = f[0], f[1:]
            if p == "event":
                self.evs.setdefault(a[0], Ev(a[1]))
            else:
                pending.append(f)
        for f in pending:
            p, a = f[0], f[1:]
            if p == "inst":
                self.ents[a[0]].inst.append(a[1])
            elif p == "name":
                self.ents[a[0]].name = str(a[1])
            elif p == "pron":
                self.ents[a[0]].pron = a[1]
            elif p == "prop":
                self.ents[a[0]].props.append(a[1])
            elif p == "quant":
                self.ents[a[0]].quant = a[1]
            elif p == "plural":
                self.ents[a[0]].plural = True
            elif p == "rel":
                self.ents[a[0]].rels.append((a[1], a[2]))
            elif p == "restrict":
                self.ents[a[0]].restrict.append(a[1])
            elif p == "link":
                self.links.append(tuple(a))
            elif p == "kind":
                self.kinds.append(tuple(a))
            elif a and a[0] in self.evs:
                ev = self.evs[a[0]]
                if p == "role":
                    ev.roles.append((a[1], a[2]))
                elif p == "tense":
                    ev.tense = a[1]
                elif p == "aspect":
                    ev.aspect = a[1]
                elif p == "modal":
                    ev.modal = a[1]
                elif p == "neg":
                    ev.neg = True
                elif p == "voice" and a[1] == "passive":
                    ev.passive = True


# --------------------------------------------------------------------- morphology
def _words(lemma) -> str:
    return str(lemma).replace("_", " ")


def inflect(lemma: str, tag: str) -> str:
    parts = str(lemma).split("_")
    head = parts[0] if tag.startswith("V") else parts[-1]
    upos = "VERB" if tag.startswith("V") else ("NOUN" if tag.startswith("N") else "ADJ")
    if head == "be":
        out = {"VBD": "was", "VBN": "been", "VBG": "being", "VBZ": "is", "VBP": "are", "VB": "be"}[tag]
    else:
        r = getInflection(head, tag=tag)
        if not r:
            r = getAllInflectionsOOV(head, upos=upos).get(tag)
        out = r[0] if r else head
    if tag.startswith("V"):
        parts[0] = out
    else:
        parts[-1] = out
    return " ".join(parts)


NUM = "zero one two three four five six seven eight nine ten eleven twelve".split()
PERSON_NOUNS = set("""man woman person people child boy girl student teacher doctor friend brother sister
mother father parent son daughter king queen worker player farmer customer manager scientist author
writer driver baby lawyer nurse engineer president officer soldier guest neighbor neighbour child
employee user programmer researcher professor politician citizen""".split())
ROLE_PREP = {"recipient": "to", "beneficiary": "for", "instrument": "with", "location": "in",
             "source": "from", "destination": "to", "path": "through", "topic": "about",
             "companion": "with", "time": "at", "standard": "than", "extent": ""}
SUBJ_ORDER = ["agent", "experiencer", "theme", "patient", "stimulus"]
OBJ_ORDER = ["patient", "theme", "stimulus"]
PRON = {"i": ("I", "me", "my"), "you": ("you", "you", "your"), "he": ("he", "him", "his"),
        "she": ("she", "her", "her"), "it": ("it", "it", "its"), "we": ("we", "us", "our"),
        "they": ("they", "them", "their")}
PLURAL_Q = {"all", "many", "few", "several", "most", "these", "those", "both"}


def _adj(a) -> str:
    if isinstance(a, tuple) and a[0] == "very":
        return "very " + _adj(a[1])
    if isinstance(a, tuple):
        return " ".join(_adj(x) for x in a)
    return _words(a)


def _comparative(adj: str) -> str:
    if len(adj) <= 6 or adj.endswith("y"):
        r = getInflection(adj, tag="JJR")
        if r and not r[0].startswith("more"):
            return r[0]
    return "more " + adj


def _superlative(adj: str) -> str:
    if len(adj) <= 6 or adj.endswith("y"):
        r = getInflection(adj, tag="JJS")
        if r and not r[0].startswith("most"):
            return r[0]
    return "most " + adj


# --------------------------------------------------------------------- English semantics
class English:
    def __init__(self, kb: KB):
        self.kb = kb
        self.mentioned: set[str] = set()
        self.rendered: set[str] = set()
        self.depth = 0

    # ---- entities
    def is_plural(self, x) -> bool:
        e = self.kb.ents.get(x)
        if e is None:
            return False
        if e.pron:
            return e.pron in ("we", "they", "you") and e.pron != "you"
        q = e.quant
        return e.plural or (isinstance(q, int) and q != 1) or q in PLURAL_Q

    def person(self, x):
        e = self.kb.ents.get(x)
        if e and e.pron:
            return {"i": 1, "we": 1, "you": 2}.get(e.pron, 3)
        return 3

    def is_human(self, x) -> bool:
        e = self.kb.ents.get(x)
        return bool(e and (e.name or e.pron in ("i", "you", "he", "she", "we") or any(i in PERSON_NOUNS for i in e.inst)))

    def np(self, x, case="subj", gap=None) -> str:
        if x == gap:
            return ""
        if x in self.kb.evs:  # an event used as an argument
            return "that " + self.clause(x)
        if x not in self.kb.ents:  # atom (adverb, adjective, ...)
            return _adj(x)
        e = self.kb.ents[x]
        self.depth += 1
        if self.depth > 6:
            self.depth -= 1
            return "it"
        try:
            first = x not in self.mentioned
            if e.pron and (not (e.inst or e.name) or not first):
                self.mentioned.add(x)
                return PRON[e.pron][0 if case == "subj" else 1]
            self.mentioned.add(x)
            plural = self.is_plural(x)
            poss = [y for r, y in e.rels if r == "poss"]
            pps = [(r, y) for r, y in e.rels if r != "poss"]
            if e.name:
                head = e.name
                det = ""
                mods = [_adj(p) for p in e.props]
            else:
                noun = e.inst[0] if e.inst else "thing"
                head = inflect(noun, "NNS") if plural else _words(noun)
                mods = [_adj(p) for p in e.props]
                q = e.quant
                if poss:
                    y = poss[0]
                    ye = self.kb.ents.get(y)
                    if ye and ye.pron:
                        det = PRON[ye.pron][2]
                    else:
                        owner = self.np(y, "obj")
                        det = owner + ("'" if owner.endswith("s") and self.is_plural(y) else "'s")
                elif q is None:
                    det = ("" if plural else "a") if first else "the"
                elif isinstance(q, int):
                    det = (NUM[q] if 0 <= q < len(NUM) else str(q)) if first else "the"

                elif q == "bare":
                    det = ""
                elif q in ("a", "some", "any") and not first:
                    det = "the"
                elif q == "a":
                    det = "" if plural else "a"
                elif q == "no" and not first:
                    det = "the"
                else:
                    det = q if first or q in ("this", "that", "these", "those") else "the"
            words = [w for w in [det, *mods, head] if w]
            if words and words[0] == "a" and len(words) > 1 and words[1][0].lower() in "aeiou":
                words[0] = "an"
            s = " ".join(words)
            for extra in e.inst[1:]:
                s += f", {'an' if extra[0] in 'aeiou' else 'a'} {_words(extra)},"
            for r, y in pps:
                s += f" {_words(r)} {self.np(y, 'obj')}"
            for ev in e.restrict:
                if ev in self.rendered:
                    continue
                self.rendered.add(ev)
                rp = "who" if self.is_human(x) else "that"
                s += f" {rp} {self.clause(ev, gap=x)}"
            return s
        finally:
            self.depth -= 1

    # ---- verb group
    def verb_group(self, ev: Ev, subj, form="finite") -> list[str]:
        chain = []  # (lemma, kind)
        if ev.modal:
            chain.append((ev.modal, "modal"))
        elif ev.tense == "future" and form == "finite":
            chain.append(("will", "modal"))
        if ev.aspect in ("perfect", "perfect_progressive"):
            chain.append(("have", "perf"))
        if ev.aspect in ("progressive", "perfect_progressive"):
            chain.append(("be", "prog"))
        if ev.passive:
            chain.append(("be", "pass"))
        chain.append((ev.verb, "main"))
        out, prev = [], None
        for i, (lem, kind) in enumerate(chain):
            if kind == "modal":
                w = lem
            elif prev == "modal" or (i == 0 and form == "inf"):
                w = _words(lem) if lem != "be" else "be"
            elif prev == "perf":
                w = inflect(lem, "VBN")
            elif prev == "prog":
                w = inflect(lem, "VBG")
            elif prev == "pass":
                w = inflect(lem, "VBN")
            else:
                w = self.finite(lem, ev.tense, subj)
            out.append(w)
            prev = kind
        if ev.neg:
            if form == "inf":
                out = ["not"] + out
            elif len(chain) > 1 or chain[0][0] == "be":
                out.insert(1, "not")
            else:  # do-support
                do = self.finite("do", ev.tense, subj)
                out = [do, "not", _words(ev.verb)]
        return out

    def finite(self, lem, tense, subj) -> str:
        pl = self.is_plural(subj) if subj else False
        per = self.person(subj) if subj else 3
        if lem == "be":
            if tense == "past":
                return "were" if pl or per == 2 else "was"
            return "am" if per == 1 and not pl else ("are" if pl or per == 2 else "is")
        if tense == "past":
            return inflect(lem, "VBD")
        if per == 3 and not pl:
            return inflect(lem, "VBZ")
        return _words(lem)

    # ---- clauses
    def arg(self, a, case="obj", gap=None) -> str:
        if isinstance(a, tuple):
            return _adj(a)
        if a in self.kb.evs:
            self.rendered.add(a)
            return self.clause(a, gap=gap)
        return self.np(a, case, gap)

    def clause(self, e, gap=None, form="finite") -> str:
        ev = self.kb.evs[e]
        self.rendered.add(e)
        roles = list(ev.roles)
        rd = defaultdict(list)
        for r, a in roles:
            rd[r].append(a)
        used = set()

        def take(r):
            v = rd.get(r)
            if v:
                used.add(r)
                return v[0]
            return None

        subj = None
        pre = []
        if ev.verb == "exist":
            th = take("theme") or take("agent") or take("patient")
            vg = self.verb_group(Ev("be", [], ev.tense, ev.aspect, ev.modal, ev.neg), th, form)
            pre = ["there", *vg, self.arg(th, "subj", gap)] if th else ["there", *vg, "something"]
        else:
            order = ["patient", "theme", "recipient", "stimulus", "agent"] if ev.passive else SUBJ_ORDER
            for r in ([] if form == "inf" else order):
                if rd.get(r):
                    subj = take(r)
                    break
            vg = self.verb_group(ev, subj, form)
            if form == "inf":
                pre = ["to", *vg] if not ev.neg else [vg[0], "to", *vg[1:]]
            else:
                if subj == gap and gap is not None:
                    pre = [*vg]
                else:
                    pre = [self.arg(subj, "subj", gap) if subj else "something", *vg]
        post = []
        if ev.verb == "be":
            for a in rd.get("attribute", []):
                post.append(self.attribute(a, rd))
            used |= {"attribute", "standard"}
        else:
            objs = [r for r in OBJ_ORDER if rd.get(r) and r not in used]
            has_obj = bool(objs)
            if rd.get("recipient") and "recipient" not in used and not has_obj:
                post.append(self.arg(take("recipient"), "obj", gap))
            for r in objs:
                for a in rd[r]:
                    post.append(self.arg(a, "obj", gap))
                used.add(r)
            if ev.passive and rd.get("agent") and "agent" not in used:
                post.append("by " + self.arg(take("agent"), "obj", gap))
            for a in rd.get("attribute", []):
                post.append(self.attribute(a, rd))
            used.add("attribute")
        for r, a in roles:
            if r in used or r in ("attribute",):
                continue
            post.append(self.adjunct(r, a, subj, gap))
        words = [w for w in [*pre, *post] if w]
        return " ".join(words)

    def attribute(self, a, rd) -> str:
        std = rd.get("standard", [None])[0]
        than = f" than {self.arg(std)}" if std else ""
        if isinstance(a, tuple) and a[0] in ("more", "less", "as", "most") and len(a) == 2:
            adj = _adj(a[1])
            if a[0] == "more":
                return _comparative(adj) + than
            if a[0] == "less":
                return "less " + adj + than
            if a[0] == "as":
                return f"as {adj}" + (f" as {self.arg(std)}" if std else "")
            return "the " + _superlative(adj)
        if isinstance(a, str) and a in self.kb.ents:
            return self.np(a, "obj")
        return _adj(a) + than

    def adjunct(self, r, a, subj, gap) -> str:
        if isinstance(r, tuple) and r[0] == "pp":
            return f"{_words(r[1])} {self.arg(a, 'obj', gap)}"
        if r == "content":
            if a in self.kb.evs:
                self.rendered.add(a)
                return "that " + self.clause(a, gap=gap)
            return self.arg(a, "obj", gap)
        if r == "purpose":
            if a in self.kb.evs:
                sub = self.kb.evs[a]
                ag = [x for rr, x in sub.roles if rr in SUBJ_ORDER]
                if ag and ag[0] == subj:
                    self.rendered.add(a)
                    return "in order " + self._inf(a, drop=subj)
                return "so that " + self.arg(a)
            return "for " + self.arg(a, "obj", gap)
        if r == "cause":
            if a in self.kb.evs:
                return "because " + self.arg(a)
            return "because of " + self.arg(a, "obj", gap)
        if r in ("manner",) or (r == "time" and a not in self.kb.ents):
            return _adj(a)
        if r == "location" and a not in self.kb.ents:
            return _adj(a)
        prep = ROLE_PREP.get(r, "")
        return f"{prep} {self.arg(a, 'obj', gap)}".strip()

    def _inf(self, e, drop=None) -> str:
        ev = self.kb.evs[e]
        self.rendered.add(e)
        roles = [(r, a) for r, a in ev.roles if a != drop or r not in SUBJ_ORDER]
        sub = Ev(ev.verb, roles, ev.tense, ev.aspect, None, ev.neg, ev.passive)
        tmp = "__inf__"
        self.kb.evs[tmp] = sub
        try:
            s = self.clause(tmp, form="inf")
        finally:
            del self.kb.evs[tmp]
        return s

    # ---- discourse
    def sentence(self, e) -> str:
        s = self.clause(e)
        for (a, c, b) in self.kb.links:
            if a == e and b not in self.rendered:
                sep = ", so" if c == "so" else f" {c}"
                s += f"{sep} {self.sentence(b)}"
        return s

    def render(self) -> str:
        dependent = set()
        for ev in self.kb.evs.values():
            for r, a in ev.roles:
                if isinstance(a, str) and a in self.kb.evs:
                    dependent.add(a)
        for ent in self.kb.ents.values():
            dependent |= set(ent.restrict)
        dependent |= {b for (_, _, b) in self.kb.links}
        out = []
        order = [e for e in self.kb.evs if e not in dependent] + [e for e in self.kb.evs if e in dependent]
        for e in order:
            if e in self.rendered:
                continue
            s = self.sentence(e)
            out.append(s[0].upper() + s[1:] + ".")
        return " ".join(out)


def english(code_or_facts) -> str:
    facts = load(code_or_facts).facts if isinstance(code_or_facts, str) else code_or_facts
    return English(KB(facts)).render()


# --------------------------------------------------------------------- FOL semantics
def fol(code_or_facts) -> str:
    """A second, independent interpretation: neo-Davidsonian first-order logic."""
    facts = load(code_or_facts).facts if isinstance(code_or_facts, str) else code_or_facts
    kb = KB(facts)

    def ev_atoms(e):
        ev = kb.evs[e]
        atoms = [f"{ev.verb}({e})"] + [f"{r if isinstance(r, str) else r[1]}({e},{a if isinstance(a, str) else _adj(a).replace(' ', '_')})"
                                       for r, a in ev.roles]
        if ev.tense != "present":
            atoms.append(f"{ev.tense}({e})")
        if ev.modal:
            atoms = [f"{ev.modal.upper()}[{' ∧ '.join(atoms)}]"]
        body = f"∃{e}({' ∧ '.join(atoms)})"
        return f"¬{body}" if ev.neg else body

    def ent_atoms(x):
        e = kb.ents[x]
        at = [f"{c}({x})" for c in e.inst] + [f"{_adj(p).replace(' ', '_')}({x})" for p in e.props]
        if e.name:
            at.append(f"{x}={e.name}")
        at += [f"{r}({x},{y})" for r, y in e.rels]
        return at

    univ = [x for x, e in kb.ents.items() if e.quant in ("every", "all", "each", "any")]
    exist = [x for x in kb.ents if x not in univ]
    events = [ev_atoms(e) for e in kb.evs]
    links = [f"{c}({a},{b})" for a, c, b in kb.links]
    scope = " ∧ ".join([a for x in exist for a in ent_atoms(x)] + events + links)
    if exist:
        scope = "∃" + ",".join(exist) + "(" + scope + ")"
    for x in reversed(univ):
        scope = f"∀{x}({' ∧ '.join(ent_atoms(x))} → {scope})"
    return scope
