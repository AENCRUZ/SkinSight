/**
 * Summary Controller for SKINSIGHT Consultation Summary
 * Loads the summary for the current conversation (from the cache or the backend), shows loading / empty /
 * error states, and handles downloading (.txt and .pdf) and copying.
 *
 * Downloads are always built from the validated summary FIELDS shown on the page — never from free text
 * written by the model.
 */

(function () {
  const downloadTxtBtn = document.getElementById('downloadTxtBtn');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const copySummaryBtn = document.getElementById('copySummaryBtn');
  const confirmBox = document.querySelector('.copy-confirm');

  const emptyEl = document.getElementById('summaryEmpty');
  const errorEl = document.getElementById('summaryError');
  const errorTextEl = document.getElementById('summaryErrorText');
  const retryBtn = document.getElementById('summaryRetryBtn');
  const printableArea = document.getElementById('printableSummary');

  // Fields on consultation-summary.html
  const mainConcernEl = document.getElementById('summaryMainConcern');
  const symptomsEl = document.getElementById('summarySymptoms');
  const durationEl = document.getElementById('summaryDuration');
  const affectedAreaEl = document.getElementById('summaryAffectedArea');
  const triggersEl = document.getElementById('summaryTriggers');
  const observationsEl = document.getElementById('summaryObservations');
  const questionsEl = document.getElementById('summaryQuestions');

  const KEY_HISTORY = 'skinsight_chat_history';
  const KEY_SUMMARY = 'skinsight_consultation_summary';
  const KEY_CURRENT = 'skinsight_ui_current';

  let currentSummaryData = null;
  let requestToken = 0;

  // ---- view states -----------------------------------------------------------------------------------
  function setActionsEnabled(on) {
    [downloadTxtBtn, downloadPdfBtn, copySummaryBtn].forEach((b) => {
      if (b) b.disabled = !on;
    });
  }

  function showView(state, message) {
    if (emptyEl) emptyEl.classList.toggle('show', state === 'empty');
    if (errorEl) errorEl.hidden = state !== 'error';
    if (printableArea) printableArea.hidden = state === 'empty' || state === 'error';
    if (errorTextEl && message) errorTextEl.textContent = message;
    setActionsEnabled(state === 'ready');
    if (printableArea) printableArea.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
  }

  function setLoadingState() {
    showView('loading');
    if (mainConcernEl) mainConcernEl.textContent = 'Preparing your summary…';
    if (symptomsEl) symptomsEl.textContent = '…';
    if (durationEl) durationEl.textContent = '…';
    if (affectedAreaEl) affectedAreaEl.textContent = '…';
    if (triggersEl) triggersEl.textContent = '…';
    if (observationsEl) observationsEl.textContent = '…';
    if (questionsEl) questionsEl.innerHTML = '<li>…</li>';
  }

  // ---- data ------------------------------------------------------------------------------------------
  function readJson(storage, key) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function str(v, fallback) {
    return typeof v === 'string' && v.trim() ? v.trim() : fallback;
  }

  // Accept only the known fields; anything else (including a model-written "fullText") is ignored.
  function normalizeSummary(data) {
    if (!data || typeof data !== 'object') return null;
    let questions = data.questions;
    if (typeof questions === 'string') questions = [questions];
    if (!Array.isArray(questions)) questions = [];
    const mainConcern = str(data.mainConcern, '');
    if (!mainConcern) return null;
    return {
      mainConcern,
      symptoms: str(data.symptoms, 'Not reported'),
      duration: str(data.duration, 'Not reported'),
      affectedArea: str(data.affectedArea, 'Not reported'),
      triggers: str(data.triggers, 'Not reported'),
      observations: str(data.observations, 'Not reported'),
      questions: questions.filter((q) => typeof q === 'string' && q.trim()).map((q) => q.trim()),
    };
  }

  async function initSummary() {
    setupActionListeners();
    await loadSummary();
  }

  async function loadSummary() {
    const token = ++requestToken;
    const history = readJson(sessionStorage, KEY_HISTORY);

    if (!Array.isArray(history) || history.length === 0) {
      currentSummaryData = null;
      showView('empty');
      return;
    }

    const cached = normalizeSummary(readJson(sessionStorage, KEY_SUMMARY));
    if (cached) {
      currentSummaryData = cached;
      renderSummary(cached);
      showView('ready');
      return;
    }

    if (!window.SkinsightAPI) {
      showView('error', 'The assistant service is not available. Please reload the page.');
      return;
    }

    setLoadingState();
    try {
      const res = await window.SkinsightAPI.generateSummary(history);
      if (token !== requestToken) return; // a newer request replaced this one
      const summary = normalizeSummary(res && res.summary);
      if (!summary) throw new Error('The summary came back incomplete.');

      currentSummaryData = summary;
      try { sessionStorage.setItem(KEY_SUMMARY, JSON.stringify(summary)); } catch (e) { /* storage full */ }
      renderSummary(summary);
      showView('ready');
      saveSummaryToAccount(summary);
    } catch (err) {
      if (token !== requestToken) return;
      console.warn('Could not generate summary:', err);
      currentSummaryData = null;
      showView('error', friendlyError(err));
    }
  }

  function friendlyError(err) {
    const code = err && err.code;
    const msg = (err && err.message) || '';
    if (code === 'auth') {
      return 'Your session has expired. Please log in again, then reopen your summary.';
    }
    if (code === 'network' || code === 'timeout') {
      return 'We couldn’t reach the assistant. It may be waking up, so please wait a few seconds and press Try again.';
    }
    return msg || 'We couldn’t generate your summary. Please try again.';
  }

  // Keep the generated summary with the saved consultation so it can be reopened later.
  function saveSummaryToAccount(summary) {
    try {
      const meta = readJson(sessionStorage, KEY_CURRENT);
      if (meta && meta.id && window.SkinsightHistory) {
        window.SkinsightHistory.saveSummary(meta.id, summary);
      }
    } catch (e) { /* history is optional */ }
  }

  function renderSummary(data) {
    if (!data) return;

    if (mainConcernEl) mainConcernEl.textContent = data.mainConcern;
    if (symptomsEl) symptomsEl.textContent = data.symptoms;
    if (durationEl) durationEl.textContent = data.duration;
    if (affectedAreaEl) affectedAreaEl.textContent = data.affectedArea;
    if (triggersEl) triggersEl.textContent = data.triggers;
    if (observationsEl) observationsEl.textContent = data.observations;

    if (questionsEl) {
      questionsEl.innerHTML = data.questions.length
        ? data.questions.map((q) => `<li>${escapeHtml(q)}</li>`).join('')
        : '<li>No questions were suggested.</li>';
    }
  }

  function setupActionListeners() {
    if (downloadTxtBtn) downloadTxtBtn.addEventListener('click', handleDownloadTxt);
    if (downloadPdfBtn) downloadPdfBtn.addEventListener('click', handleDownloadPdf);
    if (copySummaryBtn) copySummaryBtn.addEventListener('click', handleCopySummary);
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        try { sessionStorage.removeItem(KEY_SUMMARY); } catch (e) { }
        loadSummary();
      });
    }
  }

  // ---- report text -----------------------------------------------------------------------------------
  function getFormattedReportText() {
    const d = currentSummaryData;
    if (!d) return '';

    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return (
      `============================================================\n` +
      `SKINSIGHT CONSULTATION INTAKE REPORT\n` +
      `Generated: ${dateStr}\n` +
      `============================================================\n\n` +
      `1. MAIN CONCERN:\n   ${d.mainConcern}\n\n` +
      `2. REPORTED SYMPTOMS:\n   ${d.symptoms}\n\n` +
      `3. DURATION:\n   ${d.duration}\n\n` +
      `4. AFFECTED AREA:\n   ${d.affectedArea}\n\n` +
      `5. TRIGGERS / RECENT CHANGES:\n   ${d.triggers}\n\n` +
      `6. APPEARANCE / PHOTO NOTE (AS DESCRIBED BY THE PATIENT):\n   ${d.observations}\n\n` +
      `7. QUESTIONS TO DISCUSS WITH YOUR DERMATOLOGIST:\n` +
      (d.questions.length ? d.questions.map((q) => `   - ${q}`).join('\n') : '   - None listed') +
      `\n\n============================================================\n` +
      `NOTICE:\n` +
      `This report records what the user reported to SKINSIGHT. It is NOT a\n` +
      `medical diagnosis, prescription, or treatment plan. Please share it\n` +
      `with a licensed dermatologist.\n` +
      `============================================================\n`
    );
  }

  function handleDownloadTxt() {
    const textContent = getFormattedReportText();
    if (!textContent) return;
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skinsight-consultation-summary.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleDownloadPdf() {
    const textContent = getFormattedReportText();
    if (!textContent) return;

    const jsPdfClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (jsPdfClass) {
      try {
        const doc = new jsPdfClass({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 16;
        const maxLineWidth = pageWidth - margin * 2;
        const lineHeight = 5.2;

        // Monospaced Courier font ensures the ASCII border lines and indentation align perfectly
        doc.setFont('courier', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(20, 20, 20);

        const printableLines = [];
        textContent.split('\n').forEach((line) => {
          if (line.trim().length === 0) {
            printableLines.push('');
          } else {
            printableLines.push(...doc.splitTextToSize(line, maxLineWidth));
          }
        });

        let cursorY = margin + 5;
        for (let i = 0; i < printableLines.length; i++) {
          if (cursorY + lineHeight > pageHeight - margin) {
            doc.addPage();
            cursorY = margin + 5;
          }
          doc.text(printableLines[i], margin, cursorY);
          cursorY += lineHeight;
        }

        doc.save('skinsight-consultation-summary.pdf');
        return;
      } catch (err) {
        console.error('jsPDF generation failed:', err);
      }
    }

    // Fallback if jsPDF is not available
    window.print();
  }

  function handleCopySummary() {
    const textContent = getFormattedReportText();
    if (!textContent) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textContent).then(() => showToast('Copied to clipboard.')).catch(() => showToast('Couldn’t copy automatically — select the text and copy it manually.'));
    } else {
      showToast('Copying isn’t supported in this browser — select the text and copy it manually.');
    }
  }

  function showToast(message) {
    if (confirmBox) {
      if (message) confirmBox.textContent = message;
      confirmBox.classList.add('show');
      setTimeout(() => confirmBox.classList.remove('show'), 2500);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Handle Back-Forward Cache (bfcache) navigation
  window.addEventListener('pageshow', function () {
    const rawHistory = sessionStorage.getItem(KEY_HISTORY);
    if (!rawHistory) {
      currentSummaryData = null;
      showView('empty');
    }
  });

  // Cross-tab logout listener
  window.addEventListener('storage', function (e) {
    if (e.key === 'skinsight_user' && !e.newValue) {
      try {
        sessionStorage.removeItem(KEY_HISTORY);
        sessionStorage.removeItem(KEY_SUMMARY);
      } catch (err) { }
      currentSummaryData = null;
      showView('empty');
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSummary);
  } else {
    initSummary();
  }
})();
