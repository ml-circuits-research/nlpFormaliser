import test from "node:test";
import assert from "node:assert/strict";
import {HeuristicStrategy, evaluateDataset} from "../src/index.mjs";

test("dataset evaluator reports executable behavior", async () => {
  const dataset = [{
    id:"x", category:"simple", text:"Mira is a physicist.",
    gold_ir:{facts:[{pred:"physicist",args:["mira"],neg:false}],rules:[]},
    tests:[{query:{pred:"physicist",args:["mira"],neg:false},expected:"TRUE",kind:"semantic"}]
  }];
  const r = await evaluateDataset({strategy:new HeuristicStrategy(), dataset});
  assert.equal(r.summary.behaviorAccuracy, 1);
  assert.equal(r.summary.meanFactF1, 1);
});
