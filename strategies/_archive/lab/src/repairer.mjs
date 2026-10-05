import {buildProtoIR, compactProtoIR} from "./protoir.mjs";
import {normalizeIR, validateIR} from "./ir.mjs";
import {extractJsonObject} from "./util.mjs";
import {FORMAL_IR_SPEC} from "./strategies/direct-llm.mjs";

export class SemanticRepairer {
  constructor({client, includeProto = true} = {}) {
    if (!client) throw new Error("SemanticRepairer requires a client");
    this.client = client;
    this.includeProto = includeProto;
  }

  async repair(text, draftInput, {proto = buildProtoIR(text)} = {}) {
    const draft = normalizeIR(draftInput);
    const system = `${FORMAL_IR_SPEC}\nYou are a semantic program repairer. The original NL is authoritative. The draft is fallible evidence. Preserve every correct item when possible; delete unsupported items; fix wrong roles, polarity, scope and reference; add omitted semantics. If the NL is genuinely ambiguous, preserve the ambiguity rather than guessing.`;
    const user = [
      "Natural-language source:", text,
      this.includeProto ? `\nConservative ProtoIR:\n${JSON.stringify(compactProtoIR(proto))}` : "",
      `\nDraft Formal IR:\n${JSON.stringify(draft)}`,
      "\nReturn only repaired Formal IR JSON."
    ].join("\n");
    const raw = await this.client.complete({system, user});
    const ir = normalizeIR(extractJsonObject(raw));
    const v = validateIR(ir);
    if (!v.ok) throw new Error(`Invalid repaired IR: ${v.errors.join("; ")}`);
    return {ir, proto, artifacts: {draft, rawModelOutput: raw, llm: this.client.lastResponseMeta ?? null}};
  }
}
