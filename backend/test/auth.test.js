import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequireAuth } from '../src/middleware/auth.js';

function run(mw, headers = {}) {
  return new Promise((resolve) => {
    const req = { headers };
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(b) { resolve({ status: this.statusCode, body: b, req, nexted: false }); },
    };
    mw(req, res, () => resolve({ status: 200, nexted: true, req }));
  });
}

const goodClient = {
  auth: {
    getUser: async (t) =>
      t === 'good'
        ? { data: { user: { id: 'u1', email: 'a@b.c' } }, error: null }
        : { data: { user: null }, error: { message: 'bad' } },
  },
};

test('strict: no token -> 401', async () => {
  const r = await run(createRequireAuth({ getClient: () => goodClient, getStrict: () => true }));
  assert.equal(r.status, 401);
});

test('strict: fake token -> 401', async () => {
  const r = await run(createRequireAuth({ getClient: () => goodClient, getStrict: () => true }), {
    authorization: 'Bearer nope',
  });
  assert.equal(r.status, 401);
});

test('strict: valid token -> next with user', async () => {
  const r = await run(createRequireAuth({ getClient: () => goodClient, getStrict: () => true }), {
    authorization: 'Bearer good',
  });
  assert.ok(r.nexted);
  assert.equal(r.req.user.id, 'u1');
});

test('strict: Supabase not configured -> 503 (fail closed)', async () => {
  const r = await run(createRequireAuth({ getClient: () => null, getStrict: () => true }));
  assert.equal(r.status, 503);
});

test('strict: verification throws -> 401', async () => {
  const boom = { auth: { getUser: async () => { throw new Error('net'); } } };
  const r = await run(createRequireAuth({ getClient: () => boom, getStrict: () => true }), {
    authorization: 'Bearer x',
  });
  assert.equal(r.status, 401);
});

test('dev mode: no token -> guest allowed', async () => {
  const r = await run(createRequireAuth({ getClient: () => goodClient, getStrict: () => false }));
  assert.ok(r.nexted);
  assert.equal(r.req.user.isGuest, true);
});
