/**
 * Service to manage formatting and downloading of summary reports.
 * The report is always built from the validated summary FIELDS — free text written by the model
 * (e.g. a "fullText" property) is never trusted or copied into the file.
 */

const str = (v, fallback) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);

export function buildDownloadableReportText(summary, patientName = 'Patient') {
  const s = summary && typeof summary === 'object' ? summary : {};
  const questions = Array.isArray(s.questions) ? s.questions.filter((q) => typeof q === 'string' && q.trim()) : [];

  const content = [
    `MAIN CONCERN:`,
    str(s.mainConcern, 'Not reported'),
    ``,
    `REPORTED SYMPTOMS:`,
    str(s.symptoms, 'Not reported'),
    ``,
    `DURATION:`,
    str(s.duration, 'Not reported'),
    ``,
    `AFFECTED AREA:`,
    str(s.affectedArea, 'Not reported'),
    ``,
    `TRIGGERS / RECENT CHANGES:`,
    str(s.triggers, 'Not reported'),
    ``,
    `PATIENT-DESCRIBED APPEARANCE / PHOTO NOTE:`,
    str(s.observations, 'Not reported'),
    ``,
    `QUESTIONS FOR YOUR DERMATOLOGIST:`,
    ...(questions.length ? questions.map((q) => `- ${q}`) : ['- None listed']),
  ].join('\n');

  return `============================================================\n` +
         `SKINSIGHT CONSULTATION INTAKE REPORT\n` +
         `Patient: ${patientName}\n` +
         `Generated: ${new Date().toLocaleString()}\n` +
         `============================================================\n\n` +
         `${content}\n\n` +
         `------------------------------------------------------------\n` +
         `IMPORTANT NOTICE:\n` +
         `This summary records what the user reported to SKINSIGHT. It is\n` +
         `NOT a clinical diagnosis, prescription or treatment recommendation.\n` +
         `Please share it with a certified dermatologist.\n` +
         `============================================================\n`;
}
