import test from 'node:test';
import assert from 'node:assert/strict';
import { styles } from '../src/styles/index.js';
test('voice bars use host composer width and side clearance, not full dock width', () => {
  const pill = styles.match(/^\.dlv-pill\{([^}]+)\}/m)?.[1] || '';
  assert.ok(pill.includes('box-sizing:border-box'));
  assert.ok(
    pill.includes(
      'width:calc(100% - var(--dsh-composer-side-clearance,0px) - var(--dsh-composer-side-clearance,0px) - 16px)',
    ),
  );
  assert.ok(pill.includes('max-width:calc(var(--dsh-composer-card-max-width,100%) - 16px)'));
  assert.ok(pill.includes('min-width:0'));
  assert.ok(pill.includes('margin:0 auto'));
});
