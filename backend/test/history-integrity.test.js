// Regression tests for the "reference text leaks into saved history" bug.
// The Gemini SDK appends every turn to the history array it is given, so passing our own array made the returned
// history contain the retrieved knowledge-base text (wrapped around the user's message) as a user turn.
// All network calls are stubbed: no API key, no cost.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.GEMINI_API_KEY = 'fake-key-for-tests'; // set before aiConfig is imported
const realFetch = globalThis.fetch;
const sent = []; // bodies of generateContent requests

before(() => {
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
    if (/embedContent|batchEmbedContents/.test(u)) return json({ error: { message: 'stubbed' } }, 500); // keyword retrieval only
    if (/generateContent/.test(u)) {
      sent.push(JSON.parse(opts.body));
      return json({ candidates: [{ content: { role: 'model', parts: [{ text: 'Thanks. How long has it been there?' }] }, finishReason: 'STOP' }] });
    }
    throw new Error('unexpected network call: ' + u);
  };
});
after(() => { globalThis.fetch = realFetch; });

const { sendChatMessage, generateConsultationSummary } = await import('../src/services/aiService.js');
const { normalizeHistory, isReferenceArtifact, dropReferenceArtifacts, LIMITS } = await import('../src/middleware/validateChat.js');
const { formatRagContext, getKnowledgeBase } = await import('../src/services/ragService.js');

const BANNER = 'VERIFIED CLINICAL INTAKE KNOWLEDGE BASE';
const MESSAGE = 'I have an itchy red rash after using a new laundry detergent';
const text = (t) => t.parts.map((p) => p.text).join(' ');

test('a chat turn returns exactly 2 new turns and no reference text', async () => {
  const r = await sendChatMessage({ message: MESSAGE, history: [] });
  assert.equal(r.history.length, 2, JSON.stringify(r.history.map((t) => t.role)));
  assert.deepEqual(r.history.map((t) => t.role), ['user', 'model']);
  assert.equal(text(r.history[0]), MESSAGE);
  assert.ok(r.history.every((t) => !text(t).includes(BANNER)));
});

test('the reference text is still sent to the model for the CURRENT turn (retrieval keeps working)', async () => {
  sent.length = 0;
  await sendChatMessage({ message: MESSAGE, history: [] });
  const last = sent[sent.length - 1].contents.at(-1);
  assert.ok(text(last).includes(BANNER), 'current turn should carry the retrieved context');
  assert.ok(text(last).includes(MESSAGE));
});

test('a second turn does not re-send old reference text and grows history by 2 per exchange', async () => {
  const first = await sendChatMessage({ message: MESSAGE, history: [] });
  sent.length = 0;
  // a message that also retrieves reference text, so the CURRENT turn carries a banner and the old ones must not
  const second = await sendChatMessage({ message: 'The itchy red rash is still there after the new laundry detergent', history: first.history });
  assert.equal(second.history.length, 4);
  const contents = sent[sent.length - 1].contents;
  assert.equal(contents.length, 3, 'two history turns plus the new message');
  const withBanner = contents.filter((c) => text(c).includes(BANNER));
  assert.equal(withBanner.length, 1, 'only the current turn carries reference text');
  assert.ok(contents.slice(0, 2).every((c) => !text(c).includes(BANNER)));
});

test('the history passed in by the caller is not mutated', async () => {
  const h = [
    { role: 'user', parts: [{ text: 'hello' }] },
    { role: 'model', parts: [{ text: 'hi, tell me about your skin' }] },
  ];
  const before = JSON.stringify(h);
  await sendChatMessage({ message: MESSAGE, history: h });
  assert.equal(JSON.stringify(h), before);
});

test('summary transcript contains no reference text', async () => {
  const first = await sendChatMessage({ message: MESSAGE, history: [] });
  sent.length = 0;
  try { await generateConsultationSummary(first.history); } catch (e) { /* the stub does not return summary JSON; only the request matters */ }
  const body = JSON.stringify(sent[0]);
  assert.ok(!body.includes(BANNER));
  assert.ok(body.includes('laundry detergent'));
});

// ---- legacy data written by older versions
function polluted() {
  const wrapped = formatRagContext(getKnowledgeBase().slice(0, 3)) + '\n\n[USER INPUT]:\n' + MESSAGE;
  return [
    { role: 'user', parts: [{ text: wrapped }] },
    { role: 'model', parts: [{ text: 'Thanks. How long has it been there?' }] },
    { role: 'user', parts: [{ text: MESSAGE }] },
    { role: 'model', parts: [{ text: 'Thanks. How long has it been there?' }] },
  ];
}

test('legacy polluted history is cleaned: wrapped turn and its duplicate reply are dropped', () => {
  const out = normalizeHistory(polluted());
  assert.deepEqual(out.map((t) => t.role), ['user', 'model']);
  assert.equal(text(out[0]), MESSAGE);
});

test('legacy history is cleaned BEFORE the length limits (a long wrapped turn is not rejected)', () => {
  const p = polluted();
  assert.ok(text(p[0]).length > 2000);
  const longWrapped = { role: 'user', parts: [{ text: text(p[0]) + 'x'.repeat(LIMITS.TURN_CHARS) }] };
  assert.doesNotThrow(() => normalizeHistory([longWrapped, p[1], p[2], p[3]]));
  // 12 polluted exchanges = 48 raw turns (> 40) but only 24 real turns
  const many = Array.from({ length: 12 }, () => polluted()).flat();
  assert.equal(normalizeHistory(many).length, 24);
});

test('only turns that start with the reference banner are treated as artifacts', () => {
  assert.equal(isReferenceArtifact('===== ' + BANNER + ' ====='), true);
  assert.equal(isReferenceArtifact('I wrote about ' + BANNER + ' in my message'), false);
  assert.equal(isReferenceArtifact('============ my own separator line'), false);
  const items = [{ role: 'user', text: '======== just dashes from the user' }, { role: 'model', text: 'ok' }];
  assert.equal(dropReferenceArtifacts(items).length, 2);
});
