/**
 * Service to manage formatting and downloading of summary reports.
 */

export function buildDownloadableReportText(summary, patientName = 'Patient') {
  let content = '';

  if (typeof summary === 'string') {
    content = summary.trim();
  } else if (typeof summary === 'object' && summary !== null) {
    if (summary.fullText) {
      content = summary.fullText.trim();
    } else {
      content = [
        `MAIN CONCERN:`,
        `${summary.mainConcern || 'N/A'}`,
        ``,
        `REPORTED SYMPTOMS:`,
        `${summary.symptoms || 'N/A'}`,
        ``,
        `DURATION:`,
        `${summary.duration || 'N/A'}`,
        ``,
        `AFFECTED AREA:`,
        `${summary.affectedArea || 'N/A'}`,
        ``,
        `TRIGGERS / RECENT CHANGES:`,
        `${summary.triggers || 'None reported'}`,
        ``,
        `IMAGE OBSERVATIONS (NON-DIAGNOSTIC):`,
        `${summary.observations || 'N/A'}`,
        ``,
        `QUESTIONS FOR YOUR DERMATOLOGIST:`,
        ...(Array.isArray(summary.questions) ? summary.questions.map((q) => `- ${q}`) : ['- None listed']),
      ].join('\n');
    }
  }

  return `============================================================\n` +
         `SKINSIGHT AI CONSULTATION REPORT\n` +
         `Patient: ${patientName}\n` +
         `Generated: ${new Date().toLocaleString()}\n` +
         `============================================================\n\n` +
         `${content}\n\n` +
         `------------------------------------------------------------\n` +
         `IMPORTANT NOTICE:\n` +
         `This summary was prepared using SKINSIGHT for consultation\n` +
         `preparation only. It is NOT a clinical diagnosis or treatment\n` +
         `recommendation. Please share this document with a certified\n` +
         `dermatologist during your clinical evaluation.\n` +
         `============================================================\n`;
}

