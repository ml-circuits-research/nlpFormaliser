"""Formalisation back-ends.

Each back-end knows how to
  * ask an LLM for a first formalisation of a text (`formalize`)
  * validate a formalisation symbolically (`check`)      -> list of error strings
  * "execute" a formalisation back into English (`realize`)
  * ask an LLM to repair a formalisation given feedback (`refine`)
"""
from __future__ import annotations

import os
import re
import subprocess
import threading

from .llm import HAIKU, complete, extract_block

REFINE_TMPL = """ORIGINAL TEXT:
{text}

YOUR CURRENT FORMALISATION:
```{lang}
{code}
```
{feedback}
Rewrite the formalisation so that, when executed, it expresses EXACTLY the meaning of the original text —
nothing missing, nothing added, nothing distorted. Fix every problem listed above.
Output the complete corrected formalisation in a single ```{lang} block."""


def _feedback(errors, realization, differences) -> str:
    parts = []
    if errors:
        parts.append("VALIDATION ERRORS (the formalisation is rejected by the checker):\n- " + "\n- ".join(errors[:15]))
    if realization is not None:
        parts.append(f"WHAT YOUR FORMALISATION SAYS WHEN EXECUTED BACK INTO ENGLISH (deterministic interpreter):\n{realization}")
    if differences:
        parts.append("MEANING DIFFERENCES FOUND BY THE JUDGE (original vs execution):\n- " + "\n- ".join(differences))
    return "\n\n".join(parts) + "\n"


class Backend:
    name = "base"
    lang = "text"
    system = ""
    model = HAIKU

    def formalize(self, text: str) -> str:
        out = complete(f"Formalise this text:\n\n{text}", self.system, model=self.model)
        return extract_block(out)

    def refine(self, text, code, errors, realization, differences) -> str:
        prompt = REFINE_TMPL.format(text=text, code=code, lang=self.lang,
                                    feedback=_feedback(errors, realization, differences))
        return extract_block(complete(prompt, self.system, model=self.model))

    def check(self, code: str) -> list[str]:
        return []

    def realize(self, code: str) -> str:
        raise NotImplementedError


# ------------------------------------------------------------------ EVL / Prolog
class EVLBackend(Backend):
    """LLM -> Prolog event-logic facts -> SWI-Prolog checker -> rule-based English."""
    name = "evl_prolog"
    lang = "prolog"

    def __init__(self):
        from . import evl
        self.evl = evl
        self.system = ("You formalise English text into EVL, a Prolog fact language with a fixed set of "
                       "structural primitives. Its full specification follows.\n\n" + evl.SPEC +
                       "\n\nRules: output ONLY one ```prolog block of ground facts. Capture ALL of the meaning "
                       "(every participant, event, property, negation, quantifier, number, tense, modality, "
                       "relation between events). Only the listed predicates are interpreted; content put "
                       "elsewhere is lost. Concepts must be single lemmas, never phrases.")

    def check(self, code):
        r = self.evl.load(code)
        return r.errors + [w for w in r.warnings if "unknown predicate" in w]

    def realize(self, code):
        return self.evl.english(code)


class EVLLLMRealizerBackend(EVLBackend):
    """Control condition: same EVL formalisation, but an LLM (not the interpreter) turns it into English.
    Shows how much an LLM verbaliser silently 'repairs' an incomplete formalisation."""
    name = "evl_prolog_llm_realizer"

    def realize(self, code):
        sys = ("You translate EVL Prolog facts into English. Express exactly what the facts state — do not add "
               "anything that is not encoded. Output only the English text.\n\n" + self.evl.SPEC)
        return complete(f"```prolog\n{code}\n```", sys, model=self.model).strip()


# ------------------------------------------------------------------ AMR
_AMR_LOCK = threading.Lock()
_GTOS = None
AMR_GEN_DIR = os.environ.get("AMR_GEN_DIR", "/opt/dl/amr/model_generate_t5wtense-v0_1_0")
T5_TOK_DIR = os.environ.get("T5_TOK_DIR", "/opt/dl/t5tok_full")


def _gtos():
    global _GTOS
    if _GTOS is None:
        import amrlib
        _GTOS = amrlib.load_gtos_model(AMR_GEN_DIR, tok_name_or_path=T5_TOK_DIR, device="cpu")
    return _GTOS


class AMRBackend(Backend):
    """LLM -> AMR (PENMAN, PropBank frames) -> penman validation -> amrlib T5 graph-to-text generator."""
    name = "amr"
    lang = "amr"
    system = ("You are an expert AMR (Abstract Meaning Representation, AMR 3.0 guidelines) annotator. "
              "Write the AMR graph of the given English text in PENMAN notation, using PropBank framesets "
              "(e.g. give-01), :ARGn roles, :polarity -, :mode, :quant, :time, :condition, :ARG0-of etc. "
              "For several sentences use (m / multi-sentence :snt1 ... :snt2 ...). Encode tense via :time only "
              "where AMR does. Output ONLY one ```amr block containing a single graph.")

    def check(self, code):
        import penman
        try:
            g = penman.decode(code)
        except Exception as e:  # noqa: BLE001
            return [f"PENMAN parse error: {e}"]
        errs = []
        variables = set(g.variables())
        for s, r, t in g.edges():
            if t not in variables:
                errs.append(f"edge {s} {r} {t}: target variable {t} is undefined")
        if not g.instances():
            errs.append("graph has no concepts")
        return errs

    def realize(self, code):
        import penman
        g = penman.encode(penman.decode(code))
        with _AMR_LOCK:
            sents, _ = _gtos().generate([g], disable_progress=True)
        return sents[0]


# ------------------------------------------------------------------ GF RGL
GF_LIB = os.environ.get("GF_LIB_PATH", "/opt/gf-lib")


class GFBackend(Backend):
    """LLM -> Grammatical Framework RGL API tree -> GF type checker -> GF linearisation (English)."""
    name = "gf_rgl"
    lang = "gf"
    system = """You write Grammatical Framework (GF) Resource Grammar Library API expressions (the `Syntax` + `Paradigms`
API, English instance, i.e. modules SyntaxEng and ParadigmsEng) that linearise to a given English text.
Use only the documented RGL API: mkText, mkUtt, mkS, mkCl, mkVP, mkNP, mkCN, mkAP, mkAdv, mkComp, mkRS, mkRCl,
mkQS, mkSC, mkVV, mkV2, mkV3, mkVS, mkV2V, mkN, mkPN, mkA, mkAdA, mkPrep, mkConj, mkListS, comparAP, passiveVP, etc.;
tenses/polarity via mkS (pastTense|presentTense|futureTense|conditionalTense) (anteriorAnt|simultaneousAnt)
(positivePol|negativePol); determiners a_Det, the_Det, aPl_Det, thePl_Det, every_Det, someSg_Det, somePl_Det,
few_Det, many_Det, much_Det, no_Quant, mkDet (mkNumeral "3"); conjunctions and_Conj, or_Conj, but_PConj;
subordinators if_Subj, because_Subj, when_Subj, although_Subj; modals must_VV, can_VV, want_VV; prepositions
in_Prep, on_Prep, with_Prep, to_Prep, for_Prep, from_Prep, by8agent_Prep; pronouns i_Pron, he_Pron, she_Pron,
it_Pron, they_Pron, we_Pron, youSg_Pron; lexical items via ParadigmsEng: mkN "car", mkN "child" "children",
mkV "buy" "bought" "bought", mkV2 (mkV "eat" "ate" "eaten"), mkA "red", mkPN "Mary", mkAdv "yesterday".
Several sentences: mkText (mkText s1) (mkText s2) or mkText (mkPhr (mkUtt s1)) t.
Output ONLY one ```gf block containing a single expression of type Text or Utt or S."""

    def _run(self, expr: str) -> tuple[str, str]:
        script = f'i -retain alltenses/TryEng.gfo\ncc -one {expr}\n'
        env = dict(os.environ, GF_LIB_PATH=GF_LIB)
        p = subprocess.run(["gf", "--run"], input=script, capture_output=True, text=True, timeout=120, env=env)
        return p.stdout.strip(), p.stderr.strip()

    @staticmethod
    def _clean(code: str) -> str:
        return " ".join(code.split())

    def check(self, code):
        out, err = self._run(self._clean(code))
        bad = err or not out or re.search(r"(?im)^(constant not found|.*error|.*not found|.*type of|.*expected)", out)
        if bad:
            return [((err + "\n" + out).strip())[:800]]
        return []

    def realize(self, code):
        out, _ = self._run(self._clean(code))
        return out.splitlines()[-1].strip() if out else ""


BACKENDS = {b.name: b for b in (EVLBackend, EVLLLMRealizerBackend, AMRBackend, GFBackend)}
