#!/usr/bin/env node
// Non-LLM judge baseline on the fixed control set: a hyperdimensional (VSA/HDC) bundle of content words and permuted bigrams, compared by
// cosine. It reports the best possible threshold accuracy and how often a good archive rendering scores above its corrupted twin.
// No model calls. Used to test whether lexical similarity can replace the LLM judge (it cannot: see judge-calibration-consolidated.md).
import {judgeControls} from './lib/judge-controls.mjs';
const C=judgeControls(),D=10000,H=new Map();
let seed=1;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
const STOP=new Set('the a an of for that is it holds predicate proposition with ordered arguments statement question case be to and'.split(' '));
const words=s=>(s.toLowerCase().replace(/[“”"]/g,' ').match(/[a-z0-9]+/g)??[]).filter(w=>!STOP.has(w));
const hv=w=>{if(!H.has(w))H.set(w,Int8Array.from({length:D},()=>rnd()<.5?-1:1));return H.get(w);};
const enc=s=>{const w=words(s),v=new Float64Array(D);w.forEach((x,i)=>{const a=hv(x);for(let k=0;k<D;k++)v[k]+=a[k];
  if(i){const b=hv(w[i-1]);for(let k=0;k<D;k++)v[k]+=b[(k+1)%D]*a[k];}});return v;};
const cos=(a,b)=>{let d=0,x=0,y=0;for(let k=0;k<D;k++){d+=a[k]*b[k];x+=a[k]*a[k];y+=b[k]*b[k];}return d/Math.sqrt(x*y);};
const rows=C.map(c=>({id:c.id,expected:c.expected,similarity:cos(enc(c.original),enc(c.cnl))}));
let best=0,threshold=0;for(const t of rows.map(r=>r.similarity)){const n=rows.filter(r=>(r.similarity>=t)===r.expected).length;if(n>best){best=n;threshold=t;}}
const sim=Object.fromEntries(rows.map(r=>[r.id,r.similarity]));
const pairs=Object.keys(sim).filter(id=>/^archive-.*-good$/.test(id)).map(id=>sim[id]>sim[id.replace(/good$/,'bad')]);
console.log(JSON.stringify({n:rows.length,negatives:rows.filter(r=>!r.expected).length,bestAccuracy:best,threshold,
  archiveGoodAboveBad:`${pairs.filter(Boolean).length}/${pairs.length}`,rows:rows.sort((a,b)=>b.similarity-a.similarity)},null,1));
