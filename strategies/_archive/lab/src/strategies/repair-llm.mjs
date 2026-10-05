import {FormalizationStrategy} from "../strategy.mjs";
import {buildProtoIR} from "../protoir.mjs";
import {HeuristicStrategy} from "./heuristic.mjs";
import {SemanticRepairer} from "../repairer.mjs";

export class RepairLLMStrategy extends FormalizationStrategy {
  constructor({client, draftStrategy = new HeuristicStrategy(), name = "heuristic+repair", includeProto = true} = {}) {
    super(name);
    if (!client) throw new Error("RepairLLMStrategy requires a client");
    this.draftStrategy = draftStrategy;
    this.repairer = new SemanticRepairer({client, includeProto});
  }

  async formalize(text, {proto = buildProtoIR(text)} = {}) {
    const draftResult = await this.draftStrategy.formalize(text, {proto});
    const repaired = await this.repairer.repair(text, draftResult.ir, {proto});
    repaired.ir.meta = {...repaired.ir.meta, strategy: this.name, repairedFrom: this.draftStrategy.name};
    return repaired;
  }
}
