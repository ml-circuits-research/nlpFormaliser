import {FormalizationStrategy} from "../strategy.mjs";
import {buildProtoIR, compactProtoIR} from "../protoir.mjs";
import {normalizeIR, validateIR} from "../ir.mjs";
import {extractJsonObject} from "../util.mjs";
import {FORMAL_IR_SPEC} from "./direct-llm.mjs";

export class ProtoLLMStrategy extends FormalizationStrategy {
  constructor({client, name = "proto-llm"} = {}) {
    super(name);
    if (!client) throw new Error("ProtoLLMStrategy requires a client");
    this.client = client;
  }

  async formalize(text, {proto = buildProtoIR(text)} = {}) {
    const system = `${FORMAL_IR_SPEC}\nYou are a semantic normalizer. The ProtoIR is conservative surface evidence: it may contain false-positive candidates, but its spans and source text are authoritative evidence. Convert the meaning into Formal IR without inventing unsupported facts.`;
    const user = [
      "Natural-language source:", text,
      `\nConservative ProtoIR:\n${JSON.stringify(compactProtoIR(proto))}`,
      "\nReturn only Formal IR JSON."
    ].join("\n");
    const raw = await this.client.complete({system, user});
    const ir = normalizeIR(extractJsonObject(raw));
    const v = validateIR(ir);
    if (!v.ok) throw new Error(`Invalid ProtoIR-normalized Formal IR: ${v.errors.join("; ")}`);
    ir.meta = {...ir.meta, strategy: this.name};
    return {ir, proto, artifacts: {rawModelOutput: raw, llm: this.client.lastResponseMeta ?? null}};
  }
}
