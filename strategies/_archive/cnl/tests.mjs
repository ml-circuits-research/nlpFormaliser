import assert from 'node:assert/strict';
import {
  LINE_TYPES,
  VERSION,
  buildFormalizationPrompt,
  canonicalizeCNL,
  parseCNL,
  validateCNL
} from './cnl-core.mjs';

assert.equal(VERSION, '0.1.0');
assert.deepEqual(LINE_TYPES, [
  'ASSERT', 'ASK', 'REQUEST', 'INTEND', 'PREFER', 'PROPOSE', 'REVISE', 'UNCLEAR'
]);

const sample = [
  'ASSERT: Luna is probably sufficient.',
  'REQUEST: You do not switch yet.',
  'ASK: Is Sol slower than Luna?'
].join('\n');

const parsed = parseCNL(sample);
assert.equal(parsed.length, 3);
assert.equal(parsed[0].type, 'ASSERT');
assert.equal(parsed[2].text, 'Is Sol slower than Luna?');
assert.equal(validateCNL(sample).ok, true);

const bad = 'FACT: Luna works.\nthis is not CNL';
assert.equal(validateCNL(bad).ok, false);

assert.equal(
  canonicalizeCNL('ASSERT:   Luna works.  \n\nASK: Why?'),
  'ASSERT: Luna works.\nASK: Why?'
);

const prompt = buildFormalizationPrompt('Could you run the test?');
assert.match(prompt, /CNL-Core Baseline/);
assert.match(prompt, /REQUEST/);
assert.match(prompt, /Could you run the test\?/);

console.log('All CNL-Core Baseline tests passed.');

// Validate every gold record in the bundled regression dataset.
{
  const fs = await import('node:fs');
  const rows = fs.readFileSync(new URL('./examples/regression.jsonl', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean)
    .map(JSON.parse);
  assert.equal(rows.length, 50);
  for (const row of rows) {
    const v = validateCNL(row.gold);
    assert.equal(v.ok, true, `${row.id} has invalid gold CNL: ${JSON.stringify(v.errors)}`);
  }
}
