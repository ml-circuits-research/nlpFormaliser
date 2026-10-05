// The evaluation judge: did the formalisation lose, add or distort meaning?
// It sees ONLY the original utterance and the CNL produced by executing the formalisation —
// never the formalisation itself, and it is independent of any strategy's internal judge.
import { extractJson } from "./llm.mjs";

export const JUDGE_SYSTEM = `You are an evaluation judge for semantic formalisation.
ORIGINAL is a message that a user could send to a chat assistant or an AI agent.
CNL is a controlled-English text produced mechanically by EXECUTING a formalisation of ORIGINAL. It may be clumsy,
repetitive or unidiomatic: ignore style, fluency, word order, articles that do not change meaning, and synonyms.

Decide whether the formalisation LOST, ADDED or DISTORTED any meaning. Judge the meaning a competent listener takes
from ORIGINAL (idioms and figurative language by their intended meaning). Check in both directions:
- participants and who does what to whom; properties; references (who "she"/"it"/"them" are)
- negation and its scope; quantifiers, numbers, units, amounts, comparisons
- time: dates, durations, tense, aspect, frequency, deadlines
- modality: obligation, permission, possibility, ability; hedges and degrees of certainty
- conditions, exceptions ("unless", "except", "only if"), causal, temporal and contrast relations
- beliefs and reported speech: WHO holds or said the content, and that it is not asserted as fact
- the speech act and what is asked for: a question vs a request vs a command vs a statement; for questions, the
  exact information requested; for requests and instructions, every action, constraint and preference
- corrections in conversation: what is retracted and what replaces it
- emotional or social content when it is the point of the message (thanks, apology, frustration)

Labels:
- "equivalent": nothing that matters was lost, added or changed
- "minor": a nuance was lost or added that would rarely change how an assistant should respond or act
- "major": something was lost, added or changed that could change the answer or the action taken

Reply with JSON only:
{"label": "equivalent"|"minor"|"major", "lost": ["..."], "added": ["..."], "changed": ["..."], "reason": "<one sentence>"}`;

/** @returns {(original:string, cnl:string|null) => Promise<{label, preserved, lost, added, changed, reason}>} */
export function makeJudge(llm) {
  return async (original, cnl) => {
    if (cnl == null || !String(cnl).trim()) {
      return { label: "major", preserved: false, lost: ["everything: no CNL was produced"], added: [], changed: [], reason: "no valid formalisation" };
    }
    try {
      const d = extractJson(await llm(JUDGE_SYSTEM, `ORIGINAL:\n${original}\n\nCNL:\n${cnl}`));
      const label = ["equivalent", "minor", "major"].includes(d.label) ? d.label : "major";
      return { label, preserved: label === "equivalent", lost: d.lost ?? [], added: d.added ?? [], changed: d.changed ?? [], reason: d.reason ?? "" };
    } catch (e) {
      return { label: "major", preserved: false, lost: [], added: [], changed: [], reason: `judge error: ${e.message}` };
    }
  };
}
