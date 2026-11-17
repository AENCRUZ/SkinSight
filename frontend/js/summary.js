/**
 * Summary Controller for SKINSIGHT Consultation Summary
 * Synchronizes the AI's generated summary with the consultation summary page
 * and handles downloading (.txt and .pdf) and copying.
 */

(function () {
  const downloadTxtBtn = document.getElementById('downloadTxtBtn');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const copySummaryBtn = document.getElementById('copySummaryBtn');
  const confirmBox = document.querySelector('.copy-confirm');

  // Fields on consultation-summary.html
  const mainConcernEl = document.getElementById('summaryMainConcern');
  const symptomsEl = document.getElementById('summarySymptoms');
  const durationEl = document.getElementById('summaryDuration');
  const affectedAreaEl = document.getElementById('summaryAffectedArea');
  const triggersEl = document.getElementById('summaryTriggers');
  const observationsEl = document.getElementById('summaryObservations');
  const questionsEl = document.getElementById('summaryQuestions');
  const printableArea = document.getElementById('printableSummary');

  let currentSummaryData = null;

  async function initSummary() {
    setupActionListeners();

    const rawHistory = sessionStorage.getItem('skinsight_chat_history');
    if (!rawHistory) {
      // User accessed page directly without a chat session — load default demo data
      return;
    }

    let history = [];
    try {
      history = JSON.parse(rawHistory);
    } catch (e) {
      return;
    }

    if (!Array.isArray(history) || history.length === 0) return;

    // Check if we already compiled a summary for this session
    const cached = sessionStorage.getItem('skinsight_consultation_summary');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          currentSummaryData = parsed;
          renderSummary(parsed);
          return;
        }
      } catch (e) {
        // Fall through to fetch fresh
      }
    }

    // Generate fresh summary from backend
    try {
      if (window.SkinsightAPI) {
        setLoadingState(true);
        const res = await window.SkinsightAPI.generateSummary(history);
        setLoadingState(false);

        if (res && res.summary) {
          const summaryObj = typeof res.summary === 'string'
            ? safeParseJson(res.summary)
            : res.summary;

          currentSummaryData = summaryObj;
          sessionStorage.setItem('skinsight_consultation_summary', JSON.stringify(summaryObj));
          renderSummary(summaryObj);
        }
      }
    } catch (err) {
      console.warn('Could not generate dynamic summary from backend:', err);
      setLoadingState(false);
    }
  }

  function setLoadingState(isLoading) {
    if (isLoading) {
      if (mainConcernEl) mainConcernEl.innerHTML = '<em>Analyzing conversation & compiling concerns...</em>';
      if (symptomsEl) symptomsEl.innerHTML = '<em>Extracting symptoms...</em>';
      if (durationEl) durationEl.innerHTML = '<em>Calculating timeline...</em>';
      if (affectedAreaEl) affectedAreaEl.innerHTML = '<em>Locating affected area...</em>';
      if (triggersEl) triggersEl.innerHTML = '<em>Reviewing triggers...</em>';
      if (observationsEl) observationsEl.innerHTML = '<em>Compiling non-diagnostic observations...</em>';
      if (questionsEl) questionsEl.innerHTML = '<li><em>Formulating doctor questions...</em></li>';
    }
  }

  function renderSummary(data) {
    if (!data) return;

    if (mainConcernEl) mainConcernEl.textContent = data.mainConcern || 'Not specified';
    if (symptomsEl) symptomsEl.textContent = data.symptoms || 'None reported';
    if (durationEl) durationEl.textContent = data.duration || 'Not specified';
    if (affectedAreaEl) affectedAreaEl.textContent = data.affectedArea || 'Not specified';
    if (triggersEl) triggersEl.textContent = data.triggers || 'None reported';
    if (observationsEl) observationsEl.textContent = data.observations || 'No specific visual observations';

    if (questionsEl && Array.isArray(data.questions)) {
      questionsEl.innerHTML = data.questions
        .map((q) => `<li>${escapeHtml(q)}</li>`)
        .join('');
    } else if (questionsEl && typeof data.questions === 'string') {
      questionsEl.innerHTML = `<li>${escapeHtml(data.questions)}</li>`;
    }
  }

  function setupActionListeners() {
    // 1. Download as Text File (.txt)
    if (downloadTxtBtn) {
      downloadTxtBtn.addEventListener('click', handleDownloadTxt);
    }

    // 2. Download as PDF File (.pdf)
    if (downloadPdfBtn) {
      downloadPdfBtn.addEventListener('click', handleDownloadPdf);
    }

    // 3. Copy Summary to Clipboard
    if (copySummaryBtn) {
      copySummaryBtn.addEventListener('click', handleCopySummary);
    }
  }

  function getFormattedReportText() {
    if (currentSummaryData && currentSummaryData.fullText) {
      return currentSummaryData.fullText;
    }

    // Build plain text report from active cards
    const mainConcern = mainConcernEl ? mainConcernEl.textContent.trim() : '';
    const symptoms = symptomsEl ? symptomsEl.textContent.trim() : '';
    const duration = durationEl ? durationEl.textContent.trim() : '';
    const affectedArea = affectedAreaEl ? affectedAreaEl.textContent.trim() : '';
    const triggers = triggersEl ? triggersEl.textContent.trim() : '';
    const observations = observationsEl ? observationsEl.textContent.trim() : '';

    let questions = [];
    if (questionsEl) {
      questions = Array.from(questionsEl.querySelectorAll('li')).map((li) => li.textContent.trim());
    }

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
      `1. MAIN CONCERN:\n   ${mainConcern}\n\n` +
      `2. REPORTED SYMPTOMS:\n   ${symptoms}\n\n` +
      `3. DURATION:\n   ${duration}\n\n` +
      `4. AFFECTED AREA:\n   ${affectedArea}\n\n` +
      `5. TRIGGERS / RECENT CHANGES:\n   ${triggers}\n\n` +
      `6. IMAGE OBSERVATIONS (NON-DIAGNOSTIC):\n   ${observations}\n\n` +
      `7. QUESTIONS TO DISCUSS WITH YOUR DERMATOLOGIST:\n` +
      questions.map((q) => `   - ${q}`).join('\n') +
      `\n\n============================================================\n` +
      `CLINICAL DISCLAIMER:\n` +
      `This report is an informational intake summary created using SKINSIGHT\n` +
      `and is NOT a medical diagnosis, prescription, or treatment plan.\n` +
      `Please share this report with a board-certified dermatologist.\n` +
      `============================================================\n`
    );
  }

  function handleDownloadTxt() {
    const textContent = getFormattedReportText();
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

        const rawLines = textContent.split('\n');
        const printableLines = [];

        rawLines.forEach((line) => {
          if (line.trim().length === 0) {
            printableLines.push('');
          } else {
            const wrapped = doc.splitTextToSize(line, maxLineWidth);
            printableLines.push(...wrapped);
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
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textContent).then(showToast).catch(showToast);
    } else {
      showToast();
    }
  }

  function showToast() {
    if (confirmBox) {
      confirmBox.classList.add('show');
      setTimeout(() => confirmBox.classList.remove('show'), 2500);
    }
  }

  function safeParseJson(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function resetSummaryView() {
    currentSummaryData = null;
    if (mainConcernEl) mainConcernEl.textContent = 'Not specified';
    if (symptomsEl) symptomsEl.textContent = 'None reported';
    if (durationEl) durationEl.textContent = 'Not specified';
    if (affectedAreaEl) affectedAreaEl.textContent = 'Not specified';
    if (triggersEl) triggersEl.textContent = 'None reported';
    if (observationsEl) observationsEl.textContent = 'No observations available';
    if (questionsEl) questionsEl.innerHTML = '<li>No questions formulated yet.</li>';
  }

  // Handle Back-Forward Cache (bfcache) navigation
  window.addEventListener('pageshow', function (event) {
    const rawHistory = sessionStorage.getItem('skinsight_chat_history');
    if (!rawHistory) {
      resetSummaryView();
    }
  });

  // Cross-tab logout listener
  window.addEventListener('storage', function (e) {
    if (e.key === 'skinsight_user' && !e.newValue) {
      try {
        sessionStorage.removeItem('skinsight_chat_history');
        sessionStorage.removeItem('skinsight_consultation_summary');
      } catch (err) { }
      resetSummaryView();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSummary);
  } else {
    initSummary();
  }
})();
