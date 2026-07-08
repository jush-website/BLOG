import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAutoLayout } from './grid.js';

const overlaps = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('saved layouts are returned untouched', () => {
  const saved = { i: 'a', x: 1, y: 4, w: 2, h: 2 };
  assert.deepEqual(getAutoLayout([{ id: 'a', gridLayout: saved }]), [saved]);
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
