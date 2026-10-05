#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {readArg} from './lib/cli.mjs';
import {taskLLM} from './lib/pworker.mjs';
import {makeJudge} from './lib/judge.mjs';
const {values:o}=parseArgs({options:{original:{type:'string'},cnl:{type:'string'},tier:{type:'string',default:'good'},mode:{type:'string',default:'bidirectional'}}});
if(o.original===undefined||o.cnl===undefined) throw new Error('judge --original TEXT|FILE --cnl TEXT|FILE [--tier good] [--mode bidirectional|direct]');
const {llm}=taskLLM({file:new URL(`../tasks/judge-${o.mode}.mjs`,import.meta.url),tier:o.tier});
const verdict=await makeJudge(llm,o.mode)(readArg(o.original),readArg(o.cnl));
console.log(JSON.stringify(verdict,null,2));process.exitCode=verdict.equivalent===true?0:2;
