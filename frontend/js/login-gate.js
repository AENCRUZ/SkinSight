
// SKINSIGHT — Login gate & Clinic Email/Appointment Placeholder

(function () {
  "use strict";

  // ---- Authentication state --------------------------------------------------------------------------
  // The gate is a UX convenience; the backend still verifies the token on every API call.
  // Source of truth = the Supabase session stored under THIS project's key ("sb-<ref>-auth-token", the ref is
  // taken from SUPABASE_URL in js/supabase-config.js). Fail closed: if the key cannot be determined, nobody is
  // logged in. No other "sb-*" key is ever read, and the "skinsight_user" display cache (which can be stale)
  // is never treated as proof of authentication.
  var USER_CACHE_KEY = "skinsight_user";
  var HOME_PAGE = "index.html";

  // Pages that may be used as a post-login destination (exact file names). Login, signup, reset-password and
  // forgot-password are deliberately absent so ?next= can never cause a redirect loop. Keep in sync with auth.js.
  var NEXT_PAGES = [
    "index.html", "ai-assistant-intro.html", "ai-chat.html", "clinic-finder.html", "clinic-details.html",
    "no-clinic-available.html", "consultation-summary.html", "about.html",
    "medication-tracker.html", "medication-history.html", "add-medication.html"
  ];
  function safeNext(page) {
    return typeof page === "string" && NEXT_PAGES.indexOf(page) !== -1 ? page : null;
  }

  function projectTokenKey() {
    try {
      if (typeof SUPABASE_URL === "string" && SUPABASE_URL) {
        return "sb-" + new URL(SUPABASE_URL).hostname.split(".")[0] + "-auth-token";
      }
    } catch (e) { /* invalid SUPABASE_URL: no key can be derived, so nobody is logged in */ }
    return null;
  }

  // Synchronous hint from this project's stored session (no network). Used for instant decisions such as link
  // interception; page-level gates also confirm with verifySession().
  function getCurrentUser() {
    try {
      var key = projectTokenKey();
      if (!key) return null;
      var remember = false;
      try { remember = localStorage.getItem("skinsight_remember_me") === "true"; } catch (e) {}
      var raw = (remember ? localStorage : sessionStorage).getItem(key) || sessionStorage.getItem(key);
      if (!raw && remember) {
        raw = localStorage.getItem(key);
      }
      if (!raw) return null;
      var data = JSON.parse(raw);
      var u = data && (data.user || (data.currentSession && data.currentSession.user));
      if (!u || !u.id) return null;
      var meta = u.user_metadata || {};
      return {
        id: u.id,
        email: u.email || "",
        displayName: meta.display_name || meta.full_name || meta.name || (u.email ? u.email.split("@")[0] : "User")
      };
    } catch (e) { return null; }
  }

  function isLoggedIn() {
    return !!getCurrentUser();
  }

  // Authoritative check through the Supabase client (refreshes an expired access token when possible).
  // done(false) only when there is definitely no session; a transient error does not lock out a user who still
  // has a stored session.
  function verifySession(done) {
    var client = window.supabaseClient;
    if (!client || !client.auth) { done(false); return; }
    client.auth.getSession().then(function (res) {
      var session = res && res.data ? res.data.session : null;
      if (session && session.user) done(true);
      else if (res && res.error && isLoggedIn()) done(true);
      else done(false);
    }).catch(function () { done(isLoggedIn()); });
  }

  // Get tomorrow's date formatted as YYYY-MM-DD
  function getTomorrowDateString() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    var month = "" + (d.getMonth() + 1);
    var day = "" + d.getDate();
    var year = d.getFullYear();
    if (month.length < 2) month = "0" + month;
    if (day.length < 2) day = "0" + day;
    return [year, month, day].join("-");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var currentFile = window.location.pathname.split("/").pop();
    var isClinicDetails = currentFile === "clinic-details.html";
    var isConsultationSummary = currentFile === "consultation-summary.html";
    var isAiPage = currentFile === "ai-assistant-intro.html" || currentFile === "ai-chat.html";
    // On an AI page the gate blocks the whole page, so dismissing it goes back home.
    var redirectHomeOnClose = isAiPage;

    // Build Login Gate Modal
    var gateModal = document.createElement("div");
    gateModal.className = "login-gate";
    gateModal.id = "login-gate-modal";
    gateModal.setAttribute("role", "dialog");
    gateModal.setAttribute("aria-modal", "true");
    gateModal.setAttribute("aria-labelledby", "login-gate-title");
    gateModal.innerHTML =
      '<div class="login-gate-panel">' +
      '<button type="button" class="modal-close-btn" data-gate-close aria-label="Close modal">&times;</button>' +
      '<div class="login-gate-icon" aria-hidden="true">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
      '</div>' +
      '<h3 id="login-gate-title">Log in to view summary</h3>' +
      '<p id="login-gate-desc">Please log in or create a free account to view your consultation summary and send an email or appointment request to this clinic.</p>' +
      '<a href="login.html" id="gate-login-link" class="btn btn-primary btn-block">Log In</a>' +
      '<a href="signup.html" id="gate-signup-link" class="btn btn-secondary btn-block">Create an Account</a>' +
      '<button type="button" class="btn btn-ghost btn-block" data-gate-close>Not now</button>' +
      '</div>';
    document.body.appendChild(gateModal);

    // Focus management: the page behind the modal is made inert, Tab is trapped inside, and focus returns to the
    // element that opened it.
    var lastFocus = null;
    var inertedNodes = [];

    function setBackgroundInert(on) {
      if (on) {
        Array.prototype.forEach.call(document.body.children, function (el) {
          if (el === gateModal || el.tagName === "SCRIPT" || el.hasAttribute("inert")) return;
          el.setAttribute("inert", "");
          inertedNodes.push(el);
        });
      } else {
        inertedNodes.forEach(function (el) { el.removeAttribute("inert"); });
        inertedNodes = [];
      }
    }

    function gateFocusables() {
      return Array.prototype.slice.call(gateModal.querySelectorAll("a[href], button:not([disabled])"));
    }

    function openLoginGate(title, description, nextPage) {
      var titleEl = document.getElementById("login-gate-title");
      var descEl = document.getElementById("login-gate-desc");
      var loginLink = document.getElementById("gate-login-link");
      var signupLink = document.getElementById("gate-signup-link");

      if (title && titleEl) titleEl.textContent = title;
      if (description && descEl) descEl.textContent = description;

      var target = safeNext(nextPage || currentFile);
      var query = target ? "?next=" + encodeURIComponent(target) : "";
      if (loginLink) loginLink.href = "login.html" + query;
      if (signupLink) signupLink.href = "signup.html" + query;

      if (!gateModal.classList.contains("show")) {
        lastFocus = document.activeElement;
        setBackgroundInert(true);
        gateModal.classList.add("show");
        if (loginLink) loginLink.focus();
      }
    }

    function closeLoginGate() {
      if (!gateModal.classList.contains("show")) return;
      gateModal.classList.remove("show");
      setBackgroundInert(false);
      if (redirectHomeOnClose) {
        window.location.replace(HOME_PAGE);
        return;
      }
      if (lastFocus && document.contains(lastFocus) && typeof lastFocus.focus === "function") lastFocus.focus();
      lastFocus = null;
    }

    gateModal.addEventListener("click", function (e) {
      if (e.target === gateModal || e.target.hasAttribute("data-gate-close")) {
        closeLoginGate();
      }
    });

    // Build Clinic Email / Appointment Placeholder Modal
    var apptModal = document.createElement("div");
    apptModal.className = "login-gate";
    apptModal.id = "appointment-modal";
    apptModal.setAttribute("role", "dialog");
    apptModal.setAttribute("aria-modal", "true");
    apptModal.setAttribute("aria-labelledby", "appt-modal-title");
    apptModal.innerHTML =
      '<div class="login-gate-panel appointment-panel">' +
      '<button type="button" class="modal-close-btn" data-appt-close aria-label="Close modal">&times;</button>' +
      '<div id="appt-form-view">' +
      '<div class="appt-modal-header">' +
      '<div class="appt-badge">Appointment Request</div>' +
      '<h3 id="appt-modal-title">Appointment request</h3>' +
      '<p id="appt-modal-desc">Send an appointment inquiry and attach your consultation summary to the clinic.</p>' +
      '</div>' +
      '<form id="clinic-appointment-form" novalidate>' +
      '<div class="appt-grid">' +
      '<div class="appt-field">' +
      '<label for="appt-name">Patient Name</label>' +
      '<input type="text" id="appt-name" required value="" placeholder="Your name">' +
      '</div>' +
      '<div class="appt-field">' +
      '<label for="appt-email">Your Email Address</label>' +
      '<input type="email" id="appt-email" required value="">' +
      '</div>' +
      '</div>' +
      '<div class="appt-grid">' +
      '<div class="appt-field">' +
      '<label for="appt-doctor">Preferred Dermatologist</label>' +
      '<select id="appt-doctor">' +
      '<option value="First Available Dermatologist">First Available Dermatologist</option>' +
      '</select>' +
      '</div>' +
      '<div class="appt-field">' +
      '<label for="appt-date">Preferred Date</label>' +
      '<input type="date" id="appt-date" value="' + getTomorrowDateString() + '" required>' +
      '</div>' +
      '</div>' +
      '<div class="appt-field">' +
      '<label for="appt-time">Preferred Time Slot</label>' +
      '<select id="appt-time">' +
      '<option value="Morning">Morning (9:00 AM – 12:00 PM)</option>' +
      '<option value="Afternoon">Afternoon (1:00 PM – 5:00 PM)</option>' +
      '</select>' +
      '</div>' +
      '<div class="appt-summary-attachment">' +
      '<div class="appt-attach-icon">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' +
      '</div>' +
      '<div class="appt-attach-info">' +
      '<strong>Consultation Summary Attached</strong>' +
      '<span id="appt-attach-text">Your AI Skin Assistant consultation notes will be shared.</span>' +
      '</div>' +
      '</div>' +
      '<div class="appt-field">' +
      '<label for="appt-notes">Additional Notes for the Clinic (Optional)</label>' +
      '<textarea id="appt-notes" rows="2" placeholder="e.g. Please let me know available slots this Thursday."></textarea>' +
      '</div>' +
      '<div class="appt-actions">' +
      '<button type="submit" class="btn btn-primary btn-block" id="btn-submit-appt">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
      'Submit Appointment Request' +
      '</button>' +
      '<button type="button" class="btn btn-ghost btn-block" data-appt-close>Cancel</button>' +
      '</div>' +
      '</form>' +
      '</div>' +
      '<div id="appt-success-view" style="display:none;">' +
      '<div class="appt-success-icon">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
      '</div>' +
      '<h3>Appointment Request Prepared</h3>' +
      '<p id="appt-success-desc">Your request has been prepared for the clinic.</p>' +
      '<div class="appt-ref-box">' +
      '<span class="ref-label">Reference Code</span>' +
      '<span class="ref-code" id="appt-ref-id">SKIN-84291</span>' +
      '</div>' +
      '<p class="appt-subtext">You can also send this inquiry directly to the clinic via email or call them using the contact details on the clinic page.</p>' +
      '<div class="appt-actions">' +
      '<button type="button" class="btn btn-primary btn-block" data-appt-close>Done</button>' +
      '<a id="appt-mailto-fallback" class="btn btn-secondary btn-sm btn-block" href="#">Open Email Draft in Mail App</a>' +
      '</div>' +
      '</div>' +
      '</div>';
    document.body.appendChild(apptModal);

    function openAppointmentModal() {
      var user = getCurrentUser();
      var nameInput = document.getElementById("appt-name");
      var emailInput = document.getElementById("appt-email");
      var formView = document.getElementById("appt-form-view");
      var successView = document.getElementById("appt-success-view");

      if (formView) formView.style.display = "block";
      if (successView) successView.style.display = "none";

      var params = new URLSearchParams(window.location.search);
      var clinicId = params.get("id") || params.get("clinic");
      if (!clinicId) {
        try { clinicId = sessionStorage.getItem("skinsight_selected_clinic_id"); } catch (e) {}
      }
      var clinic = (window.SkinsightClinics && window.SkinsightClinics.getClinicById) ? window.SkinsightClinics.getClinicById(clinicId) : null;
      var clinicName = clinic ? clinic.name : "Batangas Dermatology Clinic";
      var clinicAddress = clinic ? clinic.address : "Batangas Province, Philippines";

      var modalTitle = document.getElementById("appt-modal-title");
      if (modalTitle) modalTitle.textContent = "Appointment Request — " + clinicName;

      var modalDesc = document.getElementById("appt-modal-desc");
      if (modalDesc) modalDesc.innerHTML = "Send an appointment inquiry and attach your consultation summary to <strong>" + clinicName + "</strong> (" + clinicAddress + ").";

      var docSelect = document.getElementById("appt-doctor");
      if (docSelect) {
        var docHtml = "";
        if (clinic && clinic.doctors && clinic.doctors.length > 0) {
          clinic.doctors.forEach(function (doc) {
            docHtml += '<option value="' + doc.name + '">' + doc.name + ' (' + doc.role + ')</option>';
          });
        }
        docHtml += '<option value="First Available Dermatologist">First Available Dermatologist</option>';
        docSelect.innerHTML = docHtml;
      }

      var attachText = document.getElementById("appt-attach-text");
      if (attachText) {
        var hasRealSummary = false;
        try {
          var rawSummary = sessionStorage.getItem("skinsight_consultation_summary");
          if (rawSummary) {
            var parsed = JSON.parse(rawSummary);
            if (parsed && (parsed.mainConcern || parsed.symptoms)) {
              hasRealSummary = true;
              attachText.textContent = "AI Consultation Summary attached (" + (parsed.mainConcern || "Dermatology Consultation") + ").";
            }
          }
        } catch (e) {}
        if (!hasRealSummary) {
          attachText.textContent = "AI Consultation Summary attached (Non-diagnostic informational summary).";
        }
      }

      if (user) {
        if (nameInput) nameInput.value = user.displayName || "";
        if (emailInput) emailInput.value = user.email || "";
      }

      var dateInput = document.getElementById("appt-date");
      if (dateInput && !dateInput.value) {
        dateInput.value = getTomorrowDateString();
      }

      apptModal.classList.add("show");
    }

    function closeAppointmentModal() {
      apptModal.classList.remove("show");
    }

    apptModal.addEventListener("click", function (e) {
      if (e.target === apptModal || e.target.hasAttribute("data-appt-close")) {
        closeAppointmentModal();
      }
    });

    // Handle appointment form submission (interactive simulation)
    var apptForm = document.getElementById("clinic-appointment-form");
    if (apptForm) {
      apptForm.addEventListener("submit", function (e) {
        e.preventDefault();

        if (!apptForm.checkValidity()) {
          apptForm.reportValidity();
          return;
        }

        var submitBtn = document.getElementById("btn-submit-appt");
        var originalText = submitBtn ? submitBtn.innerHTML : "Send";
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerText = "Preparing preview...";
        }

        var userEmail = (document.getElementById("appt-email") || {}).value || "your email";
        var userName = (document.getElementById("appt-name") || {}).value || "Patient";
        var doctorName = (document.getElementById("appt-doctor") || {}).value || "First Available";
        var preferredDate = (document.getElementById("appt-date") || {}).value || getTomorrowDateString();
        var preferredTime = (document.getElementById("appt-time") || {}).value || "Morning";

        var params = new URLSearchParams(window.location.search);
        var clinicId = params.get("id") || params.get("clinic");
        if (!clinicId) {
          try { clinicId = sessionStorage.getItem("skinsight_selected_clinic_id"); } catch (e) {}
        }
        var clinic = (window.SkinsightClinics && window.SkinsightClinics.getClinicById) ? window.SkinsightClinics.getClinicById(clinicId) : null;
        var clinicName = clinic ? clinic.name : "Batangas Dermatology Clinic";
        var clinicEmail = clinic ? clinic.email : "";

        // Simulate sending network request (800ms)
        setTimeout(function () {
          var formView = document.getElementById("appt-form-view");
          var successView = document.getElementById("appt-success-view");
          var refIdEl = document.getElementById("appt-ref-id");
          var successDesc = document.getElementById("appt-success-desc");
          var mailtoFallback = document.getElementById("appt-mailto-fallback");

          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
          }

          if (refIdEl) {
            refIdEl.textContent = "SKIN-" + Math.floor(10000 + Math.random() * 90000);
          }
          if (successDesc) {
            successDesc.innerHTML = "Your appointment request has been prepared for <strong>" + clinicName + "</strong>.";
          }
          if (mailtoFallback) {
            var subject = encodeURIComponent("Consultation Summary & Appointment Request: " + doctorName + " — " + clinicName);
            var body = encodeURIComponent("Hello " + clinicName + ",\n\nI would like to request an appointment on " + preferredDate + " (" + preferredTime + ") with " + doctorName + ".\n\nPlease find my SKINSIGHT Consultation Summary attached.\n\nPatient Name: " + userName + "\nContact: " + userEmail);
            mailtoFallback.href = "mailto:" + clinicEmail + "?subject=" + subject + "&body=" + body;
            mailtoFallback.textContent = "Draft email to " + clinicName;
          }

          if (formView) formView.style.display = "none";
          if (successView) successView.style.display = "block";
        }, 800);
      });
    }

    // Page Interceptors

    if (isClinicDetails) {
      // In clinic-details.html, the direct interactive form handles sending email, copying, and downloading.
      // We do not intercept direct email links or the send-option button on clinic-details.html.
      var legacyApptBtn = document.getElementById("btn-book-appointment-modal");
      if (legacyApptBtn) {
        legacyApptBtn.addEventListener("click", function (e) {
          e.preventDefault();
          if (!isLoggedIn()) {
            openLoginGate(
              "Log in to request an appointment",
              "Please log in or create a free account to request an appointment with this clinic.",
              "clinic-details.html"
            );
          } else {
            openAppointmentModal();
          }
        });
      }

      var summaryLink = document.getElementById("link-consultation-summary") ||
        document.querySelector('a[href*="consultation-summary.html"]');

      if (summaryLink) {
        summaryLink.addEventListener("click", function (e) {
          if (!isLoggedIn()) {
            e.preventDefault();
            e.stopPropagation();
            openLoginGate(
              "Log in to view summary",
              "Please log in or create an account to view and review your consultation summary.",
              "consultation-summary.html"
            );
          }
        });
      }
    }

    // ---- Page protection (AI Skin Assistant + consultation summary) ----
    var AI_GATE_TITLE = "Log in to use the AI Skin Assistant";
    var AI_GATE_DESC = "Please log in or create a free account to chat with the AI Skin Assistant.";
    var SUMMARY_GATE_TITLE = "Log in to view your summary";
    var SUMMARY_GATE_DESC = "Please log in or create a free account to view and save your complete consultation summary.";

    function enforcePage() {
      var open = null;
      if (isAiPage) open = function () { openLoginGate(AI_GATE_TITLE, AI_GATE_DESC, currentFile); };
      else if (isConsultationSummary) open = function () { openLoginGate(SUMMARY_GATE_TITLE, SUMMARY_GATE_DESC, "consultation-summary.html"); };
      if (!open) return;
      if (!isLoggedIn()) { open(); return; }          // no stored session for this project: gate immediately
      verifySession(function (ok) { if (!ok) open(); }); // stored session: confirm it is still valid
    }

    // 1) Clicking any link to the AI pages while logged out (header, footer, buttons, cards: delegated)
    document.addEventListener("click", function (e) {
      if (isLoggedIn()) return;
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || a.origin !== window.location.origin) return;
      var file = a.pathname.split("/").pop();
      if (file === "ai-assistant-intro.html" || file === "ai-chat.html") {
        e.preventDefault();
        e.stopPropagation();
        openLoginGate(AI_GATE_TITLE, AI_GATE_DESC, file);
      }
    }, true);

    // 2) Direct URL, Back/Forward (bfcache), another tab signing out, session ending
    enforcePage();
    window.addEventListener("pageshow", enforcePage);
    window.addEventListener("storage", function (e) {
      if (e.key === null || e.key === USER_CACHE_KEY || e.key === projectTokenKey()) enforcePage();
    });
    if (window.supabaseClient && window.supabaseClient.auth) {
      window.supabaseClient.auth.onAuthStateChange(function (event) {
        // deferred: never call back into supabase-js from inside its own callback
        if (event === "SIGNED_OUT") setTimeout(enforcePage, 0);
      });
    }

    // Keyboard: Escape closes the open modal; Tab stays inside the login gate while it is open
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeLoginGate();
        closeAppointmentModal();
        return;
      }
      if (e.key === "Tab" && gateModal.classList.contains("show")) {
        var items = gateFocusables();
        if (!items.length) return;
        var first = items[0], last = items[items.length - 1];
        if (!gateModal.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  });
})();
