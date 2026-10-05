import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csvEscape } from '../../lib/csv';

test('CSV safely quotes cells and neutralizes formula-like untrusted text, including whitespace prefixes', () => {
  for (const value of ['=1+1', '+919876540001', '-1+2', '@SUM(A1)', '  =SUM(A1)', '\tvalue', '\rvalue', '\nvalue', '\uFEFF=1+1', '\uFF1D1+1']) {
    assert.ok(csvEscape(value).startsWith('"\''), value);
  }
  assert.equal(csvEscape('Doctor, "A"\nClinic'), '"Doctor, ""A""\nClinic"');
  assert.equal(csvEscape('Ordinary attendee'), '"Ordinary attendee"');
  assert.equal(csvEscape(null), '""');
  assert.equal(csvEscape(12), '"12"');
});
