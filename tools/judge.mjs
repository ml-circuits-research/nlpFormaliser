#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {readArg} from './lib/cli.mjs';
import {taskLLM} from './lib/pworker.mjs';
import {makeJudge} from './lib/judge.mjs';
import {makeUnitJudge} from './lib/unit-judge.mjs';
import {sourceUnits} from './lib/units.mjs';
const {values:o}=parseArgs({options:{original:{type:'string'},cnl:{type:'string'},tier:{type:'string',default:'good'},model:{type:'string'},
  mode:{type:'string',default:'bidirectional'},units:{type:'boolean',default:false}}});
if(o.original===undefined||o.cnl===undefined) throw new Error('judge --original TEXT|FILE --cnl TEXT|FILE [--tier good|--model up/model] [--mode bidirectional|direct] [--units]');
const original=readArg(o.original),cnl=readArg(o.cnl);
if(o.units) {
  // Sentence-level verdicts through the predefined unit-judge task.
  const {llm}=taskLLM({file:new URL('../tasks/judge-units.mjs',import.meta.url),tier:o.tier,model:o.model,batchSize:1});
  const verdict=await makeUnitJudge(llm)(original,sourceUnits({text:original}),cnl);
  console.log(JSON.stringify(verdict,null,2));process.exitCode=verdict.status==='judged'&&verdict.units.every(u=>u.preserved===true)?0:2;
} else {
  const {llm}=taskLLM({file:new URL(`../tasks/judge-${o.mode}.mjs`,import.meta.url),tier:o.tier,model:o.model,batchSize:1});
  const verdict=await makeJudge(llm,o.mode)(original,cnl);
  console.log(JSON.stringify(verdict,null,2));process.exitCode=verdict.equivalent===true?0:2;
}
