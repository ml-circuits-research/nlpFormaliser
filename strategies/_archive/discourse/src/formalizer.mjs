/**
 * nl2cnl.mjs — dependency-free experimental English NL -> canonical CNL formalizer.
 * Node.js >= 20. MIT License.
 *
 * This is deliberately conservative: it emits ambiguity/risk records instead of
 * pretending that a heuristic parse is certain. It is a research prototype, not
 * a complete semantic parser.
 */


const VERSION = '1.0.0-strategy';

const AUX = new Set(['am','is','are','was','were','be','been','being','do','does','did','have','has','had','can','could','may','might','must','shall','should','will','would']);
const MODALS = new Map([
  ['must','OBLIGATORY'], ['must not','FORBIDDEN'], ['should','RECOMMENDED'], ['should not','DISCOURAGED'],
  ['may','PERMITTED'], ['may not','NOT_PERMITTED'], ['can','POSSIBLE'], ['cannot','IMPOSSIBLE'], ["can't",'IMPOSSIBLE'],
  ['could','POSSIBLE'], ['will','EXPECTED'], ['would','CONDITIONAL'], ['need to','REQUIRED'], ['needs to','REQUIRED'],
]);
const DETERMINERS = new Set(['the','a','an','this','that','these','those','my','your','our','their','his','her','its']);
const QUANTIFIERS = new Set(['every','each','all','some','any','no','a','an','one']);
const WH = new Set(['who','whom','whose','what','which','when','where','why','how']);
const PRONOUNS = new Set(['it','he','she','they','him','her','them','this','that','these','those']);
const PERSON_PRONOUNS = new Set(['he','she','him','her','who','whom']);
const PLURAL_PRONOUNS = new Set(['they','them','these','those','ones']);

// Deliberately small lexical inventory. Unknown verbs are still detected via morphology.
const VERBS = new Set([
  'accept','add','allow','answer','approve','ask','assign','avoid','be','believe','build','call','change','check','choose','clarify','close','compare','compile','contain','continue','convert','correct','create','decide','define','delete','describe','detect','discuss','download','enter','evaluate','exclude','explain','formalize','fail','emit','exceed','happen','arrive','determine','infer','mount','involve','mark','stop','inspect','filter','find','fix','follow','generate','give','include','infer','inform','keep','know','leave','list','lock','make','mean','measure','mention','merge','need','notify','open','own','plan','prefer','preserve','process','produce','publish','read','receive','reject','remember','remove','repair','report','require','resolve','return','review','run','apply','consider','say','search','select','send','show','store','submit','summarize','support','tell','test','translate','treat','try','update','use','validate','verify','wait','want','write'
]);

const IRREGULAR = new Map(Object.entries({
  'am':'be','is':'be','are':'be','was':'be','were':'be','been':'be','being':'be',
  'has':'have','had':'have','does':'do','did':'do','done':'do',
  'gave':'give','given':'give','went':'go','gone':'go','left':'leave','made':'make','said':'say','told':'tell',
  'found':'find','sent':'send','read':'read','wrote':'write','written':'write','built':'build','thought':'think',
  'knew':'know','known':'know','chose':'choose','chosen':'choose','ran':'run','shown':'show','saw':'see','seen':'see',
  'kept':'keep','meant':'mean','bought':'buy','brought':'bring','caught':'catch','taught':'teach','received':'receive',
  'submitted':'submit','approved':'approve','reviewed':'review','published':'publish','failed':'fail','deleted':'delete',
  'locked':'lock','compared':'compare','explained':'explain','generated':'generate','resolved':'resolve','preserved':'preserve',
  'clarified':'clarify','excluded':'exclude','included':'include','selected':'select','returned':'return','reported':'report',
  'tested':'test','translated':'translate','formalized':'formalize','processed':'process','evaluated':'evaluate','detected':'detect',
  'fixed':'fix','asked':'ask','wanted':'want','needed':'need','preferred':'prefer','planned':'plan','required':'require',
  'allowed':'allow','supported':'support','contained':'contain','created':'create','used':'use','verified':'verify','validated':'validate'
}));

const PERSON_LIKE = new Set(['researcher','reviewer','author','user','operator','student','teacher','manager','engineer','scientist','assistant','person','developer','reader','writer','auditor','administrator']);
const RECIPIENT_VERBS = new Set(['give','send','show','tell','offer','submit','report','return','assign']);
const MOVEMENT_VERBS = new Set(['go','move','travel','ship','send','return','leave']);
const SPEECH_VERBS = new Set(['say','tell','report','claim','believe','think','know','ask','answer','explain']);
const IMPERATIVE_VERBS = new Set(['find','list','show','compare','summarize','explain','run','check','use','keep','remove','exclude','include','return','generate','write','create','tell','ask','clarify','translate','formalize','evaluate','test','select','filter','notify','remember','repair','choose','define','apply','consider','infer','mark','stop','inspect','resolve']);

let globalId = 0;
function uid(prefix='x') { globalId += 1; return `${prefix}${globalId}`; }

function cleanSpace(s) { return s.replace(/\s+/g, ' ').trim(); }
function stripPunct(s) { return cleanSpace(s).replace(/[.!?]+$/g, '').trim(); }
function lower(s) { return s.toLowerCase(); }
function cap(s) { return s ? s[0].toUpperCase()+s.slice(1) : s; }
function isNumberish(s) { return /^(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand)$/i.test(s); }
function normQuote(s) { return cleanSpace(s).replace(/^['“”"]|['“”"]$/g,''); }

function tokenize(text) {
  return text.match(/[A-Za-zÀ-ÖØ-öø-ÿ0-9_'-]+|<=|>=|!=|==|%|[.,!?;:()]/g) ?? [];
}
function splitSentences(text) {
  const parts = text.replace(/\n+/g,' ').match(/[^.!?]+[.!?]?/g) ?? [];
  return parts.map(cleanSpace).filter(Boolean);
}

function lemma(word) {
  let w = lower(word).replace(/[^a-z0-9'-]/g,'');
  if (IRREGULAR.has(w)) return IRREGULAR.get(w);
  if (VERBS.has(w)) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0,-3)+'y';
  if (w.endsWith('ied') && w.length > 4) return w.slice(0,-3)+'y';
  if (w.endsWith('ing') && w.length > 5) {
    let b = w.slice(0,-3);
    if (b.endsWith(b.at(-1)+b.at(-1))) b=b.slice(0,-1);
    if (VERBS.has(b)) return b;
    if (VERBS.has(b+'e')) return b+'e';
    return b;
  }
  if (w.endsWith('ed') && w.length > 4) {
    const b=w.slice(0,-2);
    if (VERBS.has(b)) return b;
    if (VERBS.has(b+'e')) return b+'e';
    return b;
  }
  if (w.endsWith('es') && w.length > 4) {
    const b=w.slice(0,-2);
    if (VERBS.has(b)) return b;
    if (VERBS.has(w.slice(0,-1))) return w.slice(0,-1);
  }
  if (w.endsWith('s') && w.length > 3) {
    const b=w.slice(0,-1);
    if (VERBS.has(b)) return b;
  }
  return w;
}

function looksVerb(tok, i, toks) {
  const l = lemma(tok);
  if (VERBS.has(l) || IRREGULAR.has(lower(tok))) return true;
  const w=lower(tok);
  if (/\b(?:ed|ing)$/.test(w)) return true;
  if (/s$/.test(w) && i>0 && !DETERMINERS.has(lower(toks[i-1]))) return VERBS.has(l);
  return false;
}

function parseNP(raw, state, ambiguities, role='entity') {
  raw = cleanSpace(raw.replace(/^[,;:]|[,;:]$/g,''));
  if (!raw) return {kind:'unknown', text:''};
  const lw = lower(raw);

  if (PRONOUNS.has(lw)) {
    const resolution = resolvePronoun(lw, state);
    if (resolution.status === 'resolved') {
      return {kind:'ref', id:resolution.entity.id, text:resolution.entity.label, pronoun:raw};
    }
    ambiguities.push({
      id:uid('a'), kind:'anaphora', severity:'high', span:raw,
      message:`Pronoun '${raw}' does not have one symbolically unique antecedent.`,
      options:resolution.candidates.map(e=>e.label),
      question:`What does '${raw}' refer to?`
    });
    return {kind:'unresolved_ref', text:raw, candidates:resolution.candidates.map(e=>e.id)};
  }

  // quantifier + noun phrase
  const m = raw.match(/^(every|each|all|some|any|no|a|an|one)\s+(.+)$/i);
  if (m) {
    const q=lower(m[1]);
    const body=cleanSpace(m[2]);
    const type=singularize(body.replace(/\b(?:who|that|which)\b.*$/i,'').trim());
    return {kind:'quantified_np', quantifier:q, type, text:raw};
  }

  // Proper-name-ish or descriptive concrete NP.
  const label = raw.replace(/^(?:the|this|that|these|those)\s+/i,'').trim();
  const type = inferType(label);
  const ent = internEntity(state, label, type, role);
  return {kind:'ref', id:ent.id, text:ent.label, type:ent.type};
}

function singularize(s) {
  s=cleanSpace(s);
  if (/ies$/i.test(s)) return s.replace(/ies$/i,'y');
  if (/sses$/i.test(s)) return s.replace(/es$/i,'');
  if (/s$/i.test(s) && !/ss$/i.test(s)) return s.slice(0,-1);
  return s;
}
function inferType(label) {
  const l=lower(label);
  const last=singularize(l.split(/\s+/).at(-1) ?? l);
  if (PERSON_LIKE.has(last)) return last;
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/.test(label)) return 'person';
  if (/\b(report|paper|article|document|file|record|grant|proposal|dataset|model|tool|server|account|password|result|experiment|test|query|question|answer|rule|language|parser|program|code)\b/i.test(label)) return singularize(last);
  return last || 'entity';
}
function internEntity(state,label,type='entity',role='entity') {
  const key=lower(label);
  const existing=state.entities.find(e=>lower(e.label)===key);
  if (existing) { existing.lastSeen=state.turnIndex; return existing; }
  const ent={id:uid('e'),label,type,role,lastSeen:state.turnIndex};
  state.entities.push(ent);
  return ent;
}

function resolvePronoun(pronoun,state) {
  const recent=[...state.entities].sort((a,b)=>b.lastSeen-a.lastSeen).filter(e=>state.turnIndex-e.lastSeen<=3);
  let candidates=recent;
  if (PERSON_PRONOUNS.has(pronoun)) candidates=recent.filter(e=>e.type==='person'||PERSON_LIKE.has(e.type));
  if (pronoun==='it') candidates=recent.filter(e=>!(e.type==='person'||PERSON_LIKE.has(e.type)));
  if (PLURAL_PRONOUNS.has(pronoun)) candidates=recent.filter(e=>/s$/.test(e.label)||e.number==='plural');
  // 'this/that' often refer to proposition; preserve that if a previous proposition exists.
  if ((pronoun==='this'||pronoun==='that') && state.lastProposition) {
    const prop={id:state.lastProposition.id,label:`previous proposition ${state.lastProposition.id}`,type:'proposition',lastSeen:state.turnIndex-1};
    candidates=[prop,...candidates.slice(0,2)];
  }
  const sameTurn=candidates.filter(e=>e.lastSeen===state.turnIndex);
  if (sameTurn.length===1) return {status:'resolved',entity:sameTurn[0],candidates:sameTurn};
  if (candidates.length===1) return {status:'resolved',entity:candidates[0],candidates};
  // If recency ties, allow a unique discourse/theme referent to beat destinations/locations.
  if (candidates.length>1) {
    const w=r=>({discourse:4,subject:4,theme:3,agent:3,recipient:2,entity:2,destination:1,source:1,location:1}[r.role]||1);
    const ranked=[...candidates].sort((a,b)=>w(b)-w(a));
    if (w(ranked[0])>=w(ranked[1])+2) return {status:'resolved',entity:ranked[0],candidates:candidates.slice(0,5)};
  }
  return {status:'ambiguous',candidates:candidates.slice(0,5)};
}

function newState() {
  return {turnIndex:0,entities:[],propositions:[],lastProposition:null,speaker:'user',addressee:'assistant'};
}

function classifyAct(text) {
  const s=cleanSpace(text);
  const core=s.replace(/^(?:now|finally|then)[:,]?\s+/i,'');
  const l=lower(s);
  if (/^(yes|correct|exactly|right)\b/.test(l)) return 'CONFIRM';
  if (/^(?:no|nope|incorrect|wrong)[,!.:]?(?:\s+|$)/.test(l) && !/^no\s+[a-z]+\s+(?:must|may|can|should|is|are|has|have|[a-z]+s)\b/.test(l) || /^i mean\b/.test(l)) return 'REJECT_OR_CORRECT';
  if (/^(?:when|before|after)\s+.+?,\s*.+/i.test(s) && !/\?$/.test(s)) return 'ASSERT';
  if (/^(can|could|would|will) you\b/i.test(s) || /^please\b/i.test(s) || /^(i want|i need|i would like) you to\b/i.test(s)) return 'REQUEST';
  if (/\?$/.test(s) || /^(who|what|which|where|why|how)\b/i.test(s) || (/^when\b/i.test(s)&&/\?$/.test(s))) return 'ASK';
  if (/^(?:do not|don't|never)\s+[A-Za-z]/i.test(s)) return 'INSTRUCT';
  if (/^let(?:'s| us)\b/i.test(s)) return 'PROPOSE';
  if (/^(we|i) (?:need|want|plan|intend) to\b/i.test(s)) return 'STATE_GOAL';
  if (/^(the )?problem (?:is|:)/i.test(s) || /^our problem\b/i.test(s)) return 'STATE_PROBLEM';
  if (/^i prefer\b/i.test(s) || /\bprefer\b/i.test(s)) return 'PREFERENCE';
  if (/^otherwise\s+/i.test(s)) { const f=lemma(tokenize(s.replace(/^otherwise\s+/i,''))[0]??''); if(IMPERATIVE_VERBS.has(f)) return 'INSTRUCT'; }
  const first=lemma(tokenize(core)[0] ?? '');
  if (IMPERATIVE_VERBS.has(first)) return 'INSTRUCT';
  return 'ASSERT';
}

function detectSymbolicRisks(text,state) {
  const risks=[];
  const l=lower(text);
  function add(kind,severity,span,message,options=[],question='') {
    risks.push({id:uid('a'),kind,severity,span,message,options,question});
  }

  // Pronoun ambiguity is resolved later with actual context, but detect structural risk now.
  const tt=tokenize(text);
  for (let pi=0;pi<tt.length;pi++) {
    const p=tt[pi]; if(!PRONOUNS.has(lower(p))) continue;
    if(['this','that','these','those'].includes(lower(p)) && pi+1<tt.length && !looksVerb(tt[pi+1],pi+1,tt) && !['.',',',';','?','!'].includes(tt[pi+1])) continue; // demonstrative determiner
    if(lower(p)==='that' && pi>0 && (tt.slice(Math.max(0,pi-4),pi).some(x=>SPEECH_VERBS.has(lemma(x))) || ['who','which'].includes(lower(tt[pi-1])) || (pi+1<tt.length && looksVerb(tt[pi+1],pi+1,tt)) || (pi+2<tt.length&&lower(tt[pi+1])==='only'&&looksVerb(tt[pi+2],pi+2,tt)))) continue;
    if ((lower(p)==='he'||lower(p)==='she') && /\bcompatible with he or she\b/i.test(text)) continue;
    const r=resolvePronoun(lower(p),state);
    if (r.status!=='resolved') add('anaphora','high',p,`'${p}' may have multiple or no antecedents.`,r.candidates.map(e=>e.label),`What does '${p}' refer to?`);
  }

  if (/\bwith\b/i.test(text)) add('pp_attachment','medium','with',"A 'with' phrase can modify the event or a noun phrase.",['event/instrument-or-companion','preceding noun'],"What does the 'with ...' phrase modify?");
  if (/\bfor\b/i.test(text) && !/\bfor every\b/i.test(text) && !/\bfor (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:second|minute|hour|day|week|month|year)s?\b/i.test(text)) add('for_attachment','medium','for',"A 'for' phrase may encode purpose, beneficiary, duration, or argument structure.");
  if (/\bonly\b/i.test(text) && !/\b(?:involved|mentions?|contains?|operator|word)\s+only\b/i.test(text)) add('only_scope','high','only',"The scope of 'only' must be made explicit in the CNL.",['ONLY(entity)','ONLY(event/argument)','ONLY(condition)'],"What exactly does 'only' restrict?");
  if (/\b(?:and|or)\b/i.test(text)) {
    const verbs=tokenize(text).filter((t,i,a)=>looksVerb(t,i,a)).length;
    if (verbs>=2) add('coordination_scope','medium',text.match(/\b(?:and|or)\b/i)?.[0]??'and/or','Coordination may have more than one grouping.');
  }
  if (/\b(?:every|each|all)\b.*\b(?:a|an|some)\b/i.test(text)) add('quantifier_scope','medium',text.match(/\b(?:every|each|all)\b.*\b(?:a|an|some)\b/i)?.[0]??'', 'Universal and existential quantifiers may have different scope readings.',['forall > exists','exists > forall']);
  if (/\bnot every\b/i.test(text) || /\b(?:must|should|may|can) not\b/i.test(text) || /\bnot (?:must|should|may|can)\b/i.test(text)) add('negation_scope','medium','not','Negation interacts with a quantifier or modal; preserve operator order exactly.');
  if (/\b(?:before|after|while|when|until)\b/i.test(text) && tokenize(text).filter((t,i,a)=>looksVerb(t,i,a)).length>=2) add('temporal_attachment','medium',text.match(/\b(?:before|after|while|when|until)\b/i)?.[0]??'', 'Temporal clause attachment can be ambiguous.');
  if (/\b(?:said|says|believes|believed|thinks|thought|knows|knew|reported|reports)\s+that\b/i.test(text) && /\bnot\b/i.test(text)) add('attitude_scope','high','that','Negation or modality may scope over an attitude report or its embedded proposition.');
  if (/\b(?:he|she|they|him|her|them)\b/i.test(text) && !/\bcompatible with he or she\b/i.test(text) && (state.entities.filter(e=>e.type==='person'||PERSON_LIKE.has(e.type)).length>1)) add('anaphora','high',text.match(/\b(?:he|she|they|him|her|them)\b/i)?.[0]??'', 'More than one recent discourse entity can satisfy this pronoun.');
  const properNames=[...text.matchAll(/\b[A-Z][a-z]+\b/g)].map(m=>m[0]).filter(x=>!['If','When','Every','Each','No','Not','Only','The','A','An','Before','After','Finally','Now','Given','That','Which','What','How','Do'].includes(x));
  if (/\b(?:he|she|him|her)\b/i.test(text) && !/\bcompatible with he or she\b/i.test(text) && new Set(properNames).size>=2) add('anaphora','high',text.match(/\b(?:he|she|him|her)\b/i)?.[0]??'', 'Two or more person-like names occur in the same sentence before a singular person pronoun.',[...new Set(properNames)]);
  if (/\b(?:does|do|did) not have to\b/i.test(text)) add('negation_scope','high','not have to',"'does not have to' means absence of obligation, not prohibition.",['NOT(REQUIRED(...))','FORBIDDEN(...)']);
  if (/\b(?:faster|slower|better|best|stronger|weaker|first|second|other|another|previous|former|latter) one\b/i.test(text)) add('anaphora','high',text.match(/\b(?:faster|slower|better|best|stronger|weaker|first|second|other|another|previous|former|latter) one\b/i)?.[0]??'one','Elliptical one-anaphora needs an antecedent type.');
  if (/^a\s+[A-Za-z][A-Za-z -]*\s+who\b.*\b(?:must|should|may|can|will)\b/i.test(text)) add('generic_indefinite','high',text.match(/^a\s+[A-Za-z][A-Za-z -]*/i)?.[0]??'a ...',"Indefinite subject in a rule-like sentence may be generic/universal rather than existential.",['generic FOR_EVERY','existential THERE_EXISTS']);
  for(const pm of text.matchAll(/\b(its|his|her|their)\s+([A-Za-z-]+)/ig)) add('possessive_anaphora','high',pm[0],`Possessive '${pm[1]}' needs an antecedent.`,[],`Whose ${pm[2]}?`);
  if (/^how many\s+(?:were|are|was|is)\b/i.test(text)) add('ellipsis','high',text.match(/^how many\s+(?:were|are|was|is)/i)?.[0]??'how many','The counted noun is elided and must be recovered from discourse context.');
  if (/^which\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+[A-Za-z-]+/i.test(text)) add('ellipsis','medium',text.match(/^which\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i)?.[0]??'which N','The noun after the numeral may be omitted or underspecified by context.');
  if (/^(?:[A-Za-z-]+|\d+)[^,]*\bwere\b[^,]+,\s*(?:[A-Za-z-]+|\d+)\s+were\b/i.test(text)) add('elliptical_coordination','high',text,'Coordinated count/report clauses omit repeated nouns and require discourse reconstruction.');
  if (/^(?:a|an|the)\s+.+?\s+is\s+.+?\s+if\s+/i.test(text)) add('definition_or_rule_scope','medium','if','Pattern X is Y if C may encode a rule/definition; ensure the condition and classification remain separate.');
  if (/\b(?:old|young|large|small|fast|slow|cheap|expensive|good|better|best|near|far)\b/i.test(text) && !/\b(?:than|as)\b/i.test(text)) add('vagueness','low',text.match(/\b(?:old|young|large|small|fast|slow|cheap|expensive|good|better|best|near|far)\b/i)?.[0]??'', 'Gradable adjective has no explicit threshold/context.');
  if (/\b(?:it|this|that)\b/i.test(text) && /\b(?:means|implies|proves|shows|suggests)\b/i.test(text)) add('proposition_reference','medium',text.match(/\b(?:it|this|that)\b/i)?.[0]??'', 'Demonstrative may refer to a proposition rather than an entity.');
  return dedupeAmbiguities(risks);
}
function dedupeAmbiguities(items) {
  const seen=new Set(); return items.filter(x=>{const k=`${x.kind}|${x.span}`; if(seen.has(k)) return false; seen.add(k); return true;});
}

function parseModalPrefix(s) {
  const patterns=[
    [/\bmust not\b/i,'FORBIDDEN'], [/\bshould not\b/i,'DISCOURAGED'], [/\bmay not\b/i,'NOT_PERMITTED'], [/\bcannot\b|\bcan't\b/i,'IMPOSSIBLE'],
    [/\bmust\b/i,'OBLIGATORY'], [/\bshould\b/i,'RECOMMENDED'], [/\bmay\b/i,'PERMITTED'], [/\bcan\b/i,'POSSIBLE'], [/\bcould\b/i,'POSSIBLE'],
    [/\bneeds? to\b/i,'REQUIRED'], [/\bwill\b/i,'EXPECTED'], [/\bwould\b/i,'CONDITIONAL']
  ];
  for (const [re,modality] of patterns) {
    const m=s.match(re); if (m) return {modality,index:m.index,length:m[0].length,match:m[0]};
  }
  return null;
}

function parseSentence(text,state,ambiguities,opts={}) {
  let s=stripPunct(text);
  s=s.replace(/^(?:now|finally|then|otherwise)[:,]?\s+/i,'');
  s=s.replace(/^(?:now|finally|then)[:,]?\s+/i,'').replace(/^otherwise\s+/i,'');
  if (!s) return {type:'raw',text:''};

  // Conditional forms.
  let m=s.match(/^if\s+(.+?),\s*(.+?);\s*otherwise,?\s*(.+)$/i);
  if (m) return {type:'if_else',condition:parseSentence(m[1],state,ambiguities,opts),then:parseSentence(m[2],state,ambiguities,opts),else:parseSentence(m[3],state,ambiguities,opts)};
  m=s.match(/^if\s+(.+?),\s*(?:then\s+)?(.+)$/i);
  if (m) return {type:'if',condition:parseSentence(m[1],state,ambiguities,opts),consequence:parseSentence(m[2],state,ambiguities,opts)};
  m=s.match(/^unless\s+(.+?),\s*(.+)$/i);
  if (m) return {type:'if',condition:{type:'not',body:parseSentence(m[1],state,ambiguities,opts)},consequence:parseSentence(m[2],state,ambiguities,opts)};
  m=s.match(/^when\s+(.+?),\s*(.+)$/i);
  if (m) return {type:'if',condition:parseSentence(m[1],state,ambiguities,opts),consequence:parseSentence(m[2],state,ambiguities,opts),trigger:'WHEN'};
  m=s.match(/^(before|after)\s+(.+?),\s*(.+)$/i);
  if (m) {
    // Parse the subordinate clause first so its explicit entities are available to
    // pronouns in the main clause, while storing the semantic ordering as main REL subordinate.
    const right=parseSentence(m[2],state,ambiguities,opts);
    const left=parseSentence(m[3],state,ambiguities,opts);
    return {type:'temporal',relation:m[1].toUpperCase(),left,right};
  }
  m=s.match(/^(.+?)\s+if\s+(.+)$/i);
  if (m && !/^if\b/i.test(s)) return {type:'if',condition:parseSentence(m[2],state,ambiguities,opts),consequence:parseSentence(m[1],state,ambiguities,opts)};
  // Suffix condition/causal forms. These are explicit subordinate-clause markers, not guessed attachments.
  m=s.match(/^(.+?)\s+when\s+(.+)$/i);
  if (m && !/^when\b/i.test(s)) return {type:'if',trigger:'WHEN',condition:parseSentence(m[2],state,ambiguities,opts),consequence:parseSentence(m[1],state,ambiguities,opts)};
  m=s.match(/^(.+?)\s+because\s+(.+)$/i);
  if (m) return {type:'causal',effect:parseSentence(m[1],state,ambiguities,opts),cause:parseSentence(m[2],state,ambiguities,opts)};
  // Full finite clause after BEFORE/AFTER: parse both propositions rather than storing a string adjunct.
  m=s.match(/^(.+?)\s+(before|after)\s+([A-Z]?[A-Za-z_][A-Za-z0-9_.-]*\s+.+)$/i);
  if (m && !/^(?:asking|returning|leaving|arriving|using|running|reviewing|approving)\b/i.test(m[3])) {
    const rel=m[2].toUpperCase();
    return {type:'temporal',relation:rel,left:parseSentence(m[1],state,ambiguities,opts),right:parseSentence(m[3],state,ambiguities,opts)};
  }
  m=s.match(/^(.+?)\s+care(?:s)?\s+more\s+about\s+(.+?)\s+than\s+(.+)$/i);
  if (m) return {type:'comparison',relation:'PREFER_OVER',agent:parseNP(m[1],state,ambiguities,'agent'),left:{kind:'literal',text:cleanSpace(m[2])},right:{kind:'literal',text:cleanSpace(m[3])}};
  m=s.match(/^only\s+(.+?)\s+(must not|must|should not|should|may not|may|cannot|can|will|[A-Za-z'-]+)\s+(.+)$/i);
  if (m) { const focus=parseNP(m[1],state,ambiguities,'focus'); return {type:'only',focus,body:parseSentence(`${refText(focus)} ${m[2]} ${m[3]}`,state,ambiguities,opts)}; }
  const firstTok=lemma(tokenize(s)[0]??'');
  if (IMPERATIVE_VERBS.has(firstTok)) return normalizeDirective(s,'INSTRUCT',state,ambiguities);

  // Not every ...
  m=s.match(/^not\s+every\s+(.+?)\s+(.+)$/i);
  if (m) {
    const type=singularize(m[1]); const v=uid('x');
    return {type:'not',body:{type:'quantifier',quantifier:'FOR_EVERY',var:v,entityType:type,body:parseSentence(`${v} ${m[2]}`,state,ambiguities,{...opts, boundVars:{...(opts.boundVars||{}),[v]:type}})}};
  }

  // Every/each/no/some NP + remainder. Restrict NP to 1-4 words before first likely verb/modal/relative pronoun.
  const toks=tokenize(s);
  const q0=lower(toks[0]??'');
  if (['every','each','all','no','some','a','an'].includes(q0)) {
    let boundary=-1;
    for (let i=1;i<toks.length;i++) {
      const lw=lower(toks[i]);
      if (['who','that','which'].includes(lw) || AUX.has(lw) || looksVerb(toks[i],i,toks)) { boundary=i; break; }
    }
    if (boundary>1) {
      const np=toks.slice(1,boundary).join(' ');
      const rest=toks.slice(boundary).join(' ');
      const entityType=singularize(np);
      const v=uid('x');
      const genericIndefinite = (q0==='a'||q0==='an') && ['who','that','which'].includes(lower(toks[boundary]||'')) && /\b(?:must|should|may|can|will|need(?:s)? to)\b/i.test(rest);
      const quantifier=(q0==='every'||q0==='each'||q0==='all'||genericIndefinite)?'FOR_EVERY':q0==='no'?'FOR_NO':'THERE_EXISTS';
      let body;
      // relative clause: who X ... modal/main predicate
      const rel=rest.match(/^(?:who|that|which)\s+(.+?)\s+(must not|must|should not|should|may not|may|cannot|can|will|needs? to)\s+(.+)$/i);
      if (rel) {
        const cond=parseSentence(`${v} ${rel[1]}`,state,ambiguities,{...opts,boundVars:{...(opts.boundVars||{}),[v]:entityType}});
        const cons=parseSentence(`${v} ${rel[2]} ${rel[3]}`,state,ambiguities,{...opts,boundVars:{...(opts.boundVars||{}),[v]:entityType}});
        body={type:'if',condition:cond,consequence:cons};
      } else {
        body=parseSentence(`${v} ${rest}`,state,ambiguities,{...opts,boundVars:{...(opts.boundVars||{}),[v]:entityType}});
      }
      return {type:'quantifier',quantifier,var:v,entityType,body};
    }
  }

  // Subject relative clause with definite NP: "the researcher who reviewed ... did not approve ..."
  m=s.match(/^(the\s+.+?)\s+who\s+(.+?)\s+(did not|does not|do not|must not|must|should|can|may|will|[A-Za-z'-]+)\s+(.+)$/i);
  if (m) {
    const subj=parseNP(m[1],state,ambiguities,'subject');
    const cond=parseSentence(`${refText(subj)} ${m[2]}`,state,ambiguities,opts);
    const main=parseSentence(`${refText(subj)} ${m[3]} ${m[4]}`,state,ambiguities,opts);
    return {type:'and',items:[cond,main],sharedEntity:subj};
  }

  // Explicit absence of obligation: not(required(...)), distinct from forbidden(...).
  m=s.match(/^(.+?)\s+(?:does|do|did)\s+not\s+have to\s+(.+)$/i);
  if (m) return {type:'not',body:{type:'modal',modality:'REQUIRED',body:parseSentence(`${m[1]} ${m[2]}`,state,ambiguities,opts)}};

  // Explicit negation with auxiliary.
  m=s.match(/^(.+?)\s+(?:does|do|did)\s+not\s+(.+)$/i);
  if (m) return {type:'not',body:parseSentence(`${m[1]} ${m[2]}`,state,ambiguities,opts)};
  m=s.match(/^(.+?)\s+is\s+not\s+(.+)$/i);
  if (m) return {type:'not',body:parseSentence(`${m[1]} is ${m[2]}`,state,ambiguities,opts)};

  // Modal passive: 'the report can be approved'.
  m=s.match(/^(.+?)\s+(must not|must|should not|should|may not|may|cannot|can|could|will)\s+be\s+([A-Za-z'-]+ed|given|sent|shown|known|written|read)$/i);
  if (m) {
    const mm=parseModalPrefix(`${m[1]} ${m[2]} x`);
    const theme=parseRefOrNP(m[1],state,ambiguities,opts.boundVars||{},'theme');
    return {type:'modal',modality:mm?.modality||'POSSIBLE',body:{type:'event',id:uid('ev'),predicate:lemma(m[3]),roles:{theme},modifiers:[]}};
  }

  // Modal in middle: subject MODAL predicate.
  const modal=parseModalPrefix(s);
  if (modal && modal.index>0 && !/\b(?:say|says|said|tell|tells|told|believe|believes|believed|think|thinks|thought|know|knows|knew|report|reports|reported)\b.*\bthat\b/i.test(s.slice(0,modal.index))) {
    const subject=s.slice(0,modal.index).trim();
    const rest=s.slice(modal.index+modal.length).trim();
    return {type:'modal',modality:modal.modality,body:parseSentence(`${subject} ${rest}`,state,ambiguities,opts)};
  }

  // Ditransitive speech report: 'Bob told Alan that ...'.
  m=s.match(/^(.+?)\s+(tells?|told)\s+(.+?)\s+that\s+(.+)$/i);
  if (m) {
    const actor=parseNP(m[1],state,ambiguities,'agent');
    const recipient=parseNP(m[3],state,ambiguities,'recipient');
    return {type:'attitude',predicate:lemma(m[2]),agent:actor,recipient,content:parseSentence(m[4],state,ambiguities,opts)};
  }

  // Complement/speech attitudes.
  m=s.match(/^(.+?)\s+(says?|said|believes?|believed|thinks?|thought|knows?|knew|reports?|reported)\s+that\s+(.+)$/i);
  if (m) {
    const actor=parseNP(m[1],state,ambiguities,'agent');
    return {type:'attitude',predicate:lemma(m[2]),agent:actor,content:parseSentence(m[3],state,ambiguities,opts)};
  }

  // Coordination: only split when both sides look clausal.
  const coord=findClauseCoordination(s);
  if (coord) return {type:coord.word==='and'?'and':'or',items:[parseSentence(coord.left,state,ambiguities,opts),parseSentence(coord.right,state,ambiguities,opts)]};

  return parseAtomic(s,state,ambiguities,opts);
}

function findClauseCoordination(s) {
  const re=/\s+(and|or)\s+/ig; let m;
  while((m=re.exec(s))) {
    const left=s.slice(0,m.index), right=s.slice(m.index+m[0].length);
    const lt=tokenize(left), rt=tokenize(right);
    const lv=lt.some((t,i,a)=>looksVerb(t,i,a)); const rv=rt.some((t,i,a)=>looksVerb(t,i,a));
    if (lv&&rv) return {word:lower(m[1]),left,right};
  }
  return null;
}

function parseAtomic(s,state,ambiguities,opts={}) {
  const boundVars=opts.boundVars||{};
  let toks=tokenize(s).filter(t=>![',',';'].includes(t));
  if (!toks.length) return {type:'raw',text:s};

  // Passive: NP was/were VERBed by NP
  let pm=s.match(/^(.+?)\s+(?:was|were|is|are)\s+([A-Za-z'-]+ed|given|sent|shown|known|written|read)\s+by\s+(.+)$/i);
  if (pm) {
    const theme=parseRefOrNP(pm[1],state,ambiguities,boundVars,'theme');
    const agent=parseRefOrNP(pm[3],state,ambiguities,boundVars,'agent');
    return {type:'event',id:uid('ev'),predicate:lemma(pm[2]),roles:{agent,theme},modifiers:[]};
  }
  pm=s.match(/^(.+?)\s+(?:was|were|is|are)\s+([A-Za-z'-]+ed|given|sent|shown|known|written|read)\s+(.+)$/i);
  if (pm) {
    const theme=parseRefOrNP(pm[1],state,ambiguities,boundVars,'theme');
    const pred=lemma(pm[2]); const {core,mods}=splitAdjuncts(pm[3],pred,ambiguities);
    const roles={theme};
    for(const mod of mods){ if(mod.kind==='location')roles.location=parseRefOrNP(mod.value,state,ambiguities,boundVars,'location'); }
    if(core) roles.complement={kind:'literal',text:core};
    return {type:'event',id:uid('ev'),predicate:pred,roles,modifiers:mods.filter(m=>m.kind!=='location')};
  }

  // Find main lexical verb. Skip auxiliaries if followed by a verb.
  let vi=-1;
  for (let i=0;i<toks.length;i++) {
    const lw=lower(toks[i]);
    if (AUX.has(lw) && i+1<toks.length) { const nx=toks[i+1]; if(looksVerb(nx,i+1,toks) || /(?:ed|ing)$/i.test(nx)) continue; }
    if (looksVerb(toks[i],i,toks)) { vi=i; break; }
  }
  if (vi<1) {
    // Copular fallback if 'is/are' was skipped.
    const ci=toks.findIndex(t=>['is','are','was','were'].includes(lower(t)));
    if (ci>0) vi=ci;
  }
  if (vi<1) return {type:'raw',text:s};

  const subjRaw=toks.slice(0,vi).join(' ');
  const verbRaw=toks[vi];
  const pred=lemma(verbRaw);
  let rest=toks.slice(vi+1).join(' ');
  const subject=(/^(?:this|that)$/i.test(subjRaw) && state.lastProposition)
    ? {kind:'ref',id:state.lastProposition.id,text:`previous proposition ${state.lastProposition.id}`,type:'proposition',pronoun:subjRaw}
    : parseRefOrNP(subjRaw,state,ambiguities,boundVars,'agent');

  // Copula.
  if (['be'].includes(pred)) {
    const complement=rest;
    const npQ=parseQuantifiedObject(complement,state,ambiguities,boundVars);
    if (npQ) return wrapObjectQuantifier(npQ,{type:'event',id:uid('ev'),predicate:'be',roles:{theme:subject,property:{kind:'var',id:npQ.var,text:npQ.entityType}},modifiers:[]});
    return {type:'event',id:uid('ev'),predicate:'be',roles:{theme:subject,property:{kind:'literal',text:complement}},modifiers:[]};
  }

  // Adverb immediately before verb was absorbed into subject; rescue common -ly at end of subject.
  let preModifiers=[];
  const sm=subjRaw.match(/^(.+?)\s+([A-Za-z]+ly)$/i);
  let actualSubject=subject;
  if (sm) { actualSubject=parseRefOrNP(sm[1],state,ambiguities,boundVars,'agent'); preModifiers.push({kind:'manner',value:sm[2]}); }

  // Preserve relative clauses inside quantified objects before looking for adjuncts;
  // otherwise a preposition inside the relative clause can be attached to the outer event.
  if (/^(?:every|each|all|no|some|a|an)\s+.+\b(?:who|that|which)\b/i.test(rest)) {
    const fullObjQ=parseQuantifiedObject(rest,state,ambiguities,boundVars);
    if (fullObjQ) {
      const ev={type:'event',id:uid('ev'),predicate:pred,roles:{agent:actualSubject,theme:{kind:'var',id:fullObjQ.var,text:fullObjQ.entityType}},modifiers:preModifiers};
      return wrapObjectQuantifier(fullObjQ,ev);
    }
  }

  // Extract trailing adjuncts. Greedy from first recognized preposition.
  const {core,mods}=splitAdjuncts(rest,pred,ambiguities);
  rest=core;
  const modifiers=[...preModifiers,...mods];

  // Trailing adverb.
  const adv=rest.match(/^(.+?)\s+([A-Za-z]+ly)$/i);
  if (adv) { rest=adv[1]; modifiers.push({kind:'manner',value:adv[2]}); }

  const roles={agent:actualSubject};
  if (rest) {
    const objQ=parseQuantifiedObject(rest,state,ambiguities,boundVars);
    if (objQ) {
      const event={type:'event',id:uid('ev'),predicate:pred,roles:{...roles,theme:{kind:'var',id:objQ.var,text:objQ.entityType}},modifiers};
      return wrapObjectQuantifier(objQ,event);
    }
    roles.theme=parseRefOrNP(rest,state,ambiguities,boundVars,'theme');
  }

  // Move recognized PP modifiers into roles when semantics are reasonably explicit.
  for (const mod of modifiers) {
    if (mod.kind==='recipient') roles.recipient=parseRefOrNP(mod.value,state,ambiguities,boundVars,'recipient');
    if (mod.kind==='destination') roles.destination=parseRefOrNP(mod.value,state,ambiguities,boundVars,'destination');
    if (mod.kind==='source') roles.source=parseRefOrNP(mod.value,state,ambiguities,boundVars,'source');
    if (mod.kind==='instrument') roles.instrument=parseRefOrNP(mod.value,state,ambiguities,boundVars,'instrument');
    if (mod.kind==='location') roles.location=parseRefOrNP(mod.value,state,ambiguities,boundVars,'location');
    if (mod.kind==='topic') roles.topic={kind:'literal',text:mod.value};
  }
  return {type:'event',id:uid('ev'),predicate:pred,roles,modifiers:modifiers.filter(m=>!['recipient','destination','source','instrument','location','topic'].includes(m.kind))};
}

function parseRefOrNP(raw,state,ambiguities,boundVars,role) {
  raw=cleanSpace(raw);
  if (boundVars[raw]) return {kind:'var',id:raw,text:boundVars[raw]};
  return parseNP(raw,state,ambiguities,role);
}
function refText(ref) { return ref.kind==='var'?ref.id:(ref.text||ref.id||'entity'); }

function parseQuantifiedObject(raw,state,ambiguities,boundVars) {
  const m=cleanSpace(raw).match(/^(every|each|all|no|some|a|an)\s+(.+)$/i);
  if (!m) return null;
  const q=lower(m[1]);
  const desc=cleanSpace(m[2]);
  const relm=desc.match(/^(.+?)\s+(who|that|which)\s+(.+)$/i);
  const type=singularize(desc.replace(/\s+(?:who|that|which)\s+.*$/i,'').trim()); const v=uid('x');
  const ent={id:v,label:type,type:inferType(type),role:'discourse',lastSeen:state.turnIndex,number:'singular'};
  if(!state.entities.some(e=>e.id===v)) state.entities.push(ent);
  let restriction=null;
  if(relm) restriction=parseSentence(`${v} ${relm[3]}`,state,ambiguities,{boundVars:{...(boundVars||{}),[v]:type}});
  return {quantifier:(q==='every'||q==='each'||q==='all')?'FOR_EVERY':q==='no'?'FOR_NO':'THERE_EXISTS',var:v,entityType:type,description:desc,restriction};
}
function wrapObjectQuantifier(q,event) {
  const body=q.restriction?{type:'and',items:[event,q.restriction]}:event;
  return {type:'quantifier',quantifier:q.quantifier,var:q.var,entityType:q.entityType,body};
}

function splitAdjuncts(rest,pred,ambiguities) {
  const patterns=[' using ',' with ',' into ',' to ',' from ',' within ',' before ',' after ',' during ',' until ',' without ',' about ',' in ',' on ',' at ',' for ',' by '];
  let first=-1, prep=null;
  const l=' '+lower(rest)+' ';
  for (const p of patterns) { const i=l.indexOf(p); if(i>=0&&(first<0||i<first)){first=i;prep=p.trim();} }
  if (first<0) return {core:cleanSpace(rest),mods:[]};
  // Compensate for the leading space added above.
  const cut=Math.max(0,first-1);
  const core=cleanSpace(rest.slice(0,cut));
  const tail=cleanSpace(rest.slice(cut));
  const mods=[];
  const re=/\b(using|with|into|to|from|within|before|after|during|until|without|about|in|on|at|for|by)\s+(.+?)(?=\s+\b(?:using|with|into|to|from|within|before|after|during|until|without|about|in|on|at|for|by)\b\s+|$)/ig;
  let m;
  while((m=re.exec(tail))) {
    const p=lower(m[1]), value=cleanSpace(m[2]);
    if (p==='using') mods.push({kind:'instrument',value});
    else if (p==='to') {
      if (RECIPIENT_VERBS.has(pred)) mods.push({kind:'recipient',value});
      else if (MOVEMENT_VERBS.has(pred)) mods.push({kind:'destination',value});
      else { mods.push({kind:'to',value}); ambiguities.push({id:uid('a'),kind:'semantic_role',severity:'medium',span:`to ${value}`,message:`Role of 'to ${value}' is not determined by the verb '${pred}'.`,options:['recipient','destination','purpose/other'],question:`What role does 'to ${value}' have?`}); }
    }
    else if (p==='into') mods.push({kind:'destination',value});
    else if (p==='from') mods.push({kind:'source',value});
    else if (p==='about') mods.push({kind:'topic',value});
    else if (p==='within') { const k=/\b(?:second|minute|hour|day|week|month|year)s?\b/i.test(value)?'deadline':'tolerance'; mods.push({kind:k,value}); }
    else if (p==='before'||p==='after'||p==='during'||p==='until') mods.push({kind:'time_relation',relation:p,value});
    else if (p==='without') mods.push({kind:'exclusion',value});
    else if (p==='with') { mods.push({kind:'with',value}); /* ambiguity already flagged */ }
    else if (p==='for') mods.push({kind:'for',value});
    else if (p==='by') { const k=/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|\d{4}|\d{1,2}:\d{2})\b/i.test(value)?'deadline':'by'; mods.push({kind:k,value}); }
    else if (['in','on','at'].includes(p)) {
      const kind=/\b(?:\d{1,2}:\d{2}|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|yesterday|morning|afternoon|evening|night|\d{4})\b/i.test(value)?'time':'location';
      mods.push({kind,value});
    }
  }
  return {core,mods};
}

function normalizeQuestion(text,state,ambiguities) {
  let s=stripPunct(text);
  let given=null;
  if (/^given that,?\s+/i.test(s)) { given=state.lastProposition?.id||null; s=s.replace(/^given that,?\s+/i,''); }
  let m=s.match(/^what\s+should\s+happen\s+if\s+(.+)$/i);
  if (m) return {type:'query',queryKind:'WHAT_SHOULD_HAPPEN',context:given,condition:parseSentence(m[1],state,ambiguities)};
  m=s.match(/^which\s+of\s+(those|these|the)\s+(.+?)\s+([A-Za-z'-]+)\s+(.+)$/i);
  if (m) { const v=uid('x'); return {type:'query',queryKind:'WHICH_FROM_SET',var:v,entityType:singularize(m[2]),setRef:m[1],body:parseSentence(`${v} ${m[3]} ${m[4]}`,state,ambiguities,{boundVars:{[v]:singularize(m[2])}})}; }
  m=s.match(/^how many\s+(.+?)(?:\s+(?:were|are|was|is)\s+(.+))?$/i);
  if (m) return {type:'query',queryKind:'COUNT',entityType:singularize(m[1]),body:m[2]?{type:'raw',text:m[2]}:null};
  m=s.match(/^which\s+(.+?)\s+([A-Za-z'-]+)\s+(.+)$/i);
  if (m) {
    const type=singularize(m[1]), v=uid('x');
    return {type:'query',queryKind:'WHICH',var:v,entityType:type,context:given,body:parseSentence(`${v} ${m[2]} ${m[3]}`,state,ambiguities,{boundVars:{[v]:type}})};
  }
  m=s.match(/^who\s+([A-Za-z'-]+)\s+(.+)$/i);
  if (m) { const v=uid('x'); return {type:'query',queryKind:'WHO',var:v,entityType:'person',body:parseSentence(`${v} ${m[1]} ${m[2]}`,state,ambiguities,{boundVars:{[v]:'person'}})}; }
  m=s.match(/^what\s+(?:did|does|do)\s+(.+?)\s+([A-Za-z'-]+)(?:\s+(.+))?$/i);
  if (m) { const v=uid('x'); const subj=m[1], pred=m[2], tail=m[3]||''; return {type:'query',queryKind:'WHAT',var:v,entityType:'entity',body:parseSentence(`${subj} ${pred} ${v} ${tail}`,state,ambiguities,{boundVars:{[v]:'entity'}})}; }
  m=s.match(/^(when|where|why|how)\s+(?:did|does|do|will|should|can|could|must)\s+(.+)$/i);
  if (m) return {type:'query',queryKind:m[1].toUpperCase(),body:{type:'raw',text:m[2]}};
  // yes/no inversion -> retain explicit query wrapper, parse a normalized approximation.
  m=s.match(/^(is|are|was|were|do|does|did|can|could|should|would|will|must|may|has|have)\s+(.+)$/i);
  if (m) {
    const aux=lower(m[1]); let bodyText=m[2];
    if (['do','does','did'].includes(aux)) {
      // "Did Ada approve the report" -> "Ada approve the report"
      bodyText=m[2];
    } else if (['is','are','was','were'].includes(aux)) {
      const t=tokenize(m[2]); if(t.length>=2) bodyText=`${t[0]} ${aux} ${t.slice(1).join(' ')}`;
    } else {
      const t=tokenize(m[2]); if(t.length>=2) bodyText=`${t[0]} ${aux} ${t.slice(1).join(' ')}`;
    }
    return {type:'query',queryKind:'WHETHER',body:parseSentence(bodyText,state,ambiguities)};
  }
  return {type:'query',queryKind:'OPEN',body:{type:'raw',text:s}};
}

function normalizeDirective(text,act,state,ambiguities) {
  let s=stripPunct(text);
  s=s.replace(/^(?:now|finally|then|otherwise)[:,]?\s+/i,'');
  s=s.replace(/^please\s+/i,'');
  const negativeImperative=/^(?:do not|don't|never)\s+/i.test(s);
  s=s.replace(/^(?:do not|don't|never)\s+/i,'');
  if (negativeImperative) return {type:'not',body:normalizeDirective(s,act,state,ambiguities)};
  s=s.replace(/^(?:can|could|would|will) you\s+/i,'');
  s=s.replace(/^(?:i want|i need|i would like) you to\s+/i,'');
  let m=s.match(/^choose\s+the\s+([A-Za-z-]+)\s+where\s+(.+)$/i);
  if (m) { const v=uid('x'); return {type:'directive',operator:'choose',addressee:state.addressee,body:{type:'selector',entityType:singularize(m[1]),var:v,body:parseSentence(m[2],state,ambiguities)}}; }
  m=s.match(/^consider\s*:\s*(.+)$/i);
  if (m) return {type:'directive',operator:'consider',addressee:state.addressee,body:parseSentence(m[1],state,ambiguities)};
  m=s.match(/^tell\s+me\s+whether\s+(.+)$/i);
  if (m) return {type:'directive',operator:'tell',addressee:state.addressee,body:{type:'query',queryKind:'WHETHER',body:parseSentence(m[1],state,ambiguities)}};
  // Special search/list form.
  m=s.match(/^(find|list|show|return)\s+(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+)?(.+)$/i);
  if (m) {
    const count=m[2]||null; const rest=m[3];
    return {type:'directive',operator:lemma(m[1]),addressee:state.addressee,count,body:parseSearchSpec(rest,state,ambiguities)};
  }
  m=s.match(/^compare\s+(.+?)\s+on\s+(.+)$/i);
  if (m) return {type:'directive',operator:'compare',addressee:state.addressee,target:{kind:'literal',text:m[1]},dimension:m[2]};
  m=s.match(/^(compare)\s+(.+?)\s+(?:and|with|to)\s+(.+?)(?:\s+on\s+(.+))?$/i);
  if (m) return {type:'directive',operator:'compare',addressee:state.addressee,items:[parseNP(m[2],state,ambiguities),parseNP(m[3],state,ambiguities)],dimension:m[4]||null};
  m=s.match(/^summarize\s+(.+?)\s+in\s+no more than\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+sentences?$/i);
  if (m) return {type:'directive',operator:'summarize',addressee:state.addressee,body:parseSentence(`${state.addressee} summarize ${m[1]}`,state,ambiguities),constraints:[{kind:'max_sentences',value:m[2]}]};
  m=s.match(/^(summarize|explain|evaluate|test|run|generate|create|write|translate|formalize|check|use|exclude|include|keep|remove|select|filter|clarify|define|apply|consider|infer|resolve)\s+(.+)$/i);
  if (m) return {type:'directive',operator:lemma(m[1]),addressee:state.addressee,body:parseSentence(`${state.addressee} ${m[1]} ${m[2]}`,state,ambiguities)};
  return {type:'directive',operator:'do',addressee:state.addressee,body:parseSentence(`${state.addressee} ${s}`,state,ambiguities)};
}

function parseSearchSpec(rest,state,ambiguities) {
  // "papers about semantic parsing published after 2022 that do not use synthetic data"
  let type=rest; const constraints=[];
  const m=rest.match(/^([A-Za-z][A-Za-z -]*?)(?=\s+(?:about|published|written|with|without|that|which|from|after|before|in)\b|$)(.*)$/i);
  if (m) { type=singularize(cleanSpace(m[1])); let tail=cleanSpace(m[2]);
    let x;
    if ((x=tail.match(/\babout\s+(.+?)(?=\s+\b(?:published|written|with|without|that|which|from|after|before|in)\b|$)/i))) constraints.push({kind:'topic',value:cleanSpace(x[1])});
    if ((x=tail.match(/\bpublished\s+after\s+(\d{4})\b/i))) constraints.push({kind:'published_after',value:x[1]});
    if ((x=tail.match(/\bpublished\s+before\s+(\d{4})\b/i))) constraints.push({kind:'published_before',value:x[1]});
    if ((x=tail.match(/\bwithout\s+(.+)$/i))) constraints.push({kind:'without',value:cleanSpace(x[1])});
    if ((x=tail.match(/\bthat\s+do\s+not\s+(.+)$/i))) constraints.push({kind:'not',value:cleanSpace(x[1])});
  }
  return {type:'search',entityType:type,constraints};
}


function collectRaw(node,out=[]) {
  if(!node||typeof node!=='object') return out;
  if(node.type==='raw' && node.text) out.push(node.text);
  for(const v of Object.values(node)) { if(Array.isArray(v)) for(const x of v)collectRaw(x,out); else if(v&&typeof v==='object')collectRaw(v,out); }
  return out;
}
function collectRoleResidues(node,out=[]) {
  if(!node||typeof node!=='object') return out;
  if(node.type==='event') for(const [role,r] of Object.entries(node.roles||{})) if(r?.text) {
    if (/\b(?:if|when|because|whether|who|which|that|before|after|until|while|otherwise|where|without)\b/i.test(r.text) || /:/.test(r.text)) out.push({role,text:r.text});
    else { const ts=tokenize(r.text); const vc=ts.filter((t,i,a)=>looksVerb(t,i,a)).length; if(ts.length>=5 && vc>=1) out.push({role,text:r.text}); }
  }
  for(const v of Object.values(node)) { if(Array.isArray(v)) for(const x of v)collectRoleResidues(x,out); else if(v&&typeof v==='object')collectRoleResidues(v,out); }
  return out;
}
function postParseUncertainty(source,content) {
  const a=[];
  for(const raw of collectRaw(content)) a.push({id:uid('a'),kind:'coverage_gap',severity:'high',span:raw,message:'The symbolic parser did not formalize this fragment; an LLM/helper or new rule is required.',options:[],question:`Formalize this unresolved fragment: ${raw}`});
  for(const r of collectRoleResidues(content)) a.push({id:uid('a'),kind:'structural_residue',severity:'high',span:r.text,message:`Clause marker survived inside role ${r.role}; the parse may have collapsed structure into a string.`,options:[],question:`Clarify the internal clause structure of: ${r.text}`});
  const operators=[['at least','cardinality'],['at most','cardinality'],['no more than','cardinality'],['less than','comparison'],['whether','embedded_question'],['otherwise','alternative'],['because','causal_scope'],['so that','purpose'],['given that','discourse_relation']];
  const rendered=JSON.stringify(content).toLowerCase();
  for(const [phrase,kind] of operators) {
    const dedicated=(kind==='cardinality' && /max_sentences|min_count|max_count|limit/.test(rendered));
    if(lower(source).includes(phrase) && !dedicated) a.push({id:uid('a'),kind:'operator_not_formalized',severity:'medium',span:phrase,message:`Operator '${phrase}' appears in the source but has no dedicated symbolic form in this parse.`,options:[]});
  }
  if(/\bmore than\b/i.test(source) && !/\bno more than\b/i.test(source) && !rendered.includes('comparison')) a.push({id:uid('a'),kind:'operator_not_formalized',severity:'medium',span:'more than',message:"Comparison 'more than' is not explicitly structured in this parse.",options:[]});
  return a;
}

function parseTurn(text,state,{speaker='user',addressee='assistant',turnId=null}={}) {
  state.turnIndex += 1; state.speaker=speaker; state.addressee=addressee;
  const id=turnId||`t${state.turnIndex}`;
  const act=classifyAct(text);
  let ambiguities=detectSymbolicRisks(text,state);
  let content;
  if (act==='ASK') content=normalizeQuestion(text,state,ambiguities);
  else if (act==='REQUEST'||act==='INSTRUCT') content=normalizeDirective(text,act,state,ambiguities);
  else if (act==='PROPOSE') content=normalizeDirective(text.replace(/^let(?:'s| us)\s+/i,''),'PROPOSE',state,ambiguities);
  else if (act==='STATE_GOAL') {
    const body=stripPunct(text).replace(/^(?:we|i) (?:need|want|plan|intend) to\s+/i,'');
    content={type:'goal',body:parseSentence(`${speaker} ${body}`,state,ambiguities)};
  } else if (act==='PREFERENCE') {
    const body=stripPunct(text).replace(/^i prefer\s+/i,''); content={type:'preference',body:{type:'raw',text:body}};
  } else if (act==='REJECT_OR_CORRECT') {
    const isMean=/^i mean\s+/i.test(stripPunct(text));
    const body=stripPunct(text).replace(/^(?:no|nope|incorrect|wrong)[,:]?\s*/i,'').replace(/^i mean\s+/i,'');
    content={type:'correction',body:body?(isMean?{type:'resolution_hint',value:body}:parseSentence(body,state,ambiguities)):null};
  } else if (act==='CONFIRM') content={type:'confirm',target:state.lastProposition?.id||null};
  else content=parseSentence(text,state,ambiguities);

  // Drop a preliminary pronoun warning when parsing itself found one unique referent.
  ambiguities.push(...postParseUncertainty(text,content));
  ambiguities=ambiguities.filter(a=>!(a.kind==='anaphora' && hasResolvedPronoun(content,lower(a.span)) && !hasUnresolvedPronoun(content,lower(a.span))));
  ambiguities=dedupeAmbiguities(ambiguities);
  const riskPenalty=ambiguities.reduce((n,a)=>n+(a.severity==='high'?0.18:a.severity==='medium'?0.09:0.03),0);
  const rawPenalty=countNodes(content,n=>n.type==='raw')*0.12;
  const confidence=Math.max(0.05,Math.min(0.98,0.94-riskPenalty-rawPenalty));
  const proposition={id:uid('p'),turn:id,content}; state.propositions.push(proposition); state.lastProposition=proposition;
  return {id,source:text,speaker,addressee,act,content,ambiguities,confidence:Number(confidence.toFixed(2)),cnl:renderTurn({id,speaker,addressee,act,content,ambiguities,confidence})};
}


function hasResolvedPronoun(node,p) {
  if(!node||typeof node!=='object') return false;
  if(node.kind==='ref' && node.pronoun && lower(node.pronoun)===p) return true;
  return Object.values(node).some(v=>Array.isArray(v)?v.some(x=>hasResolvedPronoun(x,p)):(v&&typeof v==='object'&&hasResolvedPronoun(v,p)));
}
function hasUnresolvedPronoun(node,p) {
  if(!node||typeof node!=='object') return false;
  if(node.kind==='unresolved_ref' && lower(node.text||'')===p) return true;
  return Object.values(node).some(v=>Array.isArray(v)?v.some(x=>hasUnresolvedPronoun(x,p)):(v&&typeof v==='object'&&hasUnresolvedPronoun(v,p)));
}

function countNodes(node,pred) {
  if (!node||typeof node!=='object') return 0; let n=pred(node)?1:0;
  for (const v of Object.values(node)) { if(Array.isArray(v)) for(const x of v)n+=countNodes(x,pred); else if(v&&typeof v==='object')n+=countNodes(v,pred); }
  return n;
}

function formalizeText(text, options={}) {
  globalId=0; const state=options.state||newState();
  const sentences=splitSentences(text);
  return sentences.map((s,i)=>parseTurn(s,state,{...options,turnId:options.turnId?`${options.turnId}.${i+1}`:null}));
}
function formalizeConversation(turns, options={}) {
  globalId=0; const state=options.state||newState(); const out=[];
  for (let i=0;i<turns.length;i++) {
    const t=typeof turns[i]==='string'?{text:turns[i]}:turns[i];
    out.push(parseTurn(t.text,state,{speaker:t.speaker||'user',addressee:t.addressee||'assistant',turnId:t.id||`t${i+1}`}));
  }
  return {turns:out,state:snapshotState(state)};
}
function snapshotState(state) {
  return {turnIndex:state.turnIndex,entities:state.entities.map(e=>({...e})),propositions:state.propositions.map(p=>({id:p.id,turn:p.turn}))};
}

function renderTurn(turn) {
  const lines=[`TURN ${turn.id}:`,`  ACT ${turn.act}`];
  if (turn.speaker) lines.push(`  SPEAKER ${quoteAtom(turn.speaker)}`);
  if (turn.addressee && ['REQUEST','INSTRUCT','PROPOSE'].includes(turn.act)) lines.push(`  ADDRESSEE ${quoteAtom(turn.addressee)}`);
  lines.push('  CONTENT:');
  lines.push(...renderNode(turn.content,2));
  if (turn.ambiguities?.length) {
    lines.push('  AMBIGUITIES:');
    for (const a of turn.ambiguities) {
      lines.push(`    - ${a.id} ${a.severity.toUpperCase()} ${a.kind}: ${JSON.stringify(a.span)}`);
      if (a.options?.length) lines.push(`      OPTIONS: ${a.options.map(quoteAtom).join(' | ')}`);
      if (a.question) lines.push(`      ASK: ${JSON.stringify(a.question)}`);
    }
  }
  lines.push(`  CONFIDENCE ${turn.confidence.toFixed(2)}`);
  return lines.join('\n');
}
function quoteAtom(x) { x=String(x??''); return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(x)?x:JSON.stringify(x); }
function renderRef(r) {
  if (!r) return 'UNKNOWN';
  if (r.kind==='var') return `${r.id}:${quoteAtom(r.text)}`;
  if (r.kind==='ref') return `${r.id}:${JSON.stringify(r.text)}`;
  if (r.kind==='literal') return JSON.stringify(r.text);
  if (r.kind==='unresolved_ref') return `UNRESOLVED_REF(${JSON.stringify(r.text)})`;
  return JSON.stringify(r.text||'UNKNOWN');
}
function renderNode(node,indent=0) {
  const p='  '.repeat(indent); if(!node)return [`${p}UNKNOWN`];
  switch(node.type) {
    case 'if': return [`${p}IF:`,...renderNode(node.condition,indent+1),`${p}THEN:`,...renderNode(node.consequence,indent+1)];
    case 'if_else': return [`${p}IF:`,...renderNode(node.condition,indent+1),`${p}THEN:`,...renderNode(node.then,indent+1),`${p}ELSE:`,...renderNode(node.else,indent+1)];
    case 'even_if': return [`${p}EVEN_IF:`,...renderNode(node.condition,indent+1),`${p}STILL:`,...renderNode(node.body,indent+1)];
    case 'not': return [`${p}NOT:`,...renderNode(node.body,indent+1)];
    case 'only': return [`${p}ONLY ${renderRef(node.focus)}:`,...renderNode(node.body,indent+1)];
    case 'modal': return [`${p}${node.modality}:`,...renderNode(node.body,indent+1)];
    case 'quantifier': return [`${p}${node.quantifier} ${node.entityType} ${node.var}:`,...renderNode(node.body,indent+1)];
    case 'and': return [`${p}AND:`,...node.items.flatMap(x=>renderNode(x,indent+1))];
    case 'or': return [`${p}OR:`,...node.items.flatMap(x=>renderNode(x,indent+1))];
    case 'attitude': { const a=[`${p}ATTITUDE ${node.predicate}:`,`${p}  AGENT ${renderRef(node.agent)}`]; if(node.recipient)a.push(`${p}  RECIPIENT ${renderRef(node.recipient)}`); a.push(`${p}  CONTENT:`,...renderNode(node.content,indent+2)); return a; }
    case 'temporal': return [`${p}${node.relation}:`,`${p}  LEFT:`,...renderNode(node.left,indent+2),`${p}  RIGHT:`,...renderNode(node.right,indent+2)];
    case 'causal': return [`${p}BECAUSE:`,...renderNode(node.cause,indent+1),`${p}THEREFORE:`,...renderNode(node.effect,indent+1)];
    case 'comparison': return [`${p}${node.relation}:`,`${p}  AGENT ${renderRef(node.agent)}`,`${p}  LEFT ${renderRef(node.left)}`,`${p}  RIGHT ${renderRef(node.right)}`];
    case 'event': {
      const a=[`${p}EVENT ${node.id} ${quoteAtom(node.predicate)}:`];
      for (const [k,v] of Object.entries(node.roles||{})) a.push(`${p}  ${k.toUpperCase()} ${renderRef(v)}`);
      for (const m of node.modifiers||[]) a.push(`${p}  ${renderModifier(m)}`);
      return a;
    }
    case 'query': {
      const head=node.var?`${p}ASK ${node.queryKind} ${node.entityType||'entity'} ${node.var}${node.setRef?` FROM ${node.setRef}`:''}:`:`${p}ASK ${node.queryKind}${node.entityType?` ${node.entityType}`:''}:`;
      const a=[head]; if(node.context)a.push(`${p}  GIVEN ${node.context}`); if(node.condition)a.push(`${p}  IF:`,...renderNode(node.condition,indent+2)); if(node.body)a.push(...renderNode(node.body,indent+1)); return a;
    }
    case 'directive': {
      const a=[`${p}DIRECTIVE ${node.operator.toUpperCase()} TO ${quoteAtom(node.addressee)}`];
      if(node.count)a.push(`${p}  LIMIT ${quoteAtom(node.count)}`);
      if(node.target)a.push(`${p}  TARGET ${renderRef(node.target)}`);
      if(node.constraints) for(const c of node.constraints)a.push(`${p}  CONSTRAINT ${c.kind.toUpperCase()} ${quoteAtom(c.value)}`);
      if(node.items) for(const it of node.items)a.push(`${p}  ITEM ${renderRef(it)}`);
      if(node.dimension)a.push(`${p}  ON ${JSON.stringify(node.dimension)}`);
      if(node.body)a.push(`${p}  BODY:`,...renderNode(node.body,indent+2));
      return a;
    }
    case 'selector': return [`${p}SELECT ${node.entityType} ${node.var} WHERE:`,...renderNode(node.body,indent+1)];
    case 'search': {
      const a=[`${p}FIND ${node.entityType} x:`];
      for(const c of node.constraints||[])a.push(`${p}  ${c.kind.toUpperCase()} ${JSON.stringify(c.value)}`);
      return a;
    }
    case 'goal': return [`${p}GOAL:`,...renderNode(node.body,indent+1)];
    case 'preference': return [`${p}PREFERENCE ${JSON.stringify(node.body?.text||'')}`];
    case 'correction': return node.body?[`${p}CORRECT:`,...renderNode(node.body,indent+1)]:[`${p}REJECT_PREVIOUS`];
    case 'resolution_hint': return [`${p}RESOLVE_REFERENCE_AS ${JSON.stringify(node.value)}`];
    case 'confirm': return [`${p}CONFIRM ${node.target||'PREVIOUS'}`];
    case 'raw': return [`${p}UNRESOLVED ${JSON.stringify(node.text)}`];
    default: return [`${p}UNRESOLVED ${JSON.stringify(node)}`];
  }
}
function renderModifier(m) {
  if(m.kind==='time_relation')return `TIME_${m.relation.toUpperCase()} ${JSON.stringify(m.value)}`;
  return `${m.kind.toUpperCase()} ${JSON.stringify(m.value)}`;
}

// A compact payload meant for an external/LLM ambiguity helper. It asks for resolutions only,
// not a free rewrite. This keeps the symbolic parser authoritative about what it knows it does not know.
function makeResolutionRequest(turn, contextSnapshot) {
  return {
    task:'resolve_nl2cnl_ambiguities',
    source:turn.source,
    candidate_cnl:turn.cnl,
    ambiguities:turn.ambiguities.map(a=>({id:a.id,kind:a.kind,span:a.span,options:a.options||[],question:a.question||a.message})),
    recent_entities:(contextSnapshot?.entities||[]).slice(-8).map(e=>({id:e.id,label:e.label,type:e.type})),
    instruction:'Resolve only listed ambiguities when context supports a choice. Return JSON: {resolutions:[{id,choice,reason,confidence}], unresolved:[id]}. Do not invent facts.'
  };
}


// --- v0.3 helper policy and batching -------------------------------------------------
const HELPER_RANK = {none:0, low:1, medium:2, high:3};

function walk(node, fn) {
  if (!node || typeof node !== 'object') return;
  fn(node);
  for (const v of Object.values(node)) {
    if (Array.isArray(v)) for (const x of v) walk(x, fn);
    else if (v && typeof v === 'object') walk(v, fn);
  }
}
function hasNode(node, pred) { let yes=false; walk(node,n=>{if(pred(n))yes=true;}); return yes; }
function hasUnresolvedStructure(node) {
  return hasNode(node,n=>n.type==='raw'||n.kind==='unresolved_ref');
}
function ambiguityNeedsHelper(turn, ambiguity) {
  const k=ambiguity.kind;
  // These are warnings about constructions for which the candidate AST can itself prove
  // that an explicit operator survived. They remain audit annotations, not helper calls.
  if (k==='only_scope' && hasNode(turn.content,n=>n.type==='only')) return false;
  if (k==='negation_scope' && hasNode(turn.content,n=>n.type==='not'||n.type==='modal')) return false;
  if (k==='temporal_attachment' && hasNode(turn.content,n=>n.type==='temporal'||(n.type==='if'&&n.trigger==='WHEN')||(n.type==='event'&&(n.modifiers||[]).some(m=>m.kind==='time_relation'||m.kind==='deadline'))||n.type==='search')) return false;
  if (k==='quantifier_scope' && hasNode(turn.content,n=>n.type==='quantifier')) return false;
  if (k==='generic_indefinite' && hasNode(turn.content,n=>n.type==='quantifier'&&n.quantifier==='FOR_EVERY')) return false;
  if (k==='anaphora') {
    const sp=lower(ambiguity.span||'');
    if (hasResolvedPronoun(turn.content,sp) && !hasUnresolvedPronoun(turn.content,sp)) return false;
    if (hasNode(turn.content,n=>n.type==='query'&&n.setRef&&lower(n.setRef)===sp)) return false;
  }
  if (k==='definition_or_rule_scope' && hasNode(turn.content,n=>n.type==='if')) return false;
  if (k==='operator_not_formalized' && ((ambiguity.span==='because'&&hasNode(turn.content,n=>n.type==='causal')) || (ambiguity.span==='otherwise'&&hasNode(turn.content,n=>n.type==='if_else')) || (ambiguity.span==='whether'&&hasNode(turn.content,n=>n.type==='query'&&n.queryKind==='WHETHER')) || (ambiguity.span==='given that'&&hasNode(turn.content,n=>n.type==='query'&&n.context)))) return false;
  // Low vagueness is preserved as a caveat; it is not worth an LLM call by default.
  if (k==='vagueness') return false;
  return true;
}
function helperIssues(turn, {minSeverity='medium'}={}) {
  const min=HELPER_RANK[minSeverity] ?? HELPER_RANK.medium;
  return (turn.ambiguities||[]).filter(a=>ambiguityNeedsHelper(turn,a) && (HELPER_RANK[a.severity]??0)>=min);
}
function needsHelper(turn, options={}) { return helperIssues(turn,options).length>0; }

function compactContext(turns, index, radius=2) {
  const lo=Math.max(0,index-radius), hi=Math.min(turns.length,index+radius+1);
  return turns.slice(lo,hi).map(t=>({id:t.id,source:t.source,act:t.act,cnl:t.cnl}));
}

function buildBatchHelperRequests(conversation, {minSeverity='medium', maxItems=100, maxChars=250000, contextRadius=2}={}) {
  const turns=conversation.turns||conversation;
  const items=[];
  for (let i=0;i<turns.length;i++) {
    const t=turns[i], issues=helperIssues(t,{minSeverity});
    if (!issues.length) continue;
    items.push({
      turn_id:t.id,
      source:t.source,
      speech_act:t.act,
      candidate_content:t.content,
      candidate_cnl:t.cnl,
      confidence:t.confidence,
      issues:issues.map(a=>({id:a.id,kind:a.kind,severity:a.severity,span:a.span,question:a.question||a.message,options:a.options||[]})),
      context:compactContext(turns,i,contextRadius)
    });
  }
  const batches=[]; let cur=[], chars=0;
  for (const item of items) {
    const size=JSON.stringify(item).length;
    if (cur.length && (cur.length>=maxItems || chars+size>maxChars)) { batches.push(cur); cur=[]; chars=0; }
    cur.push(item); chars+=size;
  }
  if (cur.length) batches.push(cur);
  return batches.map((batch,bi)=>({
    protocol:'nl2cnl-helper/1', batch_id:`batch-${bi+1}`,
    task:'repair_or_accept_nl2cnl_candidates',
    instructions:[
      'For each item, preserve exactly the meaning and conversational intent of source in context.',
      'Resolve only what context licenses; never invent missing facts.',
      'Return one result per turn_id.',
      'status=accept means candidate_content is semantically adequate.',
      'status=replace requires a complete replacement content AST using only the documented node shapes.',
      'status=unresolved means context is insufficient; include a concise question.',
      'Do not return prose outside the JSON object.'
    ],
    allowed_status:['accept','replace','unresolved'],
    response_shape:{protocol:'nl2cnl-helper/1',batch_id:`batch-${bi+1}`,results:[{turn_id:'...',status:'accept|replace|unresolved',content:'required only for replace',confidence:0.0,reason:'...',question:'required only for unresolved'}]},
    items:batch
  }));
}

const ALLOWED_NODE_TYPES = new Set(['if','if_else','even_if','not','only','modal','quantifier','and','or','attitude','temporal','causal','comparison','event','query','directive','selector','search','goal','preference','correction','resolution_hint','confirm','raw']);
function validateAst(node, path='content') {
  const errors=[];
  function rec(n,p) {
    if (!n || typeof n!=='object' || Array.isArray(n)) { errors.push(`${p}: expected object`); return; }
    if (!ALLOWED_NODE_TYPES.has(n.type)) errors.push(`${p}: unsupported node type ${JSON.stringify(n.type)}`);
    for (const [k,v] of Object.entries(n)) {
      if (k==='type') continue;
      if (Array.isArray(v)) for (let i=0;i<v.length;i++) if (v[i]&&typeof v[i]==='object'&&!['roles','modifiers','constraints','items'].includes(k)) rec(v[i],`${p}.${k}[${i}]`);
      else if (v && typeof v==='object' && !['roles'].includes(k)) {
        // role/ref/modifier objects are data records, not AST nodes unless they carry a type.
        if (v.type && ALLOWED_NODE_TYPES.has(v.type)) rec(v,`${p}.${k}`);
      }
    }
    if (n.type==='event' && typeof n.predicate!=='string') errors.push(`${p}: event.predicate must be string`);
    if (n.type==='modal' && typeof n.modality!=='string') errors.push(`${p}: modal.modality must be string`);
    if (n.type==='quantifier' && (!n.var||!n.entityType||!n.body)) errors.push(`${p}: quantifier requires var, entityType, body`);
  }
  rec(node,path); return errors;
}

function validateBatchHelperResponse(request, response) {
  const errors=[];
  if (!response || response.protocol!=='nl2cnl-helper/1') errors.push('protocol mismatch');
  if (response?.batch_id!==request.batch_id) errors.push('batch_id mismatch');
  const expected=new Set(request.items.map(x=>x.turn_id));
  const seen=new Set();
  for (const r of response?.results||[]) {
    if (!expected.has(r.turn_id)) errors.push(`unexpected turn_id ${r.turn_id}`);
    if (seen.has(r.turn_id)) errors.push(`duplicate turn_id ${r.turn_id}`); seen.add(r.turn_id);
    if (!['accept','replace','unresolved'].includes(r.status)) errors.push(`${r.turn_id}: bad status`);
    if (r.status==='replace') errors.push(...validateAst(r.content,`${r.turn_id}.content`));
    if (r.status==='unresolved' && !r.question) errors.push(`${r.turn_id}: unresolved requires question`);
    if (r.confidence!=null && (typeof r.confidence!=='number'||r.confidence<0||r.confidence>1)) errors.push(`${r.turn_id}: confidence must be 0..1`);
  }
  for (const id of expected) if (!seen.has(id)) errors.push(`missing result for ${id}`);
  return {ok:errors.length===0,errors};
}

function applyBatchHelperResponse(conversation, request, response) {
  const vr=validateBatchHelperResponse(request,response); if(!vr.ok) throw new Error(`Invalid helper response: ${vr.errors.join('; ')}`);
  const byId=new Map(response.results.map(r=>[r.turn_id,r]));
  const turns=(conversation.turns||conversation).map(t=>{
    const r=byId.get(t.id); if(!r) return {...t,final_content:t.content,final_cnl:t.cnl,helper_status:'not_requested'};
    if(r.status==='replace') {
      const final={...t,content:r.content,ambiguities:[],confidence:Number((r.confidence??0.8).toFixed(2))};
      final.cnl=renderTurn(final);
      return {...t,final_content:r.content,final_cnl:final.cnl,helper_status:'replaced',helper_reason:r.reason||'',helper_confidence:r.confidence??null};
    }
    if(r.status==='accept') return {...t,final_content:t.content,final_cnl:t.cnl,helper_status:'accepted',helper_reason:r.reason||'',helper_confidence:r.confidence??null};
    return {...t,final_content:t.content,final_cnl:t.cnl,helper_status:'unresolved',helper_reason:r.reason||'',helper_question:r.question||'',helper_confidence:r.confidence??null};
  });
  return {turns,state:conversation.state||null};
}

function summarizeHelperLoad(conversation, {minSeverity='medium',maxItems=100,maxChars=250000,contextRadius=2}={}) {
  const turns=conversation.turns||conversation;
  const uncertain=turns.filter(t=>needsHelper(t,{minSeverity}));
  const batches=buildBatchHelperRequests(conversation,{minSeverity,maxItems,maxChars,contextRadius});
  return {turns:turns.length,turns_needing_helper:uncertain.length,helper_fraction:turns.length?uncertain.length/turns.length:0,batches:batches.length,items_per_batch:batches.map(b=>b.items.length)};
}


function collectSemanticInventory(node) {
  const inv={nodeTypes:new Set(),predicates:new Set(),modalities:new Set(),directives:new Set(),queryKinds:new Set(),modifiers:new Set(),unresolved:0};
  walk(node,n=>{
    if(n.type) inv.nodeTypes.add(n.type);
    if(n.type==='event'&&n.predicate) inv.predicates.add(lemma(n.predicate));
    if(n.type==='modal'&&n.modality) inv.modalities.add(n.modality);
    if(n.type==='directive'&&n.operator) inv.directives.add(lemma(n.operator));
    if(n.type==='query'&&n.queryKind) inv.queryKinds.add(n.queryKind);
    if(n.type==='raw'||n.kind==='unresolved_ref') inv.unresolved++;
    if(n.type==='event') for(const m of n.modifiers||[]) inv.modifiers.add(m.kind==='time_relation'?m.relation:m.kind);
  });
  return inv;
}
function auditContentAgainstSource(source, content, act=null) {
  const inv=collectSemanticInventory(content); const checks=[];
  const add=(name,ok,detail,severity='hard')=>checks.push({name,ok:!!ok,detail,severity});
  const l=lower(source);
  const hasType=t=>inv.nodeTypes.has(t);
  const hasModal=m=>inv.modalities.has(m);
  const sourceVerbs=tokenize(source).map((t,i,a)=>looksVerb(t,i,a)?lemma(t):null).filter(Boolean).filter(v=>!['be','have','do','need','want','prefer','mean','happen'].includes(v));
  const represented=new Set([...inv.predicates,...inv.directives]);
  const missingVerbs=[...new Set(sourceVerbs.filter(v=>!represented.has(v)))];
  add('recognized_predicates_preserved',missingVerbs.length===0,missingVerbs.length?`possible missing predicates: ${missingVerbs.join(', ')}`:'all recognized lexical predicates represented','soft');
  if(/\bnot\b|\bnever\b/i.test(source)) add('negation_preserved',hasType('not')||[...inv.modalities].some(x=>/NOT|FORBIDDEN|IMPOSSIBLE|DISCOURAGED/.test(x)), 'source contains explicit negation');
  if(/^no\s+[A-Za-z]/i.test(source)) add('no_quantifier_preserved',hasNode(content,n=>n.type==='quantifier'&&n.quantifier==='FOR_NO')||hasType('not')||(hasNode(content,n=>n.type==='quantifier'&&n.quantifier==='FOR_EVERY')&&hasModal('NOT_PERMITTED')), 'source begins with NO quantifier');
  if(/\bmust\b/i.test(source)) add('must_preserved',hasModal('OBLIGATORY')||hasModal('FORBIDDEN'),'source contains MUST');
  if(/\bshould\b/i.test(source)) add('should_preserved',hasModal('RECOMMENDED')||hasModal('DISCOURAGED')||inv.queryKinds.has('WHAT_SHOULD_HAPPEN'),'source contains SHOULD');
  if(/\bmay\b/i.test(source)) add('may_preserved',hasModal('PERMITTED')||hasModal('NOT_PERMITTED'),'source contains MAY');
  if(/\b(?:can|could)\b/i.test(source)) add('possibility_preserved',hasModal('POSSIBLE')||hasModal('IMPOSSIBLE'),'source contains CAN/COULD');
  if(/\b(?:every|each|all)\b/i.test(source)) add('universal_preserved',hasNode(content,n=>n.type==='quantifier'&&n.quantifier==='FOR_EVERY'),'source contains universal quantifier');
  if(/\bif\b|\bunless\b/i.test(source)) add('condition_preserved',hasType('if')||hasType('if_else')||hasNode(content,n=>n.type==='query'&&n.condition),'source contains a condition');
  if(/\bwhen\b/i.test(source) && !/^when\s+.+\?$/i.test(source)) add('when_preserved',hasType('if')||hasType('even_if')||hasNode(content,n=>n.type==='event'&&(n.modifiers||[]).some(m=>m.relation==='when')),'source contains WHEN');
  if(/\bbefore\b|\bafter\b/i.test(source)) add('temporal_order_preserved',hasType('temporal')||hasNode(content,n=>n.type==='event'&&(n.modifiers||[]).some(m=>m.kind==='time_relation'))||hasType('search'),'source contains BEFORE/AFTER');
  if(/\bbecause\b/i.test(source)) add('causal_preserved',hasType('causal'),'source contains BECAUSE');
  if(/\bwhether\b/i.test(source)) add('whether_preserved',inv.queryKinds.has('WHETHER'),'source contains WHETHER');
  if(/\bonly\b/i.test(source) && !/\b(?:involved|mentions?|contains?|operator|word)\s+only\b/i.test(source)) add('only_preserved',hasType('only'),'source contains semantic ONLY');
  if(act==='ASK'||/\?$/.test(source)) add('question_preserved',hasType('query')||act==='ASK','question surface');
  if(['INSTRUCT','REQUEST','PROPOSE'].includes(act)) add('directive_preserved',hasType('directive')||hasType('not'),'directive speech act');
  add('no_unresolved_nodes',inv.unresolved===0,inv.unresolved?`${inv.unresolved} unresolved node/reference(s)`:'no unresolved nodes');
  const hardFailures=checks.filter(c=>!c.ok&&c.severity==='hard');
  return {ok:hardFailures.length===0,score:checks.length?checks.filter(c=>c.ok).length/checks.length:1,checks,hard_failures:hardFailures.map(c=>c.name)};
}
function auditTurn(turn) {
  const a=auditContentAgainstSource(turn.source,turn.final_content||turn.content,turn.act);
  const unresolvedHelper=(turn.helper_status==='replaced'||turn.helper_status==='accepted')?[]:helperIssues(turn,{minSeverity:'high'});
  const checks=[...a.checks];
  if(unresolvedHelper.length) checks.push({name:'no_unresolved_high_risk',ok:false,detail:`high-risk symbolic issues: ${unresolvedHelper.map(x=>x.kind).join(', ')}`,severity:'hard'});
  const hardFailures=checks.filter(c=>!c.ok&&c.severity==='hard');
  return {ok:hardFailures.length===0,score:checks.length?checks.filter(c=>c.ok).length/checks.length:1,checks,hard_failures:hardFailures.map(c=>c.name)};
}
function auditConversation(conversation) {
  const turns=(conversation.turns||conversation).map(t=>({id:t.id,source:t.source,audit:auditTurn(t)}));
  return {turns,ok:turns.every(x=>x.audit.ok),mean_score:turns.length?turns.reduce((a,x)=>a+x.audit.score,0)/turns.length:1,hard_fail_turns:turns.filter(x=>!x.audit.ok).map(x=>x.id)};
}

function buildSemanticValidationRequests(conversation,{maxItems=100,maxChars=250000,includeSymbolicAcceptedSample=0.2}={}) {
  const turns=conversation.turns||conversation; const items=[];
  for(let i=0;i<turns.length;i++){
    const t=turns[i], audit=auditTurn(t);
    const helperTouched=['replaced','accepted','unresolved'].includes(t.helper_status);
    const deterministicSample=!helperTouched && includeSymbolicAcceptedSample>0 && ((i*37+11)%100)<Math.round(includeSymbolicAcceptedSample*100);
    if(helperTouched||!audit.ok||deterministicSample){
      items.push({turn_id:t.id,source:t.source,final_cnl:t.final_cnl||t.cnl,symbolic_audit:audit});
    }
  }
  const batches=[];let cur=[],chars=0;
  for(const item of items){const z=JSON.stringify(item).length;if(cur.length&&(cur.length>=maxItems||chars+z>maxChars)){batches.push(cur);cur=[];chars=0;}cur.push(item);chars+=z;}if(cur.length)batches.push(cur);
  return batches.map((batch,bi)=>({protocol:'nl2cnl-validate/1',batch_id:`validate-${bi+1}`,task:'semantic_equivalence_check',instructions:[
    'Judge whether source and final_cnl express the same meaning in conversational context.',
    'Check both directions: source must not contain material meaning missing from CNL, and CNL must not invent material meaning absent from source.',
    'Treat unresolved references or wrong operator scope as not_equivalent, not as stylistic differences.',
    'Return JSON only; one result per turn_id.'
  ],response_shape:{protocol:'nl2cnl-validate/1',batch_id:`validate-${bi+1}`,results:[{turn_id:'...',verdict:'equivalent|not_equivalent|uncertain',confidence:0.0,missing:[],extra:[],reason:'...'}]},items:batch}));
}
function validateSemanticReviewResponse(request,response){
  const errors=[];if(!response||response.protocol!=='nl2cnl-validate/1')errors.push('protocol mismatch');if(response?.batch_id!==request.batch_id)errors.push('batch_id mismatch');
  const expected=new Set(request.items.map(x=>x.turn_id)),seen=new Set();
  for(const r of response?.results||[]){if(!expected.has(r.turn_id))errors.push(`unexpected turn_id ${r.turn_id}`);if(seen.has(r.turn_id))errors.push(`duplicate turn_id ${r.turn_id}`);seen.add(r.turn_id);if(!['equivalent','not_equivalent','uncertain'].includes(r.verdict))errors.push(`${r.turn_id}: bad verdict`);if(typeof r.confidence!=='number'||r.confidence<0||r.confidence>1)errors.push(`${r.turn_id}: confidence must be 0..1`);}for(const id of expected)if(!seen.has(id))errors.push(`missing result for ${id}`);return {ok:errors.length===0,errors};
}

export { VERSION, newState, tokenize, splitSentences, classifyAct, detectSymbolicRisks, formalizeText, formalizeConversation, renderTurn, renderNode, makeResolutionRequest, parseTurn, ambiguityNeedsHelper, helperIssues, needsHelper, buildBatchHelperRequests, validateAst, validateBatchHelperResponse, applyBatchHelperResponse, summarizeHelperLoad, collectSemanticInventory, auditContentAgainstSource, auditTurn, auditConversation, buildSemanticValidationRequests, validateSemanticReviewResponse };
