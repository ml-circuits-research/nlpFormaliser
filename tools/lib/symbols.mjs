// Shared, deterministic symbol-length rule (user decision): every symbol name
// (predicate, entity/constant, concept lemma, relation, context, CNL label) may
// contain at most MAX_SYMBOL_WORDS words. Long names hide meaning that cannot be
// translated symbolically, so a violation makes a row ineligible.
//
// Words are split on underscores, hyphens, dots, slashes, whitespace, letter/digit
// boundaries AND camelCase boundaries, so camelCase is not a way around the limit:
//   ignoreLastMessage -> ignore|Last|Message (3, allowed)
//   keepImportantEmailsInInbox -> 5 words (violation)
// Quoted proper names ("Ada Lovelace") are counted by their name tokens without
// camelCase splitting (McDonald stays one token), still at most 3 tokens.
export const MAX_SYMBOL_WORDS = 3;

export const SYMBOL_RULE_TEXT = `Symbol length rule: every symbol you create (predicate, relation, concept, entity or constant name, context id, label or template words) contains at most ${MAX_SYMBOL_WORDS} words. Words are counted by splitting on underscores, hyphens, spaces, digit boundaries and camelCase, so camelCase does not avoid the limit. Proper names in quotes also have at most ${MAX_SYMBOL_WORDS} tokens. Good: owns, keep_in(email, inbox), important(email). Bad: keep_important_emails_in_inbox, keepImportantEmailsInInbox. Decompose a long idea into several short compositional predicates, roles or nested propositions instead of hiding it in one long name; never copy a source clause into a name, label or string.`;

/** Split a symbol into words. `proper` keeps camelCase inside a token (for proper names). */
export function symbolWords(name, {proper = false} = {}) {
  let s = String(name ?? '').trim();
  s = s.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').replace(/^\?/, '');
  if (!proper) {
    s = s
      .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
      .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1 $2')
      .replace(/(\p{L})(\p{N})/gu, '$1 $2')
      .replace(/(\p{N})(\p{L})/gu, '$1 $2');
  }
  return s.split(/[\s_\-./\\:,;+|]+/u).map(w => w.replace(/[^\p{L}\p{N}'&]/gu, '')).filter(Boolean);
}

export function countSymbolWords(name, options) { return symbolWords(name, options).length; }

export function isShortSymbol(name, options) { return countSymbolWords(name, options) <= MAX_SYMBOL_WORDS; }

/** Template words outside {0}-style slots. */
export function templateWords(template) {
  return symbolWords(String(template ?? '').replace(/\{\d+\}/g, ' '), {proper: true});
}

/**
 * Check a list of collected symbols [{path, name, kind}] and return violations.
 * kind 'proper' uses proper-name tokenisation, 'template' ignores slots.
 */
export function symbolViolations(symbols) {
  const out = [];
  for (const s of symbols ?? []) {
    if (s?.name == null || typeof s.name === 'object') continue;
    const words = s.kind === 'template' ? templateWords(s.name) : symbolWords(s.name, {proper: s.kind === 'proper'});
    if (words.length > MAX_SYMBOL_WORDS) out.push({path: s.path, name: String(s.name), kind: s.kind ?? 'symbol', words: words.length});
  }
  return out;
}

export function violationMessage(v) {
  return `symbol longer than ${MAX_SYMBOL_WORDS} words at ${v.path}: ${String(v.name).slice(0, 120)}`;
}

/** Quoted constants that look like proper names ("Ada Lovelace", "McDonald") are
 * counted as name tokens; any other constant is counted as a symbol (camelCase split). */
export function constantKind(name) {
  const tokens = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  return tokens.length && tokens.every(t => /^[\p{Lu}\p{N}]/u.test(t)) ? 'proper' : 'symbol';
}

/** Instruction text that a repair round can pass back to the model. */
export function decompositionFeedback(violations) {
  return violations.map(v => `${violationMessage(v)} (${v.words} words); decompose it into short compositional predicates, roles or nested propositions`);
}
