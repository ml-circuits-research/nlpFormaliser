import {FormalizationStrategy} from "../strategy.mjs";
import {buildProtoIR, compactProtoIR} from "../protoir.mjs";
import {normalizeIR, validateIR} from "../ir.mjs";
import {extractJsonObject} from "../util.mjs";
import {SYMBOL_RULE_TEXT} from "../../../../tools/lib/symbols.mjs";

// Prompt v2: the original baseline text plus the 3-word symbol rule and explicit
// schemas for queries, contexts, ambiguities and externals (see docs).
export const FORMAL_IR_SPEC = `
Return exactly one JSON object representing Formal IR 0.2.
Required keys: facts, rules. Optional: contexts, queries, externals, ambiguities, symbols, meta.
Atom: {"pred":"snake_case_predicate","args":["entity_or_?variable"],"neg":false}. An atom inside a belief, report, plan or hypothetical adds "context":"c1".
Rule: {"head":ATOM,"body":[ATOM,...]}.
Query: {"vars":["?x"],"where":[ATOM,...]}; an empty vars list asks a yes/no question.
Context: {"id":"c1","kind":"belief","holder":"bob"}. Every atom context must name a declared context id.
Ambiguity: {"id":"a1","options":["short_symbol",...],"description":"free text"}. Description and gloss fields are notes; they are never rendered or reasoned with.
External: {"predicate":"name","roles":["role",...]}.
Use explicit negation only when the source states a negation.
Variables begin with ?. Preserve quantifier/scope distinctions. If the text is genuinely ambiguous, do not silently choose: record an entry in ambiguities.
Do not invent facts. Prefer stable snake_case predicates. Reify events only when needed to preserve roles, time, modality, causality, or attachment.
Each predicate name has one arity. Optional symbols.predicates[p].cnl templates contain {0}, {1}, ... for every argument plus at most 3 other words; labels have at most 3 words.
${SYMBOL_RULE_TEXT}
The IR must preserve the meaning relevant to questions, constraints, instructions, and claims, not the wording.
`;

function parseAndValidate(raw) {
  const obj = typeof raw === "string" ? extractJsonObject(raw) : raw;
  const ir = normalizeIR(obj);
  const v = validateIR(ir);
  if (!v.ok) throw new Error(`Invalid Formal IR: ${v.errors.join("; ")}`);
  return ir;
}

export class DirectLLMStrategy extends FormalizationStrategy {
  constructor({client, name = "direct-llm", includeProto = false} = {}) {
    super(name);
    if (!client) throw new Error("DirectLLMStrategy requires a client");
    this.client = client;
    this.includeProto = includeProto;
  }

  async formalize(text, {proto = buildProtoIR(text)} = {}) {
    const user = [
      "Natural-language source:",
      text,
      this.includeProto ? `\nConservative surface ProtoIR:\n${JSON.stringify(compactProtoIR(proto))}` : "",
      "\nProduce Formal IR."
    ].join("\n");
    const raw = await this.client.complete({system: FORMAL_IR_SPEC, user});
    const ir = parseAndValidate(raw);
    ir.meta = {...ir.meta, strategy: this.name};
    return {ir, proto, artifacts: {rawModelOutput: raw, llm: this.client.lastResponseMeta ?? null}};
  }
}
