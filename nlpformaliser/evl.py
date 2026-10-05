"""EVL: load (via SWI-Prolog), validate and *interpret* the Event-Logic DSL.

Interpretations ("semantics") of the same Prolog facts:
  * english(...)  deterministic English realisation (rule-based, no LLM): statements,
                  questions, imperatives, reported speech acts
  * fol(...)      first-order-logic rendering (neo-Davidsonian, scope-aware)
  * qa.py         execution of questions as Prolog queries over a fact base
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
        if j["f"] == "$list":
            return [_term(a) for a in j["a"]]
        return (j["f"], *[_term(a) for a in j["a"]])
    if isinstance(j, list):
        return [_term(a) for a in j]
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
    members: list | None = None          # group
    measure: tuple | None = None         # (amount, unit)
    rate: str | None = None
    focus: list = field(default_factory=list)
    wh: str | None = None


@dataclass
class Ev:
    verb: str
    roles: list = field(default_factory=list)
    tense: str = "present"
    aspect: str | None = None
    modal: str | None = None
    neg: bool = False
    passive: bool = False
    generic: bool = False
    freq: str | None = None
    cf: bool = False
    focus: list = field(default_factory=list)


@dataclass
class Act:
    type: str
    content: str
    speaker: str | None = None
    addressee: str | None = None
    tense: str | None = None


class KB:
    def __init__(self, facts):
        self.ents: dict[str, Ent] = defaultdict(Ent)
        self.evs: dict[str, Ev] = {}
        self.acts: dict[str, Act] = {}
        self.links, self.kinds, self.scopes = [], [], []
        self.order: list[str] = []  # declaration order of events and acts
        pending = []
        for f in facts:
            p, a = f[0], f[1:]
            if p == "event" and a[0] not in self.evs:
                self.evs[a[0]] = Ev(a[1])
                self.order.append(a[0])
            elif p == "act" and a[0] not in self.acts:
                self.acts[a[0]] = Act(a[1], a[2])
                self.order.append(a[0])
            else:
                pending.append(f)
        for f in pending:
            p, a = f[0], f[1:]
            if p in ("speaker", "addressee", "tense") and a[0] in self.acts:
                setattr(self.acts[a[0]], p, a[1])
                continue
            if p in ("focus",) and a[0] in self.evs:
                self.evs[a[0]].focus.append(a[1])
                continue
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
            elif p == "group":
                self.ents[a[0]].members = list(a[1])
            elif p == "measure":
                self.ents[a[0]].measure = (a[1], a[2])
            elif p == "rate":
                self.ents[a[0]].rate = a[1]
            elif p == "focus":
                self.ents[a[0]].focus.append(a[1])
            elif p == "wh":
                self.ents[a[0]].wh = a[1]
            elif p == "link":
                self.links.append(tuple(a))
            elif p == "kind":
                self.kinds.append(tuple(a))
            elif p == "scope":
                self.scopes.append(tuple(a))
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
                elif p == "generic":
                    ev.generic = True
                elif p == "freq":
                    ev.freq = a[1]
                elif p == "counterfactual":
                    ev.cf = True

    def wh_in(self, e):
        """The wh item directly used in event e (if any)."""
        for _, a in self.evs[e].roles:
            if isinstance(a, str) and a in self.ents and self.ents[a].wh:
                return a
            if isinstance(a, str) and a in self.ents and self.ents[a].members:
                for m in self.ents[a].members:
                    if self.ents.get(m) and self.ents[m].wh:
                        return m
        return None


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


_ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
_TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def number_words(n) -> str:
    if isinstance(n, float) and not n.is_integer():
        return str(n)
    n = int(n)
    if 0 <= n < 20:
        return _ONES[n]
    if n < 100:
        return _TENS[n // 10] + ("" if n % 10 == 0 else "-" + _ONES[n % 10])
    return str(n)


CMP_WORDS = {"more_than": "more than", "less_than": "less than", "at_least": "at least",
             "at_most": "at most", "exactly": "exactly", "fewer_than": "fewer than"}


def amount(q, words=True) -> tuple[str, bool]:
    """Render a number or numeric comparison; returns (text, plural)."""
    if isinstance(q, tuple) and q[0] in CMP_WORDS:
        txt, _ = amount(q[1], words)
        return f"{CMP_WORDS[q[0]]} {txt}", True
    if isinstance(q, (int, float)):
        txt = number_words(q) if words and (isinstance(q, int) or float(q).is_integer()) and q < 100 else str(q)
        return txt, q != 1
    return str(q), True


CAPITALISED_UNITS = {"celsius": "Celsius", "fahrenheit": "Fahrenheit", "kelvin": "Kelvin"}

NUM = [number_words(i) for i in range(20)]
PERSON_NOUNS = set("""man woman person people child boy girl student teacher doctor friend brother sister
mother father parent son daughter king queen worker player farmer customer manager scientist author
writer driver baby lawyer nurse engineer president officer soldier guest neighbor neighbour child
employee user programmer researcher professor politician citizen tenant landlord thief visitor passenger
patient pianist adult kid boss colleague""".split())
ROLE_PREP = {"recipient": "to", "beneficiary": "for", "instrument": "with", "location": "in",
             "source": "from", "destination": "to", "path": "through", "topic": "about",
             "companion": "with", "time": "at", "standard": "than", "extent": "", "duration": "for"}
SUBJ_ORDER = ["agent", "experiencer", "theme", "patient", "stimulus"]
OBJ_ORDER = ["patient", "theme", "stimulus"]
PRON = {"i": ("I", "me", "my"), "you": ("you", "you", "your"), "he": ("he", "him", "his"),
        "she": ("she", "her", "her"), "it": ("it", "it", "its"), "we": ("we", "us", "our"),
        "they": ("they", "them", "their")}
PLURAL_Q = {"all", "many", "few", "several", "most", "these", "those", "both"}
UNIVERSAL_Q = {"every", "all", "each", "any"}
EXIST_Q = {"a", "some", "one", None}
ADVERB_WH = {"where", "when", "why", "how"}
ACT_VERB = {"ask": "ask", "request": "ask", "command": "order", "suggest": "suggest", "offer": "offer",
            "promise": "promise", "warn": "warn", "thank": "thank", "apologize": "apologize", "permit": "allow"}


def _adj(a) -> str:
    if isinstance(a, tuple) and a[0] == "very":
        return "very " + _adj(a[1])
    if isinstance(a, tuple) and a[0] in CMP_WORDS:
        return amount(a)[0]
    if isinstance(a, tuple):
        return " ".join(_adj(x) for x in a)
    if isinstance(a, (int, float)):
        return str(a)
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


def _cap(s: str) -> str:
    return s[:1].upper() + s[1:] if s else s


# --------------------------------------------------------------------- English semantics
class English:
    def __init__(self, kb: KB):
        self.kb = kb
        self.mentioned: set[str] = set()
        self.rendered: set[str] = set()
        self.depth = 0
        self.det_override: dict[str, str] = {}
        self.neg_suppressed: set[str] = set()
        self.cf_antecedent = {b for (a, c, b) in kb.links if c in ("if", "unless") and b in kb.evs and kb.evs[b].cf}
        self._apply_scope()

    # ---- scope
    def _apply_scope(self):
        for a, b in self.kb.scopes:
            if isinstance(a, tuple) and a[0] == "neg" and isinstance(b, str) and b in self.kb.ents:
                q = self.kb.ents[b].quant
                if q in UNIVERSAL_Q:      # not > every  ==  "not every"
                    self.det_override[b] = "not all" if q == "all" else "not every"
                    self.neg_suppressed.add(a[1])
                elif q in ("a", "some", "any", None) or isinstance(q, int):   # not > exists == "no"
                    self.det_override[b] = "no"
                    self.neg_suppressed.add(a[1])
                elif q in ("many", "most"):
                    self.det_override[b] = f"not {q}"
                    self.neg_suppressed.add(a[1])
            elif isinstance(b, tuple) and b[0] == "neg" and isinstance(a, str) and a in self.kb.ents:
                if self.kb.ents[a].quant in UNIVERSAL_Q:   # every > not == "no"
                    self.det_override[a] = "no"
                    self.neg_suppressed.add(b[1])

    def wide_indefinite(self, e):
        """An existential argument of e that outscopes a universal one (needs 'there is a ... that')."""
        args = {a for _, a in self.kb.evs[e].roles if isinstance(a, str)}
        for a, b in self.kb.scopes:
            if a in args and b in args and isinstance(a, str) and isinstance(b, str):
                qa, qb = self.kb.ents[a].quant, self.kb.ents[b].quant
                if (qa in EXIST_Q or isinstance(qa, int)) and qb in UNIVERSAL_Q:
                    return a
        return None

    # ---- entities
    def is_plural(self, x) -> bool:
        e = self.kb.ents.get(x)
        if e is None:
            return False
        if e.members:
            return True
        if e.measure:
            return amount(e.measure[0])[1]
        if e.wh == "how_many":
            return True
        if e.pron:
            return e.pron in ("we", "they")
        q = e.quant
        return (e.plural or (isinstance(q, int) and q != 1) or q in PLURAL_Q
                or (isinstance(q, tuple) and q[0] in CMP_WORDS))

    def person(self, x):
        e = self.kb.ents.get(x)
        if e and e.pron:
            return {"i": 1, "we": 1, "you": 2}.get(e.pron, 3)
        return 3

    def is_human(self, x) -> bool:
        e = self.kb.ents.get(x)
        if e and e.members:
            return any(self.is_human(m) for m in e.members)
        return bool(e and (e.name or e.pron in ("i", "you", "he", "she", "we") or any(i in PERSON_NOUNS for i in e.inst)))

    def wh_word(self, x) -> str:
        e = self.kb.ents[x]
        w = e.wh
        noun = e.inst[0] if e.inst else None
        if w == "which" and noun:
            return "which " + (inflect(noun, "NNS") if self.is_plural(x) else _words(noun))
        if w == "how_many":
            return "how many " + (inflect(noun, "NNS") if noun else "")
        if w == "how_much":
            return "how much " + (_words(noun) if noun else "")
        if w in ("who", "what"):
            return "who" if (w == "who" or self.is_human(x)) and not (w == "what") else "what"
        return w.replace("_", " ")

    def np(self, x, case="subj", gap=None) -> str:
        if x == gap:
            return ""
        if isinstance(x, (list, tuple)):
            return _adj(x)
        if x in self.kb.evs:  # a nominalised event used as an argument
            self.rendered.add(x)
            return self.clause(x, mode="gerund", gap=gap)
        if x not in self.kb.ents:  # atom (adverb, adjective, ...)
            return _adj(x)
        e = self.kb.ents[x]
        self.depth += 1
        if self.depth > 8:
            self.depth -= 1
            return "it"
        try:
            focus = " ".join(_words(f) for f in e.focus)
            s = self._np_core(x, e, case, gap)
            return f"{focus} {s}".strip()
        finally:
            self.depth -= 1

    def _np_core(self, x, e, case, gap) -> str:
        if e.wh:
            return self.wh_word(x) if e.wh not in ADVERB_WH else ""
        if e.members:
            parts = [self.np(m, case, gap) for m in e.members]
            parts = [p for p in parts if p]
            self.mentioned.add(x)
            return parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]
        if e.measure:
            n, unit = e.measure
            txt, pl = amount(n, words=False)
            uparts = str(unit).split("_")
            if pl:
                uparts[0] = inflect(uparts[0], "NNS")
            u = " ".join(CAPITALISED_UNITS.get(w, w) for w in uparts)
            s = f"{txt} {u}"
            if e.inst:  # an amount OF something: "30 days' written notice"
                s = " ".join([s + ("'" if s.endswith("s") else "'s"), *[_adj(p) for p in e.props], _words(e.inst[0])])
            if e.rate:
                s += f" per {_words(e.rate)}"
            for r, y in e.rels:
                s += f" {_words(r)} {self.np(y, 'obj')}"
            self.mentioned.add(x)
            return s
        first = x not in self.mentioned
        if e.pron and (not (e.inst or e.name) or not first):
            self.mentioned.add(x)
            return PRON[e.pron][0 if case == "subj" else 1]
        self.mentioned.add(x)
        plural = self.is_plural(x)
        poss = [y for r, y in e.rels if r == "poss"]
        pps = [(r, y) for r, y in e.rels if r != "poss"]
        mods = [_adj(p) for p in e.props]
        if e.name:
            head, det = e.name, ""
        else:
            noun = e.inst[0] if e.inst else "thing"
            head = inflect(noun, "NNS") if plural else _words(noun)
            q = e.quant
            if x in self.det_override and first:
                det = self.det_override[x]
                if det in ("no",) and not plural and e.quant in ("all",):
                    head = inflect(noun, "NNS")
            elif poss:
                y = poss[0]
                ye = self.kb.ents.get(y)
                if ye and ye.pron:
                    det = PRON[ye.pron][2]
                else:
                    owner = self.np(y, "obj")
                    det = owner + ("'" if owner.endswith("s") and self.is_plural(y) else "'s")
            elif q is None:
                det = ("" if plural else "a") if first else "the"
            elif isinstance(q, (int, float)) or (isinstance(q, tuple) and q[0] in CMP_WORDS):
                det = amount(q)[0] if first else "the"
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

    # ---- verb group
    def _chain(self, ev: Ev, form: str, cf_role: str | None):
        tense, aspect, modal = ev.tense, ev.aspect, ev.modal
        if ev.cf:
            if cf_role == "antecedent":
                if tense == "past":
                    aspect = "perfect" if aspect is None else aspect
                tense = "past"
                modal = None if modal == "would" else modal
            else:
                modal = modal or "would"
                if tense == "past":
                    aspect = "perfect" if aspect is None else aspect
        chain = []
        if modal:
            chain.append((modal, "modal"))
        elif tense == "future" and form == "finite":
            chain.append(("will", "modal"))
        if aspect in ("perfect", "perfect_progressive"):
            chain.append(("have", "perf"))
        if aspect in ("progressive", "perfect_progressive"):
            chain.append(("be", "prog"))
        if ev.passive:
            chain.append(("be", "pass"))
        chain.append((ev.verb, "main"))
        return chain, tense

    def verb_group(self, ev: Ev, subj, form="finite", question=False, cf_role=None, eid=None) -> list[str]:
        chain, tense = self._chain(ev, form, cf_role)
        subjunctive_were = ev.cf and cf_role == "antecedent" and ev.tense != "past" and chain[0][0] == "be"
        out, prev = [], None
        for i, (lem, kind) in enumerate(chain):
            if kind == "modal":
                w = lem
            elif form == "gerund" and i == 0:
                w = inflect(lem, "VBG")
            elif prev == "modal" or (i == 0 and form in ("inf", "imp")):
                w = _words(lem) if lem != "be" else "be"
            elif prev in ("perf", "pass"):
                w = inflect(lem, "VBN")
            elif prev == "prog":
                w = inflect(lem, "VBG")
            elif subjunctive_were and i == 0:
                w = "were"
            else:
                w = self.finite(lem, tense, subj)
            out.append(w)
            prev = kind
        neg = ev.neg and eid not in self.neg_suppressed
        adverbs = [_words(f) for f in ev.focus]
        if ev.freq:
            adverbs.append(ev.freq)
        simple = len(chain) == 1 and chain[0][0] != "be"
        if form in ("finite",) and (question or neg) and simple:  # do-support
            do = self.finite("do", tense, subj)
            out = [do, _words(ev.verb)]
        if form == "imp" and neg:
            out = ["do", "not"] + out
        elif neg:
            if form == "inf":
                out = ["not"] + out
            elif form == "gerund":
                out = ["not"] + out
            else:
                out.insert(1, "not")
        if adverbs:
            # adverbs go after the first auxiliary (or before a simple main verb)
            pos = 0 if (simple and not (question or neg)) or form in ("inf", "imp", "gerund") else 1
            if neg and pos == 1:
                pos = 2
            out[pos:pos] = adverbs
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
        if isinstance(a, (tuple, list)):
            return _adj(a)
        if a in self.kb.evs:
            self.rendered.add(a)
            return self.clause(a, mode="gerund", gap=gap)
        return self.np(a, case, gap)

    def clause(self, e, gap=None, mode="decl", cf_role=None) -> str:
        """mode: decl | question | embedded_q | imp | inf | gerund"""
        ev = self.kb.evs[e]
        self.rendered.add(e)
        form = {"decl": "finite", "question": "finite", "embedded_q": "finite", "imp": "imp",
                "inf": "inf", "gerund": "gerund"}[mode]
        if cf_role is None and e in self.cf_antecedent:
            cf_role = "antecedent"
        rd = defaultdict(list)
        for r, a in ev.roles:
            rd[r].append(a)
        used = set()

        def take(r):
            v = rd.get(r)
            if v:
                used.add(r)
                return v[0]
            return None

        subj = None
        if ev.verb == "exist":
            th = take("theme") or take("agent") or take("patient")
            vg = self.verb_group(Ev("be", [], ev.tense, ev.aspect, ev.modal, ev.neg and e not in self.neg_suppressed,
                                    freq=ev.freq, cf=ev.cf, focus=ev.focus), th, form, mode == "question", cf_role)
            subj_s, vg = "there", vg
            subj = th
            post_first = [self.arg(th, "subj", gap)] if th else ["something"]
        else:
            order = ["patient", "theme", "recipient", "stimulus", "agent"] if ev.passive else SUBJ_ORDER
            if mode == "gerund":
                for r in ("agent", "experiencer"):
                    if rd.get(r):
                        subj = take(r)
                        break
            elif mode not in ("inf", "imp"):
                for r in order:
                    if rd.get(r):
                        subj = take(r)
                        break
            elif mode == "imp":  # the addressee is the understood subject
                for r in order:
                    if rd.get(r):
                        cand = rd[r][0]
                        ce = self.kb.ents.get(cand) if isinstance(cand, str) else None
                        if ce and ce.pron == "you":
                            subj = take(r)
                        break
            invert = mode == "question" and not (gap is not None and subj == gap)
            vg = self.verb_group(ev, subj, form, invert, cf_role, eid=e)
            if mode in ("inf", "imp") or (mode == "gerund" and subj is None):
                subj_s = ""
            elif subj is not None and subj == gap:
                subj_s = ""
            else:
                subj_s = self.arg(subj, "subj", gap) if subj is not None else ("" if mode == "gerund" else "something")
            post_first = []
        if mode == "inf":
            vg = (["not", "to"] + vg[1:]) if vg and vg[0] == "not" else ["to"] + vg
        post = list(post_first)
        if ev.verb == "be":
            for a in rd.get("attribute", []):
                post.append(self.attribute(a, rd, gap))
            used |= {"attribute", "standard"}
        elif ev.verb != "exist":
            objs = [r for r in OBJ_ORDER if rd.get(r) and r not in used]
            if rd.get("recipient") and "recipient" not in used and not objs:
                post.append(self.arg(take("recipient"), "obj", gap))
            for r in objs:
                for a in rd[r]:
                    post.append(self.arg(a, "obj", gap))
                used.add(r)
            if ev.passive and rd.get("agent") and "agent" not in used:
                ag = take("agent")
                post.append("by " + self.arg(ag, "obj", gap) if ag != gap else "by")
            for a in rd.get("attribute", []):
                post.append(self.attribute(a, rd, gap))
            used.add("attribute")
        for r, a in ev.roles:
            if r in used or r == "attribute":
                continue
            post.append(self.adjunct(r, a, subj, gap))
        post = [p for p in post if p]

        whp = None
        if gap is not None and gap in self.kb.ents and self.kb.ents[gap].wh and mode in ("question", "embedded_q"):
            whp = self.wh_word(gap)
        if mode == "question":
            if whp is not None and subj == gap:
                words = [whp, *vg, *post]
            elif whp is not None:
                words = [whp, vg[0], subj_s, *vg[1:], *post]
            else:
                words = [vg[0], subj_s, *vg[1:], *post]
        elif mode == "embedded_q":
            if whp is not None:
                words = [whp, *([] if subj == gap else [subj_s]), *vg, *post]
            else:
                words = ["whether", subj_s, *vg, *post]
        else:
            words = [subj_s, *vg, *post]
        return " ".join(w for w in words if w)

    def attribute(self, a, rd, gap=None) -> str:
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
            return self.np(a, "obj", gap)
        return _adj(a) + than

    def adjunct(self, r, a, subj, gap) -> str:
        if a == gap and gap is not None:
            g = self.kb.ents.get(gap)
            if g and g.wh in ADVERB_WH:
                return ""
            if isinstance(r, tuple) and r[0] == "pp":
                return _words(r[1])
            return ROLE_PREP.get(r, "")
        if isinstance(r, tuple) and r[0] == "pp":
            return f"{_words(r[1])} {self.arg(a, 'obj', gap)}"
        if r == "content":
            if a in self.kb.evs:
                self.rendered.add(a)
                w = self.kb.wh_in(a)
                if w is not None:
                    return self.clause(a, gap=w, mode="embedded_q")
                return "that " + self.clause(a, gap=gap)
            return self.arg(a, "obj", gap)
        if r == "purpose":
            if a in self.kb.evs:
                sub = self.kb.evs[a]
                ag = [x for rr, x in sub.roles if rr in SUBJ_ORDER]
                if ag and ag[0] == subj:
                    self.rendered.add(a)
                    return "in order " + self._inf(a, drop=subj)
                self.rendered.add(a)
                return "so that " + self.clause(a)
            return "for " + self.arg(a, "obj", gap)
        if r == "cause":
            if a in self.kb.evs:
                self.rendered.add(a)
                return "because " + self.clause(a, gap=gap)
            return "because of " + self.arg(a, "obj", gap)
        if r in ("manner",) or (r in ("time", "location") and a not in self.kb.ents):
            return _adj(a)
        prep = ROLE_PREP.get(r, "")
        return f"{prep} {self.arg(a, 'obj', gap)}".strip()

    def _inf(self, e, drop=None, mode="inf") -> str:
        ev = self.kb.evs[e]
        self.rendered.add(e)
        roles = [(r, a) for r, a in ev.roles if a != drop or r not in SUBJ_ORDER]
        sub = Ev(ev.verb, roles, ev.tense, ev.aspect, None, ev.neg, ev.passive, focus=ev.focus, freq=ev.freq)
        tmp = "__inf__%d" % self.depth
        self.kb.evs[tmp] = sub
        try:
            self.depth += 1
            s = self.clause(tmp, mode=mode)
        finally:
            self.depth -= 1
            del self.kb.evs[tmp]
        return s

    # ---- discourse
    def sentence(self, e) -> str:
        wide = self.wide_indefinite(e)
        if wide is not None and wide not in self.mentioned:
            th = self.kb.ents[wide]
            pl = self.is_plural(wide)
            self.mentioned.add(wide)
            q = th.quant
            det = amount(q)[0] if isinstance(q, (int, float)) else ("some" if pl else "a")
            noun = th.inst[0] if th.inst else "thing"
            head = inflect(noun, "NNS") if pl else _words(noun)
            mods = " ".join(_adj(p) for p in th.props)
            npx = " ".join(w for w in [det, mods, head] if w)
            if npx.startswith("a ") and npx[2:3] in "aeiou":
                npx = "an " + npx[2:]
            rp = "who" if self.is_human(wide) else "that"
            s = f"there {'are' if pl else 'is'} {npx} {rp} {self.clause(e, gap=wide)}"
        else:
            s = self.clause(e)
        for (a, c, b) in self.kb.links:
            if a == e and b in self.kb.evs and b not in self.rendered:
                if c == "so":
                    s += f", so {self.sentence(b)}"
                elif c == "instead_of":
                    main_subj = next((x for r, x in self.kb.evs[e].roles if r in ("agent", "experiencer")), None)
                    s += f" instead of {self._inf(b, drop=main_subj, mode='gerund')}"
                else:
                    s += f" {_words(c)} {self.sentence(b)}"
        return s

    def render_act(self, aid) -> str:
        act = self.kb.acts[aid]
        c = act.content
        if c not in self.kb.evs:
            return {"thank": "Thank you.", "apologize": "I apologize.", "greet": "Hello."}.get(act.type, "")
        self.rendered.add(c)
        sp = act.speaker
        ad = act.addressee
        spe = self.kb.ents.get(sp) if sp else None
        ade = self.kb.ents.get(ad) if ad else None
        reported = (sp is not None and not (spe and spe.pron == "i")) or (ad is not None and not (ade and ade.pron == "you")) \
            or act.tense is not None
        ev = self.kb.evs[c]
        ag = next((a for r, a in ev.roles if r in ("agent", "experiencer")), None)
        age = self.kb.ents.get(ag) if isinstance(ag, str) else None
        if reported:
            spk = self.np(sp, "subj") if sp else "someone"
            verb = self.finite(ACT_VERB[act.type], act.tense or "present", sp)
            adr = self.np(ad, "obj") if ad else ""
            if act.type == "ask":
                w = self.kb.wh_in(c)
                return _cap(f"{spk} {verb} {adr} {self.clause(c, gap=w, mode='embedded_q')}".replace("  ", " ")) + "."
            if act.type in ("request", "command", "permit"):
                inf = self._inf(c, drop=ag if (ag == ad or (age and age.pron == "you")) else None)
                return _cap(f"{spk} {verb} {adr} {inf}".replace("  ", " ")) + "."
            if act.type in ("thank", "apologize"):
                to = f"to {adr} " if act.type == "apologize" and adr else (f"{adr} " if adr else "")
                return _cap(f"{spk} {verb} {to}for {self.clause(c, mode='gerund')}") + "."
            if act.type == "offer":
                return _cap(f"{spk} {verb} {self._inf(c, drop=ag)}") + "."
            return _cap(f"{spk} {verb} {(adr + ' ') if act.type == 'warn' and adr else ''}that {self.clause(c)}") + "."
        # direct speech acts
        if act.type == "ask":
            w = self.kb.wh_in(c)
            return _cap(self.clause(c, gap=w, mode="question")) + "?"
        if act.type in ("request", "command"):
            if age and age.pron == "i":
                return _cap(("please " if act.type == "request" else "") + "let me " + self._inf(c, drop=ag, mode="imp")) + "."
            if age and age.pron == "we":
                return _cap(("please " if act.type == "request" else "") + "let's " + self._inf(c, drop=ag, mode="imp")) + "."
            body = self.clause(c, mode="imp")
            return _cap(("please " if act.type == "request" else "") + body) + ("." if act.type == "request" else "!")
        if act.type == "suggest":
            if age and age.pron == "we":
                return _cap("let's " + self._inf(c, drop=ag, mode="imp")) + "."
            return _cap("I suggest that " + self.clause(c)) + "."
        if act.type == "offer":
            return _cap("I offer " + self._inf(c, drop=ag)) + "."
        if act.type == "promise":
            return _cap("I promise that " + self.clause(c)) + "."
        if act.type == "warn":
            return _cap("I warn you that " + self.clause(c)) + "."
        if act.type == "thank":
            return _cap("thank you for " + self._inf(c, drop=ag if age and age.pron == "you" else None, mode="gerund")) + "."
        if act.type == "apologize":
            return _cap("I apologize for " + self._inf(c, drop=ag if age and age.pron == "i" else None, mode="gerund")) + "."
        if act.type == "permit":
            return _cap(self._inf(c, drop=ag, mode="imp").join(["you may ", ""])) + "."
        return _cap(self.clause(c)) + "."

    def render(self) -> str:
        dependent = set()
        for ev in self.kb.evs.values():
            for r, a in ev.roles:
                if isinstance(a, str) and a in self.kb.evs:
                    dependent.add(a)
        for ent in self.kb.ents.values():
            dependent |= set(ent.restrict)
        dependent |= {b for (_, _, b) in self.kb.links}
        act_contents = {a.content for a in self.kb.acts.values()}
        out = []
        order = [x for x in self.kb.order if x in self.kb.acts or x not in dependent] + \
                [x for x in self.kb.order if x in self.kb.evs and x in dependent]
        for x in order:
            if x in self.kb.acts:
                s = self.render_act(x)
                if s:
                    out.append(s)
                continue
            if x in self.rendered or x in act_contents:
                continue
            s = self.sentence(x)
            out.append(_cap(s) + ".")
        return " ".join(out)


def english(code_or_facts) -> str:
    facts = load(code_or_facts).facts if isinstance(code_or_facts, str) else code_or_facts
    return English(KB(facts)).render()


# --------------------------------------------------------------------- FOL semantics
def fol(code_or_facts) -> str:
    """A second, independent interpretation: neo-Davidsonian first-order logic (scope-aware)."""
    facts = load(code_or_facts).facts if isinstance(code_or_facts, str) else code_or_facts
    kb = KB(facts)

    def arg(a):
        return a if isinstance(a, str) else _adj(a).replace(" ", "_")

    def ev_atoms(e, negate=True):
        ev = kb.evs[e]
        atoms = [f"{ev.verb}({e})"] + [f"{r if isinstance(r, str) else r[1]}({e},{arg(a)})" for r, a in ev.roles]
        if ev.tense != "present":
            atoms.append(f"{ev.tense}({e})")
        body = " ∧ ".join(atoms)
        if ev.modal:
            body = f"{ev.modal.upper()}[{body}]"
        op = "GEN" if ev.generic else "∃"
        body = f"{op}{e}({body})"
        if ev.freq:
            body = f"{ev.freq.upper()}({body})"
        if ev.cf:
            body = f"CF({body})"
        return f"¬{body}" if ev.neg and negate else body

    def ent_atoms(x):
        e = kb.ents[x]
        at = [f"{c}({x})" for c in e.inst] + [f"{_adj(p).replace(' ', '_')}({x})" for p in e.props]
        if e.name:
            at.append(f"{x}={e.name}")
        if e.members:
            at.append(f"{x}={'⊕'.join(e.members)}")
        if e.measure:
            at.append(f"amount({x},{arg(e.measure[0])},{e.measure[1]})")
        at += [f"{r}({x},{y})" for r, y in e.rels]
        return at or [f"thing({x})"]

    q_of = {x: e.quant for x, e in kb.ents.items()}
    univ = [x for x, q in q_of.items() if q in UNIVERSAL_Q]
    whs = [x for x, e in kb.ents.items() if e.wh]
    neg_wide = {a[1]: b for a, b in kb.scopes if isinstance(a, tuple) and a[0] == "neg"}
    # order universals: scope(a,b) means a outscopes b
    order = list(univ)
    for a, b in kb.scopes:
        if isinstance(a, str) and isinstance(b, str) and a in order and b in order:
            order.remove(a)
            order.insert(order.index(b), a)
    exist = [x for x in kb.ents if x not in univ and x not in whs]
    wide_exist = [a for a, b in kb.scopes if isinstance(a, str) and a in exist and isinstance(b, str) and b in univ]
    events = [ev_atoms(e, negate=e not in neg_wide) for e in kb.evs]
    links = [f"{c}({a},{b})" for a, c, b in kb.links]
    scope = " ∧ ".join([a for x in exist if x not in wide_exist for a in ent_atoms(x)] + events + links)
    inner_exist = [x for x in exist if x not in wide_exist]
    if inner_exist:
        scope = "∃" + ",".join(inner_exist) + "(" + scope + ")"
    for x in reversed(order):
        scope = f"∀{x}({' ∧ '.join(ent_atoms(x))} → {scope})"
    for e, x in neg_wide.items():
        scope = f"¬({scope})"
    for x in wide_exist:
        scope = f"∃{x}({' ∧ '.join(ent_atoms(x))} ∧ {scope})"
    for x in whs:
        scope = f"λ{x}.({scope})"
    for a, act in kb.acts.items():
        scope = f"{act.type.upper()}({scope})"
    return scope
