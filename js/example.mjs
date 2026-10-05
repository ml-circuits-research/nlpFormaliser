// node js/example.mjs
import { Formaliser, customLoop } from "./nlpformaliser.mjs";

const f = await Formaliser.start();

// 1) deterministic steps only — no LLM involved
const code = `
name(x1, 'Mary'). inst(x2, car). prop(x2, red).
event(e1, buy). tense(e1, past). role(e1, agent, x1). role(e1, theme, x2). role(e1, time, yesterday).`;
console.log(await f.check(code));
console.log(await f.verbalize(code));          // Mary bought a red car yesterday.
console.log(await f.fol(code));

const question = `event(e1, buy). tense(e1, past). role(e1, agent, x1). wh(x1, who).
role(e1, theme, x2). inst(x2, car). act(a1, ask, e1).`;
console.log(await f.verbalize(question));      // Who bought a car?
console.log(await f.ask(code, question));      // { answer: 'Mary', support: [...] }

// 2) your own loop over the separate steps (uses the LLM)
if (process.argv.includes("--llm")) {
  const r = await customLoop(f, "Not every child likes chocolate.", {
    onStep: (s) => console.log(`[${s.round}]`, s.errors?.length ? s.errors : s.realization, s.verdict?.equivalent ?? ""),
  });
  console.log(r);
  console.log(await f.answer("Most birds can fly, but penguins cannot. Pingu is a penguin.", "Can Pingu fly?"));
}
await f.close();
