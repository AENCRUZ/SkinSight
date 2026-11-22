import { screenText } from './safetyFilter.js';

export const NOT_REPORTED = 'Not reported';
const FIELD_MAX = 600;
const QUESTION_MAX = 300;
const MAX_QUESTIONS = 5;
const TEXT_FIELDS = ['mainConcern', 'symptoms', 'duration', 'affectedArea', 'triggers', 'observations'];

const clean = (v, max) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim().slice(0, max) : '';

/**
 * Validate and normalise a model-generated consultation summary.
 * - Only the known keys are kept (model-written "fullText" or any extra key is dropped).
 * - Missing/empty fields become "Not reported" — nothing is invented here.
 * - Output is screened with the no-diagnosis / no-prescribing filter. A condition name is only allowed
 *   if the patient used that term themselves (`userText`).
 *
 * @returns {{ok: boolean, value?: object, problems: string[]}}
 */
export function validateSummary(raw, { userText = '' } = {}) {
  const problems = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, problems: ['summary is not a JSON object'] };
  }

  const value = {};
  for (const key of TEXT_FIELDS) {
    const text = clean(raw[key], FIELD_MAX);
    value[key] = text || NOT_REPORTED;
  }
  if (value.mainConcern === NOT_REPORTED) problems.push('mainConcern is missing');

  let questions = raw.questions;
  if (typeof questions === 'string') questions = [questions];
  if (!Array.isArray(questions)) questions = [];
  value.questions = questions
    .map((q) => clean(q, QUESTION_MAX))
    .filter(Boolean)
    .slice(0, MAX_QUESTIONS);

  const combined = [...TEXT_FIELDS.map((k) => value[k]), ...value.questions].join('\n');
  const screen = screenText(combined, { userText });
  if (!screen.ok) problems.push(...screen.violations);

  return { ok: problems.length === 0, value, problems };
}
