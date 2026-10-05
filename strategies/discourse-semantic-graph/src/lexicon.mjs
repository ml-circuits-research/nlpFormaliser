// Lexical knowledge for the symbolic parser: part-of-speech tags and verb roots from compromise's rule-and-lexicon tagger
// (deterministic, no statistical model). The archive's own small verb list is consulted first; this module only answers what it
// leaves open, so sentences whose verbs the archive knew parse as before.
import nlp from 'compromise';

const tagCache=new Map(), rootCache=new Map();

/** Tags of each token in context (aligned with the parser's tokens; punctuation tokens get null). */
export function tagTokens(toks) {
  const key=toks.join('\u0001');
  if(tagCache.has(key)) return tagCache.get(key);
  const words=toks.map(t=>/^[A-Za-zÀ-ÖØ-öø-ÿ0-9_'-]+$/.test(t)?t:null);
  const terms=nlp(words.filter(Boolean).join(' ')).json().flatMap(s=>s.terms);
  const out=[];let k=0;
  for(const w of words) {
    if(w===null){out.push(null);continue;}
    // compromise may split a token ("can't") or merge none; align on the term whose text starts the token.
    while(k<terms.length&&!w.toLowerCase().startsWith(terms[k].text.toLowerCase().replace(/[^a-z0-9_'-]/g,'').slice(0,1)))k++;
    out.push(k<terms.length?new Set(terms[k].tags):null);
    if(k<terms.length)k++;
  }
  if(tagCache.size>5000)tagCache.clear();
  tagCache.set(key,out);
  return out;
}

// Closed-class words are never verbs, whatever the tagger guesses for an otherwise verbless sentence ("beyond", "despite").
const CLOSED=new Set(('about above across after against along amid among around as at before behind below beneath beside besides between beyond '+
  'but by despite down during except for from in inside into like near of off on onto out outside over past per since than through '+
  'throughout till to toward towards under underneath unlike until up upon via with within without and or nor so yet if unless '+
  'because although though while whereas whether the a an this that these those my your our their his her its i you he she it we they '+
  'me him us them who whom whose which what not no never very really just also only').split(' '));

/** A lexical (non-auxiliary) verb in context. */
export function isLexicalVerb(tags,word='') {
  return !!tags&&tags.has('Verb')&&!tags.has('Auxiliary')&&!tags.has('Modal')&&!tags.has('Copula')&&!CLOSED.has(String(word).toLowerCase());
}

const T=nlp.methods().two.transform, MODEL=nlp.model();
/** The infinitive of an -ed/-ing form by compromise's conjugation rules ("licensed" -> "license", "shipped" -> "ship"), else null. */
export function inflectedRoot(word) {
  const w=String(word).toLowerCase();
  const form=/ing$/.test(w)?'Gerund':/ed$/.test(w)?'PastTense':null;
  if(!form||CLOSED.has(w)) return null;
  try { const r=T.verb.toInfinitive(w,MODEL,form); return /^[a-z][a-z'-]*$/.test(r??'')&&r!==w?r:null; } catch { return null; }
}

/** The infinitive of a word that compromise knows as a verb form ("broke" -> "break", "died" -> "die"), else null. */
export function verbRoot(word) {
  const w=String(word).toLowerCase();
  if(rootCache.has(w)) return rootCache.get(w);
  let root=null;
  const doc=nlp(w);
  if(!CLOSED.has(w)&&doc.has('#Verb')) {
    const inf=doc.verbs().toInfinitive().text().toLowerCase().trim();
    if(/^[a-z][a-z'-]*$/.test(inf)) root=inf;
  }
  rootCache.set(w,root);
  return root;
}

const frameCache=new Map();
/** Whether a word has a verb reading: it is tagged as a verb right after a pronoun subject ("it starts it", "they audit it"). */
export function canBeVerb(word) {
  const w=String(word).toLowerCase();
  if(CLOSED.has(w)||!/^[a-z][a-z'-]*$/.test(w)) return false;
  if(frameCache.has(w)) return frameCache.get(w);
  const subject=/(?:s|ed)$/.test(w)?'it':'they';
  const t=nlp(`${subject} ${w} it`).json()[0]?.terms?.[1];
  const yes=!!t&&t.tags.includes('Verb')&&!t.tags.includes('Auxiliary')&&!t.tags.includes('Copula');
  frameCache.set(w,yes);
  return yes;
}
