import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { $, A, N, I, U, E, Q, W, toWire, fromWire, toCNL, validate, createPipeline } from '../src/index.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));

// Dynamic predicate API.
assert.equal(toWire($.buy('ravi','laptop')), '$.buy(ravi,laptop)');
assert.equal(toWire($.anything_new('a','b')), '$.anything_new(a,b)');

// Binders + scope.
const quantified=U(x=>I($.student(x),E(y=>A($.book(y),$.read(x,y)))));
assert.equal(toWire(quantified),'U(x,I($.student(x),E(y,A($.book(y),$.read(x,y)))))');
assert.deepEqual(validate(quantified),{ok:true,errors:[]});

// Safe wire round-trip.
for(const wire of [
  'N($.ordered(alice,book_1))',
  'Q($.owns(alice,car_7))',
  'W(x,A($.researcher(x),$.writes(x,paper_7)))',
  '$.time($.plan(ravi,$.buy(ravi,laptop)),next_month)',
  '[I($.on(switch),$.run(pump)),$.on(switch),Q($.run(pump))]'
]) assert.equal(toWire(fromWire(wire)),wire);

// Deterministic CNL.
const cnl=toCNL(fromWire('U(x,I($.student(x),E(y,A($.book(y),$.read(x,y)))))'));
assert.match(cnl,/for every x/);
assert.match(cnl,/there exists a y/);
assert.match(cnl,/“read”/);

// Pipeline: bad initial candidate -> judge identifies omission -> repair -> accepted.
const calls=[];
const formalizer=async req=>{calls.push(req.role); return '[$.plan(ravi,$.buy(ravi,laptop)),Q($.buy(ravi,laptop))]';};
let judged=0;
const judge=async req=>{
  calls.push(req.role); judged++;
  return judged===1
    ? JSON.stringify({s:0.72,eq:false,miss:['next month'],add:[],chg:[],amb:[]})
    : JSON.stringify({s:1,eq:true,miss:[],add:[],chg:[],amb:[]});
};
const repairer=async req=>{calls.push(req.role); return '[$.time($.plan(ravi,$.buy(ravi,laptop)),next_month),Q($.buy(ravi,laptop))]';};
const p=createPipeline({formalizer,judge,repairer,maxRepairs:1,threshold:0.98});
const result=await p.run('Ravi plans to buy a laptop next month. Has he bought it?');
assert.equal(result.accepted,true);
assert.equal(result.best.iteration,1);
assert.equal(result.best.audit.score,1);
assert.deepEqual(calls,['formalize','judge','repair','judge']);

// Keep best candidate if repair gets worse.
let j2=0;
const p2=createPipeline({
  formalizer:async()=> '$.offline(server)',
  repairer:async()=> '$.online(server)',
  judge:async()=> JSON.stringify(++j2===1?{s:.8,eq:false,miss:['attribution'],add:[],chg:[],amb:[]}:{s:.2,eq:false,miss:[],add:['online'],chg:[],amb:[]}),
  maxRepairs:1
});
const r2=await p2.run('Lea said the server was offline.');
assert.equal(r2.best.iteration,0);
assert.equal(r2.best.audit.score,.8);

// Every benchmark gold wire parses, validates, reserializes, and renders CNL.
const dataset=fs.readFileSync(path.join(here,'..','eval','data','semantic_cases.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
for(const row of dataset){
  const ir=fromWire(row.goldWire);
  assert.equal(validate(ir).ok,true,row.id);
  assert.equal(toWire(ir),row.goldWire,row.id);
  assert.ok(toCNL(ir).length>10,row.id);
}
assert.equal(dataset.length,30);

console.log(`ok - ${dataset.length} benchmark cases + core/pipeline tests`);
