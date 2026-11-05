/*
 * SKINSIGHT — Login gate & Clinic Email/Appointment Placeholder
 * Handles:
 * 1. Checking whether user is logged in before viewing summary or sending email to clinic.
 * 2. Showing the "Log in to see summary" modal if unauthenticated.
 * 3. Showing a realistic interactive placeholder for sending an email/appointment request to the clinic if authenticated.
 */
(function () {
  "use strict";

  var AUTH_KEY = "skinsight_logged_in";

  // Helper to extract cached user data
  function getCurrentUser() {
    try {
      var raw = localStorage.getItem("skinsight_user");
      if (raw) return JSON.parse(raw);

      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("sb-") === 0 && k.indexOf("-auth-token") !== -1) {
          var sbRaw = localStorage.getItem(k);
          if (sbRaw) {
            var sb = JSON.parse(sbRaw);
            var u = sb.user || (sb.currentSession && sb.currentSession.user);
            if (u) {
              var meta = u.user_metadata || {};
              return {
                id: u.id,
                email: u.email || "",
                displayName: meta.display_name || meta.full_name || meta.name || (u.email ? u.email.split("@")[0] : "User")
              };
            }
          }
        }
      }
    } catch (e) { }
    return null;
  }

  // Check if user is currently authenticated
  function isLoggedIn() {
    if (getCurrentUser()) return true;
    try {
      if (localStorage.getItem(AUTH_KEY) === "true") return true;
    } catch (e) { }
    if (document.documentElement.classList.contains("auth-user-signed-in")) return true;
    return false;
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
    var isClinicDetails = window.location.pathname.indexOf("clinic-details.html") !== -1;
    var isConsultationSummary = window.location.pathname.indexOf("consultation-summary.html") !== -1;

    // ----------------------------------------------------
    // 1. Build Login Gate Modal
    // ----------------------------------------------------
    var gateModal = document.createElement("div");
    gateModal.className = "login-gate";
    gateModal.id = "login-gate-modal";
    gateModal.setAttribute("role", "dialog");
    gateModal.setAttribute("aria-modal", "true");
    gateModal.setAttribute("aria-labelledby", "login-gate-title");
    gateModal.innerHTML =
      '<div class="login-gate-panel">' +
      '<button type="button" class="modal-close-btn" data-gate-close aria-label="Close modal">&times;</button>' +
      '<div style="width:52px; height:52px; margin:0 auto 16px; border-radius:50%; background:var(--pale-cyan); color:var(--navy); display:flex; align-items:center; justify-content:center;">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
      '</div>' +
      '<h3 id="login-gate-title">Log in to view summary</h3>' +
      '<p id="login-gate-desc">Please log in or create a free account to view your consultation summary and send an email or appointment request to this clinic.</p>' +
      '<a href="login.html" id="gate-login-link" class="btn btn-primary btn-block">Log In</a>' +
      '<a href="signup.html" id="gate-signup-link" class="btn btn-secondary btn-block">Create an Account</a>' +
      '<button type="button" class="btn btn-ghost btn-block" data-gate-close>Not now</button>' +
      '</div>';
    document.body.appendChild(gateModal);

    function openLoginGate(title, description, nextPage) {
      var titleEl = document.getElementById("login-gate-title");
      var descEl = document.getElementById("login-gate-desc");
      var loginLink = document.getElementById("gate-login-link");
      var signupLink = document.getElementById("gate-signup-link");

      if (title && titleEl) titleEl.textContent = title;
      if (description && descEl) descEl.textContent = description;

      var targetPage = nextPage || (window.location.pathname.split("/").pop() || "clinic-details.html");
      if (loginLink) loginLink.href = "login.html?next=" + encodeURIComponent(targetPage);
      if (signupLink) signupLink.href = "signup.html?next=" + encodeURIComponent(targetPage);

      gateModal.classList.add("show");
    }

    function closeLoginGate() {
      gateModal.classList.remove("show");
    }

    gateModal.addEventListener("click", function (e) {
      if (e.target === gateModal || e.target.hasAttribute("data-gate-close")) {
        closeLoginGate();
      }
    });

    // ----------------------------------------------------
    // 2. Build Clinic Email / Appointment Placeholder Modal
    // ----------------------------------------------------
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
      '<div class="appt-badge">Clinic Appointment Request</div>' +
      '<h3 id="appt-modal-title">Send Summary to Bay Area Dermatology Clinic</h3>' +
      '<p>Send your AI consultation summary directly to the clinic front desk to schedule an in-person consultation.</p>' +
      '</div>' +
      '<form id="clinic-appointment-form" novalidate>' +
      '<div class="appt-grid">' +
      '<div class="appt-field">' +
      '<label for="appt-name">Patient Name</label>' +
      '<input type="text" id="appt-name" required value="Juan Dela Cruz">' +
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
      '<option value="Dr. Elena Ramos">Dr. Elena Ramos (General Dermatology)</option>' +
      '<option value="Dr. Marco Villanueva">Dr. Marco Villanueva (Cosmetic & Clinical)</option>' +
      '<option value="Any Available">First Available Dermatologist</option>' +
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
      '<strong>Attached: SKINSIGHT-Consultation-Summary.pdf</strong>' +
      '<span>Main concern: Red, itchy patch on forearm (5 days) · AI Observations included</span>' +
      '</div>' +
      '</div>' +
      '<div class="appt-field">' +
      '<label for="appt-notes">Additional Notes for the Clinic (Optional)</label>' +
      '<textarea id="appt-notes" rows="2" placeholder="e.g. Please let me know available slots this Thursday."></textarea>' +
      '</div>' +
      '<div class="appt-actions">' +
      '<button type="submit" class="btn btn-primary btn-block" id="btn-submit-appt">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
      'Send Summary & Request Appointment' +
      '</button>' +
      '<button type="button" class="btn btn-ghost btn-block" data-appt-close>Cancel</button>' +
      '</div>' +
      '</form>' +
      '</div>' +
      '<div id="appt-success-view" style="display:none;">' +
      '<div class="appt-success-icon">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
      '</div>' +
      '<h3>Appointment Request & Summary Sent!</h3>' +
      '<p>Your consultation summary has been emailed to <strong>Bay Area Dermatology Clinic</strong> (info@bayareaderma.example).</p>' +
      '<div class="appt-ref-box">' +
      '<span class="ref-label">Reference ID</span>' +
      '<span class="ref-code" id="appt-ref-id">SKIN-84291</span>' +
      '</div>' +
      '<p class="appt-subtext">The clinic front desk will review your details and contact you at <strong id="appt-confirmed-email">your email</strong> within 1 business day to confirm your appointment schedule.</p>' +
      '<div class="appt-actions">' +
      '<button type="button" class="btn btn-primary btn-block" data-appt-close>Done</button>' +
      '<a id="appt-mailto-fallback" class="btn btn-ghost btn-sm btn-block" href="#">Open in Default Mail App Instead</a>' +
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

      if (user) {
        if (nameInput) nameInput.value = user.displayName || "Juan Dela Cruz";
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
          submitBtn.innerText = "Sending Summary to Clinic...";
        }

        var userEmail = (document.getElementById("appt-email") || {}).value || "your email";
        var doctorName = (document.getElementById("appt-doctor") || {}).value || "First Available";
        var preferredDate = (document.getElementById("appt-date") || {}).value || getTomorrowDateString();
        var preferredTime = (document.getElementById("appt-time") || {}).value || "Morning";

        // Simulate sending network request (1.2 seconds)
        setTimeout(function () {
          var formView = document.getElementById("appt-form-view");
          var successView = document.getElementById("appt-success-view");
          var refIdEl = document.getElementById("appt-ref-id");
          var confirmedEmailEl = document.getElementById("appt-confirmed-email");
          var mailtoFallback = document.getElementById("appt-mailto-fallback");

          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
          }

          if (refIdEl) {
            refIdEl.textContent = "SKIN-" + Math.floor(10000 + Math.random() * 90000);
          }
          if (confirmedEmailEl) {
            confirmedEmailEl.textContent = userEmail;
          }
          if (mailtoFallback) {
            var subject = encodeURIComponent("Consultation Summary & Appointment Request: " + doctorName);
            var body = encodeURIComponent("Hello Bay Area Dermatology Clinic,\n\nI would like to request an appointment on " + preferredDate + " (" + preferredTime + ") with " + doctorName + ".\n\nPlease find my SKINSIGHT Consultation Summary attached.\n\nThank you,\n" + userEmail);
            mailtoFallback.href = "mailto:info@bayareaderma.example?subject=" + subject + "&body=" + body;
          }

          if (formView) formView.style.display = "none";
          if (successView) successView.style.display = "block";
        }, 1200);
      });
    }

    // ----------------------------------------------------
    // 3. Page Interceptors
    // ----------------------------------------------------

    // On clinic-details.html:
    if (isClinicDetails) {
      var emailLink = document.getElementById("btn-email-clinic") ||
        document.querySelector('.send-option a[href^="mailto:"]') ||
        document.querySelector('.send-option:first-child a');

      if (emailLink) {
        emailLink.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();

          if (!isLoggedIn()) {
            openLoginGate(
              "Log in to send summary & request appointment",
              "Please log in or create a free account to view your consultation summary and send an email or appointment request to this clinic.",
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

    // On consultation-summary.html:
    if (isConsultationSummary) {
      if (!isLoggedIn()) {
        openLoginGate(
          "Log in to view your summary",
          "Please log in or create a free account to view and save your complete consultation summary.",
          "consultation-summary.html"
        );
      }
    }

    // Global escape key handler to close active modal
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeLoginGate();
        closeAppointmentModal();
      }
    });
  });
})();
