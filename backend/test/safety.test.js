import test from 'node:test';
import assert from 'node:assert/strict';
import { screenText } from '../src/services/safetyFilter.js';
import { validateSummary } from '../src/services/summaryValidator.js';
import { buildDownloadableReportText } from '../src/services/reportService.js';

test('flags condition names the user did not use', () => {
  const r = screenText('This could be eczema or psoriasis.', { userText: 'itchy red patch' });
  assert.equal(r.ok, false);
});

test('allows a condition term only when the user wrote it', () => {
  assert.equal(screenText('You mentioned eczema; when did it start?', { userText: 'my eczema is back' }).ok, true);
});

test('flags diagnostic phrasing, medication advice and dosage', () => {
  assert.equal(screenText('Your diagnosis is clear.').ok, false);
  assert.equal(screenText('It is most likely a reaction.').ok, false);
  assert.equal(screenText('You should apply hydrocortisone twice daily.').ok, false);
  assert.equal(screenText('Take 500 mg of it.').ok, false);
});

test('does not flag intake questions or safe text', () => {
  assert.equal(screenText('Have you used hydrocortisone or any new product recently?').ok, true);
  assert.equal(
    screenText('Where is it on your body, and does it itch? A cool damp cloth is a gentle comfort measure; please see a dermatologist.').ok,
    true
  );
  assert.equal(screenText("I can't diagnose or identify any condition; a dermatologist can.").ok, true);
});

test('summary: fills Not reported, drops extras including fullText', () => {
  const r = validateSummary({ mainConcern: 'Itchy patch on arm', fullText: 'INJECTED', extra: 1, questions: ['How long?'] });
  assert.equal(r.ok, true);
  assert.equal(r.value.duration, 'Not reported');
  assert.equal(r.value.fullText, undefined);
  assert.deepEqual(r.value.questions, ['How long?']);
});

test('summary: rejects non-objects and missing concern', () => {
  assert.equal(validateSummary('x').ok, false);
  assert.equal(validateSummary({}).ok, false);
});

test('summary: rejects an invented condition, accepts a user-stated term', () => {
  assert.equal(validateSummary({ mainConcern: 'Patient has eczema' }, { userText: 'red itchy skin' }).ok, false);
  assert.equal(validateSummary({ mainConcern: 'Patient mentions eczema' }, { userText: 'I think its eczema' }).ok, true);
});

test('summary: caps question count and length', () => {
  const r = validateSummary({
    mainConcern: 'x',
    questions: Array.from({ length: 12 }, (_, i) => 'q' + i + 'y'.repeat(500)),
  });
  assert.equal(r.value.questions.length, 5);
  assert.ok(r.value.questions[0].length <= 300);
});

test('report ignores model-written fullText', () => {
  const t = buildDownloadableReportText({ mainConcern: 'Itch', fullText: 'DIAGNOSIS: X' }, 'Pat');
  assert.ok(t.includes('Itch'));
  assert.ok(!t.includes('DIAGNOSIS'));
  assert.ok(t.includes('Not reported'));
});
