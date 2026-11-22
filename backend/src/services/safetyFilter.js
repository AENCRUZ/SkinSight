/**
 * Lightweight output screen for the "no diagnosis / no prescribing" rules.
 *
 * It is a SECOND line of defence behind the system prompt, not a replacement for it.
 * It flags (a) names of skin conditions the user did not mention themselves,
 * (b) diagnostic phrasing, and (c) medication recommendations / dosages.
 * Questions are never flagged for medication words ("Have you used hydrocortisone?").
 *
 * The term lists are intentionally easy to edit — coordinate additions with the AI owner.
 */

export const CONDITION_TERMS = [
  'eczema', 'atopic dermatitis', 'dermatitis', 'psoriasis', 'ringworm', 'tinea', 'melanoma',
  'carcinoma', 'skin cancer', 'rosacea', 'vitiligo', 'scabies', 'impetigo', 'cellulitis',
  'shingles', 'herpes', 'urticaria', 'hives', 'acne', 'folliculitis', 'lupus', 'seborrheic',
  'keratosis', 'hidradenitis', 'lichen planus', 'measles', 'chickenpox', 'fungal infection',
  'bacterial infection', 'yeast infection', 'stevens-johnson', 'necrotizing fasciitis',
  'meningococcemia', 'vasculitis', 'mange', 'warts',
];

const DIAGNOSTIC_PHRASES = [
  /\byou (probably|likely|possibly|may|might|could)? ?(have|be suffering from|be experiencing a case of)\s+(an?\s+)?[a-z-]+\s+(infection|disease|disorder|condition|syndrome)\b/i,
  /\b(this|that|it) (looks|seems|appears|sounds) (like|to be) (an?\s+)?(infection|allergy|allergic reaction|disease|disorder|syndrome|fungus|virus)\b/i,
  /\b(this|that|it) is (most likely|probably|likely|definitely|certainly|clearly)\b/i,
  /\byour (diagnosis|condition) is\b/i,
  /\bI (diagnose|can confirm you have)\b/i,
];

const MEDICATION_TERMS = [
  'hydrocortisone', 'cortisone', 'corticosteroid', 'steroid', 'prednisone', 'clobetasol',
  'triamcinolone', 'antihistamine', 'benadryl', 'diphenhydramine', 'cetirizine', 'loratadine',
  'antibiotic', 'antifungal', 'clotrimazole', 'miconazole', 'ketoconazole', 'terbinafine',
  'tretinoin', 'retinoid', 'adapalene', 'benzoyl peroxide', 'salicylic acid', 'ibuprofen',
  'paracetamol', 'acetaminophen', 'aspirin', 'isotretinoin', 'minoxidil', 'calamine',
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termRegex = (terms) => new RegExp(`\\b(${terms.map(escapeRe).join('|')})\\b`, 'gi');
const CONDITION_RE = termRegex(CONDITION_TERMS);
const MED_WORDS = MEDICATION_TERMS.map(escapeRe).join('|');
const MED_RECOMMEND_RE = new RegExp(
  `\\b(take|taking|use|using|apply|applying|try|trying|start|starting|buy|put|rub)\\b[^.?!\\n]{0,50}\\b(${MED_WORDS})\\b`,
  'i'
);
const DOSAGE_RE = /\b\d+(\.\d+)?\s?(mg|mcg|µg|ml|iu)\b/i;

function splitSentences(text) {
  return String(text).split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * @param {string} text   AI-written text to check
 * @param {{userText?: string}} [opts]  everything the USER wrote; a condition name they used
 *        themselves may be repeated when documenting what they reported.
 * @returns {{ok: boolean, violations: string[]}}
 */
export function screenText(text, { userText = '' } = {}) {
  const violations = [];
  const body = typeof text === 'string' ? text : '';
  if (!body.trim()) return { ok: true, violations };

  const userLower = String(userText).toLowerCase();
  const seen = new Set();
  for (const m of body.matchAll(CONDITION_RE)) {
    const term = m[1].toLowerCase();
    if (seen.has(term)) continue;
    seen.add(term);
    if (!userLower.includes(term)) violations.push(`names a possible condition: "${term}"`);
  }

  for (const re of DIAGNOSTIC_PHRASES) {
    if (re.test(body)) {
      violations.push('uses diagnostic phrasing');
      break;
    }
  }

  for (const sentence of splitSentences(body)) {
    const isQuestion = sentence.endsWith('?');
    if (!isQuestion && MED_RECOMMEND_RE.test(sentence)) {
      violations.push('recommends a medication or active ingredient');
      break;
    }
  }

  if (DOSAGE_RE.test(body) && !DOSAGE_RE.test(userText)) {
    violations.push('mentions a dosage');
  }

  return { ok: violations.length === 0, violations };
}

export const SAFE_FALLBACK_REPLY =
  "I'm here to help you document what you're noticing so a dermatologist can assess it — I can't say what a skin concern is or recommend treatments or medication.\n\n" +
  'Could you tell me more about what you have noticed, such as where it is on your body, how long it has been there, and whether it itches, stings or hurts? ' +
  'If you have trouble breathing, swelling of the face or lips, or a rapidly spreading rash with fever, please seek emergency medical care right away.';

export const CORRECTION_INSTRUCTION =
  'Your previous draft broke the SKINSIGHT rules. Rewrite your reply to the same user message with NO skin condition names, ' +
  'NO suggestion of what the problem might be, NO medication or product recommendations and NO dosages. ' +
  'Only ask 1-2 clarifying intake questions, reflect back what the user reported, and suggest seeing a dermatologist.';
