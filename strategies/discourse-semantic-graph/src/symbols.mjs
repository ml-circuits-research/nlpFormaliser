import {constantKind} from '../../../tools/lib/symbols.mjs';

// Strings of the discourse AST that the renderer prints as symbols or literals.
// Unparsed `raw` text is not rendered (UNRESOLVED_FRAGMENT#k) and is audited as
// unresolved instead; ambiguity messages/questions are explanatory notes.
export function discourseSymbols(conversation) {
  const out = [];
  const add = (path, name, kind) => { if (typeof name === 'string' && name.trim()) out.push({path, name, kind: kind ?? constantKind(name)}); };
  function ref(r, path) {
    if (!r || typeof r !== 'object') return;
    if (r.kind === 'ref' || r.kind === 'literal') add(`${path}.text`, r.text);
    if (r.kind === 'var') add(`${path}.type`, r.text, 'symbol');
  }
  function walk(n, path) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
    if (n.type === 'raw') return;
    if (n.type === 'event') {
      add(`${path}.predicate`, n.predicate, 'symbol');
      for (const [k, v] of Object.entries(n.roles ?? {})) ref(v, `${path}.roles.${k}`);
      (n.modifiers ?? []).forEach((m, i) => add(`${path}.modifiers[${i}]`, m.value));
      return;
    }
    if (n.type === 'attitude') { add(`${path}.predicate`, n.predicate, 'symbol'); ref(n.agent, `${path}.agent`); ref(n.recipient, `${path}.recipient`); walk(n.content, `${path}.content`); return; }
    if (n.type === 'comparison') { ref(n.agent, `${path}.agent`); ref(n.left, `${path}.left`); ref(n.right, `${path}.right`); return; }
    if (n.type === 'directive') {
      add(`${path}.operator`, n.operator, 'symbol');
      ref(n.target, `${path}.target`);
      (n.items ?? []).forEach((r, i) => ref(r, `${path}.items[${i}]`));
      if (n.dimension) add(`${path}.dimension`, n.dimension);
      (n.constraints ?? []).forEach((c, i) => add(`${path}.constraints[${i}]`, String(c.value ?? '')));
      walk(n.body, `${path}.body`);
      return;
    }
    if (n.type === 'search') { add(`${path}.entityType`, n.entityType, 'symbol'); (n.constraints ?? []).forEach((c, i) => add(`${path}.constraints[${i}]`, String(c.value ?? ''))); return; }
    if (n.type === 'only') ref(n.focus, `${path}.focus`);
    if (n.type === 'resolution_hint') add(`${path}.value`, n.value);
    if (n.entityType) add(`${path}.entityType`, n.entityType, 'symbol');
    for (const [k, v] of Object.entries(n)) if (v && typeof v === 'object' && k !== 'focus') walk(v, `${path}.${k}`);
  }
  (conversation?.turns ?? []).forEach((t, i) => walk(t.content, `turns[${i}].content`));
  return out;
}
