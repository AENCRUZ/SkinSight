import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// No Gemini or Supabase calls: every case below is rejected by validation before any AI call.
process.env.REQUIRE_AUTH = 'false';
process.env.NODE_ENV = 'test';
const { default: app } = await import('../src/app.js');

let server;
let base;
before(async () => {
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const post = (path, body) =>
  fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const postForm = (fd) => fetch(base + '/api/chat/message', { method: 'POST', body: fd });

test('health ok', async () => {
  assert.equal((await fetch(base + '/api/health')).status, 200);
});

test('unknown route -> generic 404 that does not echo the URL', async () => {
  const r = await fetch(base + '/nope?q=secret');
  const b = await r.json();
  assert.equal(r.status, 404);
  assert.ok(!JSON.stringify(b).includes('secret'));
});

test('summary: missing history -> 400', async () => {
  assert.equal((await post('/api/chat/summary', {})).status, 400);
});

test('summary: oversize history -> 400', async () => {
  const h = Array.from({ length: 41 }, () => ({ role: 'user', text: 'x' }));
  assert.equal((await post('/api/chat/summary', { history: h })).status, 400);
});

test('invalid JSON body -> 400', async () => {
  const r = await fetch(base + '/api/chat/summary', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad',
  });
  assert.equal(r.status, 400);
});

test('body over 1mb -> 413', async () => {
  const r = await post('/api/chat/summary', { history: [{ role: 'user', text: 'x'.repeat(1.2 * 1024 * 1024) }] });
  assert.equal(r.status, 413);
});

test('message: empty -> 400', async () => {
  assert.equal((await postForm(new FormData())).status, 400);
});

test('message: too long -> 400', async () => {
  const fd = new FormData();
  fd.append('message', 'x'.repeat(2001));
  assert.equal((await postForm(fd)).status, 400);
});

test('upload: wrong declared type -> 400', async () => {
  const fd = new FormData();
  fd.append('message', 'hi');
  fd.append('image', new Blob(['hello'], { type: 'text/plain' }), 'a.txt');
  assert.equal((await postForm(fd)).status, 400);
});

test('upload: declared jpeg that is not a jpeg -> 400', async () => {
  const fd = new FormData();
  fd.append('message', 'hi');
  fd.append('image', new Blob(['<?php echo 1; ?> not really an image at all'], { type: 'image/jpeg' }), 'a.jpg');
  assert.equal((await postForm(fd)).status, 400);
});

test('upload: over 5MB -> 413', async () => {
  const fd = new FormData();
  fd.append('message', 'hi');
  fd.append('image', new Blob([Buffer.alloc(5 * 1024 * 1024 + 10, 1)], { type: 'image/jpeg' }), 'big.jpg');
  assert.equal((await postForm(fd)).status, 413);
});

test('download: nothing to build -> 400', async () => {
  assert.equal((await post('/api/chat/download', {})).status, 400);
});

test('knowledge: missing q -> 400; stats reports retrieval mode', async () => {
  assert.equal((await fetch(base + '/api/chat/knowledge/search')).status, 400);
  const s = await (await fetch(base + '/api/chat/knowledge/stats')).json();
  assert.equal(s.success, true);
  assert.ok('retrievalMode' in s.stats);
});
