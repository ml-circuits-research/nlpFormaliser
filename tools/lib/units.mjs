// Source units for proposition/sentence-level scoring.
//
// Units are derived from the SOURCE only, never from a strategy's output, so
// every strategy is scored on identical units and paired comparisons are
// well-defined. Where the corpus records source provenance (atomic records
// concatenated into a consolidated document, or dialogue turns), each unit
// carries that provenance; otherwise the text is sentence-split.
const segmenter=new Intl.Segmenter('en',{granularity:'sentence'});

export function splitSentences(text,offset=0) {
  const out=[];
  for(const s of segmenter.segment(text)) {
    const raw=s.segment,trimmed=raw.trim();
    if(!trimmed)continue;
    const start=offset+s.index+raw.indexOf(trimmed);
    out.push({text:trimmed,start,end:start+trimmed.length});
  }
  return out;
}

const pad=n=>String(n).padStart(2,'0');

/** Units for one evaluation case: [{id,text,start?,end?,turn?,source?}] */
export function sourceUnits(item) {
  if(Array.isArray(item.turns)&&item.turns.length) {
    return item.turns.flatMap((turn,t)=>splitSentences(String(turn.text??'')).map((s,k)=>({
      id:`t${pad(t+1)}-s${pad(k+1)}`,text:s.text,turn:turn.id??t+1,speaker:turn.speaker??null,
      source:{kind:'turn',id:turn.id??null},
    })));
  }
  const text=String(item.sourceText??item.text??'');
  const spans=(item.reference?.atomic??[]).filter(a=>Array.isArray(a.span));
  return splitSentences(text).map((s,k)=>{
    const owner=spans.find(a=>s.start>=a.span[0]&&s.end<=a.span[1]);
    const added=(item.construction?.addedSentences??[]).includes(s.text)||item.construction?.preamble===s.text;
    return {id:`u${pad(k+1)}`,...s,source:owner?{kind:'atomic',id:owner.id,set:owner.set}:added?{kind:'added'}:null};
  });
}
