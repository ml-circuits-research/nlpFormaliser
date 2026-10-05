#!/usr/bin/env node
import {readFileSync,readdirSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {ROOT} from './lib/strategies.mjs';
const dir=join(ROOT,'docs','experiments');
const rows=[],judges=[],costs=[];
for(const id of readdirSync(dir).sort()) {
  const p=join(dir,id);if(!existsSync(join(p,'summary.json')))continue;
  const s=JSON.parse(readFileSync(join(p,'summary.json'),'utf8'));
  const calls=existsSync(join(p,'calls.jsonl'))?readFileSync(join(p,'calls.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
  const items=readFileSync(join(p,'items.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  if(s.strategies)for(const [name,r] of Object.entries(s.strategies)) {
    const rs=items.filter(x=>x.strategy===name);
    const infrastructure=rs.filter(x=>x.failure==='infrastructure'||x.errors?.some(e=>/status \d+|no answer within|unreachable/i.test(e))).length;
    rows.push(`| [${id}](experiments/${id}/report.md) | ${s.stage} | ${name} | ${r.n} | ${r.valid} | ${r.reasoningEligible} | ${r.equivalent} | ${r.eligibleEquivalent} | ${infrastructure} | ${r.judgeErrors} |`);
  } else judges.push(`| ${id} | ${s.n} | ${s.correct} | ${s.falseAccepts.length} | ${s.falseRejects.length} | ${s.errors.length} |`);
  const models=[...new Set(calls.map(c=>c.result.served).filter(Boolean))].join(', ')||'none';
  costs.push(`| ${id} | ${calls.length} | ${calls.reduce((n,c)=>n+(c.result.usage?.in??0),0)} | ${calls.reduce((n,c)=>n+(c.result.usage?.out??0),0)} | ${calls.reduce((n,c)=>n+(c.result.credits??0),0).toFixed(2)} | ${calls.filter(c=>c.result.credits==null&&!c.result.cached).length} | ${models} |`);
}
const report=`# Recorded experiment results\n\nGenerated from immutable run artifacts. This is an evidence inventory, not a ranking. Validity, reasoning export, semantic equivalence and inference correctness are different criteria. In particular, calibration cases are not sufficient to rank strategies. See [protocol](protocol.md) and [research log](experiments.md).\n\n| Run | Stage | Strategy | N | Valid | Eligible | Judge equivalent | Eligible + equivalent | Infrastructure failures | Judge errors |\n|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n\n## Judge controls\n\n| Run | N | Correct | False accepts | False rejects | Errors |\n|---|---:|---:|---:|---:|---:|\n${judges.join('\n')}\n\n## Observed client calls\n\nCredit headers are partial evidence, not an invoice: proxy retries can add upstream attempts and missing headers are unknown cost. USD values were not supplied in the initial runs. Token counts are those reported by the provider and may include internal reasoning.\n\n| Run | Requests | Input tokens | Output tokens | Known credit headers | Unknown credit requests | Served models |\n|---|---:|---:|---:|---:|---:|---|\n${costs.join('\n')}\n`;
writeFileSync(join(ROOT,'docs','results.md'),report);console.log('Updated docs/results.md');
