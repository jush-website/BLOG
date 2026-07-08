import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDirectImageUrl, safeHref } from './urls.js';

const DRIVE_ID = '1A2b3C4d5E6f7G8h9IjKlMnOpQrStUv';
const thumb = `https://drive.google.com/thumbnail?id=${DRIVE_ID}&sz=w1600`;

test('rewrites every shape of Drive link Google hands out', () => {
  for (const shared of [
    `https://drive.google.com/file/d/${DRIVE_ID}/view?usp=sharing`,
    `https://drive.google.com/file/d/${DRIVE_ID}/view`,
    `https://drive.google.com/open?id=${DRIVE_ID}`,
    `https://drive.google.com/uc?export=view&id=${DRIVE_ID}`, // the format Google blocked
    `  https://drive.google.com/file/d/${DRIVE_ID}/view  `,    // pasted with whitespace
  ]) {
    assert.equal(toDirectImageUrl(shared), thumb, shared);
  }
});

test('leaves uploads and foreign hosts alone', () => {
  const base64 = 'data:image/webp;base64,AAAA';
  assert.equal(toDirectImageUrl(base64), base64);
  assert.equal(toDirectImageUrl('https://images.unsplash.com/photo-1.jpg'), 'https://images.unsplash.com/photo-1.jpg');
  assert.equal(toDirectImageUrl(''), '');
  assert.equal(toDirectImageUrl(undefined), '');
});

test('a Drive URL with no parsable id is passed through, not mangled', () => {
  const noId = 'https://drive.google.com/drive/my-drive';
  assert.equal(toDirectImageUrl(noId), noId);
});

test('safeHref blocks script-bearing schemes', () => {
  // A link card lives on a page the owner shares with strangers.
  assert.equal(safeHref('javascript:alert(1)'), '');
  assert.equal(safeHref('JaVaScRiPt:alert(1)'), '');
  assert.equal(safeHref('  javascript:alert(1)  '), '');
  assert.equal(safeHref('data:text/html,<script>alert(1)</script>'), '');
  assert.equal(safeHref('vbscript:msgbox'), '');
});

test('safeHref keeps ordinary destinations', () => {
  assert.equal(safeHref('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(safeHref('http://example.com'), 'http://example.com');
  assert.equal(safeHref('mailto:a@b.com'), 'mailto:a@b.com');
  assert.equal(safeHref(' https://example.com '), 'https://example.com');
  assert.equal(safeHref('/relative'), '');
  assert.equal(safeHref(undefined), '');
});
