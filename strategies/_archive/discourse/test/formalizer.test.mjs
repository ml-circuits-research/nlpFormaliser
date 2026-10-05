import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formalizeConversation,
  formalizeText,
  auditTurn,
} from '../index.mjs';

test('formalizeText returns canonical CNL', () => {
  const [t] = formalizeText('Every reviewer must accept a paper.');
  assert.equal(typeof t.cnl, 'string');
  assert.match(t.cnl, /FOR_EVERY/i);
  assert.match(t.cnl, /OBLIGATORY/i);
  assert.match(t.cnl, /accept/i);
});

test('not every preserves outer negation', () => {
  const [t] = formalizeText('Not every reviewer must accept a paper.');
  assert.match(t.cnl, /NOT:/);
  assert.match(t.cnl, /FOR_EVERY/);
});

test('conversation keeps distinct turns and state', () => {
  const c = formalizeConversation([
    {id:'t1',text:'Ada reviewed the report.'},
    {id:'t2',text:'Bob approved it.'}
  ]);
  assert.equal(c.turns.length, 2);
  assert.ok(c.state);
});

test('audit exposes structured result', () => {
  const [t] = formalizeText('If the backup fails, the operator must not delete the original.');
  const a = auditTurn(t);
  assert.equal(typeof a.ok, 'boolean');
  assert.ok(Array.isArray(a.checks));
});
