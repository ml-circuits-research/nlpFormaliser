"""Equivalence judges.

* `loop_judge`  – the small/cheap judge used *inside* the refinement loop (Haiku).
* `eval_judge`  – an independent, differently-prompted, stronger judge used only for
                  the final evaluation, so the loop cannot overfit the metric it is scored on.
"""
from __future__ import annotations

from .llm import HAIKU, SONNET, complete, extract_json

LOOP_SYSTEM = """You compare two English texts for MEANING EQUIVALENCE (truth conditions), as a strict logician.
Text A is the original. Text B was produced mechanically from a formal representation of A, so B may be
clumsy, repetitive or unidiomatic — IGNORE style, fluency, word order, repetition of names instead of pronouns,
and synonyms with the same meaning.
Check carefully, in both directions (A entails B and B entails A):
entities and their properties, who-did-what-to-whom (roles), negation and its scope, quantifiers
(every/some/most/no/only/numbers), tense and aspect, modality (must/may/can/might), attitudes (believe/say/want),
conditionals, causal/temporal/contrast relations, comparatives, definiteness that changes meaning.
If A is not a plain statement (a question, request, command, suggestion, offer, promise, warning, thanks...),
B must perform the SAME speech act and ask/request exactly the same thing (for questions: the same information
is requested — same wh-item or the same yes/no proposition). A question is never equivalent to a statement,
and an indirect request ("Could you open the door?") is equivalent to a direct one ("Please open the door.").
Answer with JSON only:
{"equivalent": true|false, "differences": ["<concise description of each meaning difference, saying what B is missing, adds or distorts>"]}
"equivalent" is true only if there is no meaning difference that a careful reader would care about."""


def loop_judge(original: str, candidate: str, model: str = HAIKU) -> dict:
    prompt = f"Text A (original):\n{original}\n\nText B (reconstruction):\n{candidate}"
    try:
        d = extract_json(complete(prompt, LOOP_SYSTEM, model=model))
        d["equivalent"] = bool(d.get("equivalent"))
        d.setdefault("differences", [])
        return d
    except Exception as e:  # noqa: BLE001
        return {"equivalent": False, "differences": [f"judge error: {e}"]}


EVAL_SYSTEM = """You are an expert annotator in formal semantics. You will see an ORIGINAL sentence/text and a
RECONSTRUCTION that was generated back from a machine-built logical form of the original.
Decide how much of the original's literal meaning survived. Do not reward or punish style; only content.
Labels:
- "equivalent": same truth conditions; a reader learns exactly the same facts.
- "minor": almost the same; a small nuance is lost or added (e.g. definiteness, an adverb, a weak implicature).
- "major": a fact, participant, negation, quantifier, number, modality, tense or relation is missing, wrong or added.
For questions/requests/commands etc. the reconstruction must perform the same speech act and ask/request the same
thing (an indirect request like "Could you open the door?" = "Please open the door."); a different speech act or a
different requested item is "major".
Reply with JSON only: {"label": "equivalent"|"minor"|"major", "reason": "<one sentence>"}"""


def eval_judge(original: str, candidate: str, model: str = SONNET) -> dict:
    prompt = f"ORIGINAL:\n{original}\n\nRECONSTRUCTION:\n{candidate}"
    try:
        d = extract_json(complete(prompt, EVAL_SYSTEM, model=model))
        if d.get("label") not in ("equivalent", "minor", "major"):
            d["label"] = "major"
        return d
    except Exception as e:  # noqa: BLE001
        return {"label": "major", "reason": f"judge error: {e}"}


QA_SYSTEM = """You grade answers to reading-comprehension questions. You get the CONTEXT, the QUESTION, the GOLD answer
and a SYSTEM answer. The system answer is correct if it gives the same answer as the gold one (same entity/value, same
yes/no/unknown polarity). Wording, articles and extra detail do not matter. "probably yes" counts as correct when the
gold says yes-with-a-hedge ("usually", "most likely"), and as wrong when the gold is a plain yes/no about a definite fact.
"unknown" is correct only if the gold says the text does not settle the question.
Reply with JSON only: {"correct": true|false, "reason": "<short>"}"""


def qa_judge(context: str, question: str, gold: str, predicted: str, model: str = SONNET) -> dict:
    prompt = f"CONTEXT:\n{context}\n\nQUESTION: {question}\nGOLD: {gold}\nSYSTEM: {predicted}"
    try:
        d = extract_json(complete(prompt, QA_SYSTEM, model=model))
        d["correct"] = bool(d.get("correct"))
        return d
    except Exception as e:  # noqa: BLE001
        return {"correct": False, "reason": f"judge error: {e}"}
