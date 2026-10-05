// Regression tests for intentional divergences from the native EVL port.
import { test } from "node:test";
import assert from "node:assert/strict";
import strategy, { ask, check, fol } from "../index.mjs";
import { freeVariables } from "../src/fol.mjs";

test("embedded content, conditionals and acts are nested, not asserted (H6)", () => {
  const belief = fol("name(x1,'Tom'). event(e1,believe). role(e1,agent,x1). role(e1,content,e2). inst(x2,earth). quant(x2,the). event(e2,be). role(e2,theme,x2). role(e2,attribute,flat).");
  assert.equal(belief, "∃x1(x1=Tom ∧ ∃e1(believe(e1) ∧ agent(e1,x1) ∧ content(e1,⟦∃x2(earth(x2) ∧ ∃e2(be(e2) ∧ theme(e2,x2) ∧ attribute(e2,flat)))⟧)))");
  const cond = fol("inst(x1,dog). quant(x1,a). event(e1,bark). role(e1,agent,x1). name(x2,'Ana'). event(e2,leave). role(e2,agent,x2). link(e2,if,e1).");
  assert.equal(cond, "∃x2(x2=Ana ∧ (∃x1(dog(x1) ∧ ∃e1(bark(e1) ∧ agent(e1,x1))) → ∃e2(leave(e2) ∧ agent(e2,x2))))");
  const q = fol("name(x1,'Ana'). event(e1,leave). role(e1,agent,x1). act(a1,ask,e1).");
  assert.equal(q, "ASK(∃x1(x1=Ana ∧ ∃e1(leave(e1) ∧ agent(e1,x1))))");
  const mixed = fol("name(x1,'Ana'). event(e1,leave). role(e1,agent,x1). name(x2,'Bob'). event(e2,stay). role(e2,agent,x2). act(a1,ask,e2).");
  assert.match(mixed, /^∃x1\(x1=Ana ∧ ∃e1\(leave.*ASK\(∃x2\(x2=Bob/);
  for (const f of [belief, cond, q, mixed]) assert.deepEqual(freeVariables(f), []);
  assert.deepEqual(freeVariables("∃x1(p(x1) ∧ q(x2))"), ["x2"]);
});

test("QA respects modality, tense, frequency and quantified participants (H5)", () => {
  const ctx = "name(x1,'Mary'). event(e1,swim). role(e1,agent,x1). freq(e1,never). name(x2,'Bob'). event(e2,swim). role(e2,agent,x2). modal(e2,can). name(x3,'Ana'). event(e3,leave). tense(e3,past). role(e3,agent,x3). name(x4,'Eve'). event(e4,sing). freq(e4,sometimes). role(e4,agent,x4).";
  const q = (body) => ask(ctx, `${body} act(a1,ask,e1).`).answer;
  assert.equal(q("name(x1,'Mary'). event(e1,swim). role(e1,agent,x1)."), "no");
  assert.equal(q("name(x1,'Bob'). event(e1,swim). role(e1,agent,x1)."), "unknown");
  assert.equal(q("name(x1,'Bob'). event(e1,swim). modal(e1,can). role(e1,agent,x1)."), "yes");
  assert.equal(q("name(x1,'Ana'). event(e1,leave). tense(e1,future). role(e1,agent,x1)."), "unknown");
  assert.equal(q("name(x1,'Ana'). event(e1,leave). tense(e1,past). role(e1,agent,x1)."), "yes");
  assert.equal(q("name(x1,'Eve'). event(e1,sing). role(e1,agent,x1)."), "unknown");
  const none = "inst(x1,student). quant(x1,no). event(e1,pass). tense(e1,past). role(e1,agent,x1).";
  assert.equal(ask(none, "inst(x1,student). event(e1,pass). tense(e1,past). role(e1,agent,x1). act(a1,ask,e1).").answer, "no");
});

test("negation scoped over an unquantified entity is not dropped (M7)", () => {
  assert.equal(strategy.toCNL("name(x1,'Mary'). event(e1,leave). role(e1,agent,x1). neg(e1). scope(neg(e1),x1)."), "Mary does not leave.");
  assert.equal(strategy.toCNL("inst(x1,child). quant(x1,every). event(e1,like). role(e1,agent,x1). neg(e1). scope(neg(e1),x1)."), "Not every child likes.");
});

test("need not: modal need and negation over the modal", () => {
  assert.equal(check("pron(x1,you). event(e1,come). modal(e1,need). neg(e1). role(e1,agent,x1). scope(neg(e1),modal).").ok, true);
  assert.equal(strategy.toCNL("pron(x1,you). event(e1,come). modal(e1,must). neg(e1). role(e1,agent,x1). scope(neg(e1),modal)."), "You need not come.");
  assert.match(fol("pron(x1,you). event(e1,come). modal(e1,must). neg(e1). role(e1,agent,x1). scope(neg(e1),modal)."), /¬∃e1\(MUST\[/);
  assert.match(fol("pron(x1,you). event(e1,come). modal(e1,must). neg(e1). role(e1,agent,x1)."), /MUST\[¬∃e1\(/);
  assert.equal(check("pron(x1,you). event(e1,come). role(e1,agent,x1). scope(neg(e1),modal).").ok, false);
});

test("names are short proper names and lemmas obey the 3-word rule (M6)", () => {
  assert.equal(check("name(x1,'Ada Lovelace'). event(e1,leave). role(e1,agent,x1).").ok, true);
  assert.equal(check("name(x1,'the woman who owns the lab'). event(e1,leave). role(e1,agent,x1).").ok, false);
  assert.equal(check("name(x1,'Ada Augusta King Lovelace'). event(e1,leave). role(e1,agent,x1).").ok, false);
  assert.equal(check("inst(x1,email). event(e1,keepImportantEmailsInInbox). role(e1,theme,x1).").ok, false);
  assert.equal(check("inst(x1,email). event(e1,ignoreLastMessage). role(e1,theme,x1).").ok, true);
  const symbols = strategy.symbols("inst(x1,email). event(e1,keep_important_emails_in_inbox). role(e1,theme,x1).");
  assert.ok(symbols.some((s) => s.name === "keep_important_emails_in_inbox"));
  assert.ok(!symbols.some((s) => s.name === "x1" || s.name === "e1"), "ids are not symbols");
});
