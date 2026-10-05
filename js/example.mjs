// node js/example.mjs         (deterministic part only)
// node js/example.mjs --llm   (also runs the LLM loop; needs ANTHROPIC_API_KEY or a logged-in `claude` CLI)
import { Formaliser, ask, check, fol, verbalize } from "./index.mjs";

const code = `
name(x1, 'Mary'). inst(x2, car). prop(x2, red).
event(e1, buy). tense(e1, past). role(e1, agent, x1). role(e1, theme, x2). role(e1, time, yesterday).`;
console.log(check(code).ok, check(code).errors);
console.log(verbalize(code));                       // Mary bought a red car yesterday.
console.log(fol(code));
const question = `event(e1, buy). role(e1, agent, x1). wh(x1, who). role(e1, theme, x2). inst(x2, car). act(a1, ask, e1).`;
console.log(verbalize(question));                   // Who buys a car?
console.log(ask(code, question).answer);            // Mary

if (process.argv.includes("--llm")) {
  const f = new Formaliser();                       // or new Formaliser({ llm: async (system, prompt) => ... })
  const r = await f.roundtrip("Not every child likes chocolate.", {
    onStep: (s) => console.log(`[${s.round}]`, s.errors.length ? s.errors : s.realization, s.verdict?.equivalent ?? ""),
  });
  console.log(r.converged, r.code);
  console.log((await f.answer("Most birds can fly, but penguins cannot. Pingu is a penguin.", "Can Pingu fly?")).answer);
}
