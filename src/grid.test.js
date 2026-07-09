import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAutoLayout } from './grid.js';

const overlaps = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('saved layouts keep their geometry', () => {
  const saved = { i: 'a', x: 1, y: 4, w: 2, h: 2 };
  assert.deepEqual(getAutoLayout([{ id: 'a', gridLayout: saved }]), [saved]);
});

test('stored drag/resize flags are stripped, not passed to react-grid-layout', () => {
  // What an older build wrote into Firestore. `isDraggable: true` here overrides
  // `isDraggable={false}` on the public page, letting visitors drag the cards and
  // (because react-draggable preventDefaults touchstart) breaking taps on mobile.
  const poisoned = {
    i: 'a', x: 1, y: 4, w: 2, h: 2,
    static: false, isDraggable: true, isResizable: true, moved: false,
  };
  const [out] = getAutoLayout([{ id: 'a', gridLayout: poisoned }]);

  assert.deepEqual(out, { i: 'a', x: 1, y: 4, w: 2, h: 2 });
  for (const flag of ['static', 'isDraggable', 'isResizable', 'moved']) {
    assert.ok(!(flag in out), `${flag} must not reach react-grid-layout`);
  }
});

test('a new item never lands on top of a positioned one', () => {
  const layout = getAutoLayout([
    { id: 'a', gridLayout: { i: 'a', x: 0, y: 0, w: 3, h: 2 } },
    { id: 'b', gridLayout: { i: 'b', x: 0, y: 2, w: 1, h: 2 } },
    { id: 'new', size: 'small' }, // freshly added, no gridLayout yet
  ]);
  const fresh = layout.find(l => l.i === 'new');
  assert.equal(fresh.y, 4, 'should flow below the lowest saved card');
  assert.ok(layout.filter(l => l !== fresh).every(l => !overlaps(l, fresh)));
});

test('unpositioned items flow across 3 columns then wrap', () => {
  const layout = getAutoLayout([
    { id: 'a', size: 'medium' }, // w2 -> x0
    { id: 'b', size: 'medium' }, // w2 -> wraps
    { id: 'c', size: 'small' },  // w1 -> sits beside b
  ]);
  assert.deepEqual(layout.map(l => [l.x, l.y, l.w]), [[0, 0, 2], [0, 2, 2], [2, 2, 1]]);
  for (let i = 0; i < layout.length; i++)
    for (let j = i + 1; j < layout.length; j++)
      assert.ok(!overlaps(layout[i], layout[j]), `${layout[i].i} overlaps ${layout[j].i}`);
});
