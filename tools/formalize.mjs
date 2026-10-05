#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {join} from 'node:path';
import {readArg,positive} from './lib/cli.mjs';
import {taskLLM} from './lib/pworker.mjs';
import {ROOT,formalizeToCNL,listStrategies,loadStrategy} from './lib/strategies.mjs';
const {values:o,positionals}=parseArgs({allowPositionals:true,options:{strategy:{type:'string',short:'s'},tier:{type:'string',default:'small'},list:{type:'boolean'},'cnl-only':{type:'boolean'},'batch-size':{type:'string',default:'5'},help:{type:'boolean'}}});
if(o.list){console.log(listStrategies().join('\n'));process.exit(0);}
if(o.help||!o.strategy){console.log('formalize --strategy NAME [--tier small] TEXT|FILE|-');process.exit(o.help?0:1);}
const strategy=await loadStrategy(o.strategy);
const llm=taskLLM({file:strategy.taskFile,tier:o.tier,batchSize:positive(o['batch-size'],'batch-size')}).llm;
const r=await formalizeToCNL(strategy,readArg(positionals[0]),{llm,options:{rounds:0}});
console.log(o['cnl-only']?r.cnl??r.errors.join('\n'):JSON.stringify(r,null,2));process.exitCode=r.ok?0:1;
