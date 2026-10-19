import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes } from '../src/formatBytes.js';

test('byte sizes select decimal B through TB and never exceed one fractional digit', () => {
  for (const [bytes, expected] of [
    [0, '0 B'],
    [40, '40 B'],
    [999, '999 B'],
    [1000, '1 KB'],
    [1540, '1,5 KB'],
    [1_000_000, '1 MB'],
    [40_000_000, '40 MB'],
    [40_500_000, '40,5 MB'],
    [40_000_000_000, '40 GB'],
    [1_500_000_000_000, '1,5 TB'],
    [1_000_000_000_000_000, '1000 TB'],
    [999_950, '1 MB'],
    [999_949, '999,9 KB'],
  ] as const) {
    assert.equal(formatBytes(bytes, 'pt-BR'), expected);
  }
});
test('sizes follow explicit UI locale, not browser speech settings', () => {
  assert.equal(formatBytes(12_340_000, 'pt-BR'), '12,3 MB');
  assert.equal(formatBytes(12_340_000, 'en'), '12.3 MB');
  for (const locale of ['es', 'fr']) assert.equal(formatBytes(12_340_000, locale), '12,3 MB');
  for (const locale of ['hi', 'zh']) assert.equal(formatBytes(12_340_000, locale), '12.3 MB');
});
