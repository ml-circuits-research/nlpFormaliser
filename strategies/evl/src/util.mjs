// Small helpers for parsing LLM output.

/** Content of the last fenced code block (or the raw text). */
export function extractBlock(text) {
  const blocks = [...String(text).matchAll(/```(?:[a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g)].map((m) => m[1]);
  return (blocks.length ? blocks.at(-1) : String(text)).trim();
}

/** First JSON object in the text. */
export function extractJson(text) {
  for (const cand of [extractBlock(text), String(text)]) {
    const m = /\{[\s\S]*\}/.exec(cand);
    if (m) { try { return JSON.parse(m[0]); } catch { /* next */ } }
  }
  throw new Error(`no JSON in: ${String(text).slice(0, 200)}`);
}
