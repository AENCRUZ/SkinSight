/*
 * SKINSIGHT — Supabase Authentication & UI
 * Handles Sign Up, Login (Email + Google OAuth), Forgot Password,
 * and Navbar Session Management.
 */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    initPasswordToggles();
    initAuthForms();
    initGoogleOAuth();
    initAuthNavbar();
    handleOAuthRedirect();
    checkPasswordResetPage();
  });

  // Password show/hide
  function initPasswordToggles() {
    var toggles = document.querySelectorAll("[data-toggle-password]");
    Array.prototype.forEach.call(toggles, function (btn) {
      btn.addEventListener("click", function () {
        var targetId = btn.getAttribute("data-toggle-password");
        var input = document.getElementById(targetId);
        if (!input) return;
        var showing = input.type === "text";
        input.type = showing ? "password" : "text";
        btn.classList.toggle("is-visible", !showing);
        btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      });
    });
  }

  // Helper to display feedback notices
  var ICONS = {
    danger: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    success: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    warning: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
  };

  function showNotice(form, type, message) {
    var note = form.querySelector("[data-auth-note]");
    if (!note) return;

    note.classList.remove("danger", "success", "warning", "strong");
    note.classList.add(type, "show");

    var iconHtml = ICONS[type] || ICONS.info;
    note.innerHTML = iconHtml + "<span>" + escapeHtml(message) + "</span>";
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.innerText = str;
    return div.innerHTML;
  }

  function setButtonLoading(button, isLoading, loadingText, defaultText) {
    if (!button) return;
    button.disabled = isLoading;
    button.innerText = isLoading ? loadingText : defaultText;
  }

  // Authentication Forms (Email/Password)
  function initAuthForms() {
    var authForms = document.querySelectorAll("[data-auth-form]");
    if (!authForms.length) return;

    Array.prototype.forEach.call(authForms, function (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();

        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }

        if (typeof isSupabaseConfigured === "function" && !isSupabaseConfigured()) {
          showNotice(
            form,
            "warning",
            "Supabase keys are not set yet. Please paste your URL and Anon Key in js/supabase-config.js."
          );
          return;
        }

        if (!window.supabaseClient) {
          showNotice(form, "danger", "Supabase client failed to initialize.");
          return;
        }

        var signupEmail = document.getElementById("signup-email");
        var loginEmail = document.getElementById("login-email");
        var resetEmail = document.getElementById("reset-email");
        var updatePassword = document.getElementById("update-password");

        if (signupEmail) {
          await handleSignUp(form);
        } else if (loginEmail) {
          await handleLogin(form);
        } else if (resetEmail) {
          await handleForgotPassword(form);
        } else if (updatePassword) {
          await handleUpdatePassword(form);
        }
      });
    });
  }

  // Handle Sign Up
  async function handleSignUp(form) {
    var nameInput = document.getElementById("signup-name");
    var emailInput = document.getElementById("signup-email");
    var passwordInput = document.getElementById("signup-password");
    var confirmInput = document.getElementById("signup-confirm");
    var termsInput = document.getElementById("signup-terms");
    var submitBtn = form.querySelector('button[type="submit"]');

    var name = nameInput ? nameInput.value.trim() : "";
    var email = emailInput ? emailInput.value.trim() : "";
    var password = passwordInput ? passwordInput.value : "";
    var confirmPassword = confirmInput ? confirmInput.value : "";

    if (password.length < 8) {
      showNotice(form, "danger", "Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      showNotice(form, "danger", "Passwords do not match. Please re-enter.");
      return;
    }

    if (termsInput && !termsInput.checked) {
      showNotice(form, "danger", "Please agree to the Terms of Use before continuing.");
      return;
    }

    var originalText = submitBtn.innerText;
    setButtonLoading(submitBtn, true, "Creating Account...", originalText);

    try {
      var response = await window.supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            display_name: name
          }
        }
      });

      if (response.error) {
        showNotice(form, "danger", response.error.message);
        setButtonLoading(submitBtn, false, "", originalText);
        return;
      }

      if (response.data && response.data.session) {
        if (response.data.user) {
          saveCachedUser(getUserData(response.data.user));
        }
        showNotice(form, "success", "Account created successfully! Redirecting...");
        setTimeout(function () {
          window.location.href = "index.html";
        }, 1200);
      } else {
        showNotice(
          form,
          "success",
          "Account registered! If confirmation is enabled in Supabase, please check your email inbox to verify."
        );
        setTimeout(function () {
          window.location.href = "login.html";
        }, 3000);
      }
    } catch (err) {
      showNotice(form, "danger", err.message || "An unexpected error occurred.");
      setButtonLoading(submitBtn, false, "", originalText);
    }
  }

  // Handle Log In
  async function handleLogin(form) {
    var emailInput = document.getElementById("login-email");
    var passwordInput = document.getElementById("login-password");
    var submitBtn = form.querySelector('button[type="submit"]');

    var email = emailInput ? emailInput.value.trim() : "";
    var password = passwordInput ? passwordInput.value : "";

    var originalText = submitBtn.innerText;
    setButtonLoading(submitBtn, true, "Logging In...", originalText);

    try {
      var response = await window.supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (response.error) {
        showNotice(form, "danger", response.error.message);
        setButtonLoading(submitBtn, false, "", originalText);
        return;
      }

      if (response.data && response.data.user) {
        saveCachedUser(getUserData(response.data.user));
      }

      showNotice(form, "success", "Welcome back! Redirecting...");
      setTimeout(function () {
        window.location.href = "index.html";
      }, 1000);
    } catch (err) {
      showNotice(form, "danger", err.message || "An unexpected error occurred.");
      setButtonLoading(submitBtn, false, "", originalText);
    }
  }

  function getAppUrl(page) {
    var path = window.location.pathname;
    var basePath = path.substring(0, path.lastIndexOf("/") + 1);
    return window.location.origin + basePath + page;
  }

  // Handle Forgot Password
  async function handleForgotPassword(form) {
    var emailInput = document.getElementById("reset-email");
    var submitBtn = form.querySelector('button[type="submit"]');

    var email = emailInput ? emailInput.value.trim() : "";
    var originalText = submitBtn.innerText;
    setButtonLoading(submitBtn, true, "Sending Link...", originalText);

    try {
      var response = await window.supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: getAppUrl("reset-password.html")
      });

      if (response.error) {
        showNotice(form, "danger", response.error.message);
        setButtonLoading(submitBtn, false, "", originalText);
        return;
      }

      var successBlock = form.parentElement.querySelector("[data-auth-success]");
      if (successBlock) {
        form.style.display = "none";
        successBlock.classList.add("show");
      } else {
        showNotice(form, "success", "Password reset link sent to your email!");
      }
    } catch (err) {
      showNotice(form, "danger", err.message || "An unexpected error occurred.");
      setButtonLoading(submitBtn, false, "", originalText);
    }
  }

  // Handle Update Password (from recovery link)
  async function handleUpdatePassword(form) {
    var passwordInput = document.getElementById("update-password");
    var confirmInput = document.getElementById("update-confirm");
    var submitBtn = form.querySelector('button[type="submit"]');

    var password = passwordInput ? passwordInput.value : "";
    var confirmPassword = confirmInput ? confirmInput.value : "";

    if (password.length < 8) {
      showNotice(form, "danger", "Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      showNotice(form, "danger", "Passwords do not match. Please re-enter.");
      return;
    }

    var originalText = submitBtn.innerText;
    setButtonLoading(submitBtn, true, "Updating Password...", originalText);

    try {
      var response = await window.supabaseClient.auth.updateUser({
        password: password
      });

      if (response.error) {
        showNotice(form, "danger", response.error.message || "Failed to update password.");
        setButtonLoading(submitBtn, false, "", originalText);
        return;
      }

      saveCachedUser(null);
      try {
        await window.supabaseClient.auth.signOut();
      } catch (signOutErr) { }

      form.style.display = "none";
      var successBlock = form.parentElement.querySelector("[data-auth-success]");
      if (successBlock) {
        successBlock.style.display = "block";
        successBlock.classList.add("show");
      } else {
        showNotice(form, "success", "Password updated successfully! Please log in.");
      }
    } catch (err) {
      showNotice(form, "danger", err.message || "An unexpected error occurred.");
      setButtonLoading(submitBtn, false, "", originalText);
    }
  }

  // Google OAuth Sign-In

  function initGoogleOAuth() {
    var googleBtns = document.querySelectorAll("[data-google-login]");
    if (!googleBtns.length) return;

    Array.prototype.forEach.call(googleBtns, function (btn) {
      btn.addEventListener("click", async function (e) {
        e.preventDefault();

        if (typeof isSupabaseConfigured === "function" && !isSupabaseConfigured()) {
          alert("Supabase keys are not set yet. Please configure js/supabase-config.js first.");
          return;
        }

        if (!window.supabaseClient) {
          alert("Supabase client failed to initialize.");
          return;
        }

        btn.disabled = true;
        btn.querySelector(".google-btn-text").textContent = "Redirecting...";

        try {
          var response = await window.supabaseClient.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: getAppUrl("index.html")
            }
          });

          if (response.error) {
            alert("Google sign-in failed: " + response.error.message);
            btn.disabled = false;
            btn.querySelector(".google-btn-text").textContent = "Continue with Google";
          }
        } catch (err) {
          alert("Google sign-in error: " + (err.message || "An unexpected error occurred."));
          btn.disabled = false;
          btn.querySelector(".google-btn-text").textContent = "Continue with Google";
        }
      });
    });
  }

  // Handle OAuth redirect & Password Recovery redirect
  async function handleOAuthRedirect() {
    if (!window.supabaseClient) return;

    var hash = window.location.hash || "";
    if (!hash || !hash.includes("access_token")) return;

    var isRecovery = hash.includes("type=recovery");
    var isResetPage = window.location.pathname.indexOf("reset-password.html") !== -1;

    if (isRecovery) {
      if (!isResetPage) {
        window.location.href = getAppUrl("reset-password.html") + hash;
      }
      return;
    }

    if (isResetPage) {
      return;
    }

    try {
      var sessionRes = await window.supabaseClient.auth.getSession();
      if (sessionRes.data && sessionRes.data.session) {
        var user = sessionRes.data.session.user;
        if (user) {
          saveCachedUser(getUserData(user));
        }
        window.history.replaceState(null, "", window.location.pathname);
        window.location.href = "index.html";
      }
    } catch (err) {
      console.warn("OAuth redirect handling error:", err);
    }
  }

  // Check Password Reset Page validity
  async function checkPasswordResetPage() {
    var form = document.getElementById("form-update-password");
    if (!form) return;

    var expiredBlock = document.querySelector("[data-reset-expired]");
    var hash = window.location.hash || "";
    var search = window.location.search || "";

    if (hash.includes("error=") || search.includes("error=")) {
      form.style.display = "none";
      if (expiredBlock) {
        var match = (hash + "&" + search).match(/error_description=([^&]+)/);
        if (match && match[1]) {
          var p = expiredBlock.querySelector("p");
          if (p) {
            p.textContent = decodeURIComponent(match[1].replace(/\+/g, " "));
          }
        }
        expiredBlock.style.display = "block";
        expiredBlock.classList.add("show");
      }
      return;
    }

    var hasRecoveryIndicator = hash.includes("type=recovery") ||
      hash.includes("access_token") ||
      search.includes("code=");

    if (!hasRecoveryIndicator) {
      if (window.supabaseClient) {
        try {
          var res = await window.supabaseClient.auth.getSession();
          if (!res.data || !res.data.session) {
            form.style.display = "none";
            if (expiredBlock) {
              expiredBlock.style.display = "block";
              expiredBlock.classList.add("show");
            }
          }
        } catch (e) {
          form.style.display = "none";
          if (expiredBlock) {
            expiredBlock.style.display = "block";
            expiredBlock.classList.add("show");
          }
        }
      } else {
        form.style.display = "none";
        if (expiredBlock) {
          expiredBlock.style.display = "block";
          expiredBlock.classList.add("show");
        }
      }
    }
  }

  function getUserData(user) {
    if (!user) return null;
    var meta = user.user_metadata || {};
    var displayName = meta.display_name || meta.full_name || meta.name || (user.email ? user.email.split("@")[0] : "User");
    var initial = (displayName.charAt(0) || "U").toUpperCase();
    var avatarUrl = meta.avatar_url || meta.picture || "";
    return {
      id: user.id,
      email: user.email || "",
      displayName: displayName,
      initial: initial,
      avatarUrl: avatarUrl
    };
  }

  function saveCachedUser(userData) {
    try {
      if (userData) {
        localStorage.setItem("skinsight_user", JSON.stringify(userData));
        document.documentElement.classList.add("auth-user-signed-in");
      } else {
        localStorage.removeItem("skinsight_user");
        document.documentElement.classList.remove("auth-user-signed-in");
      }
    } catch (e) { }
  }

  function getCachedUser() {
    try {
      var raw = localStorage.getItem("skinsight_user");
      if (raw) return JSON.parse(raw);

      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("sb-") === 0 && k.indexOf("-auth-token") !== -1) {
          var sbRaw = localStorage.getItem(k);
          if (sbRaw) {
            var sbData = JSON.parse(sbRaw);
            var u = sbData.user || (sbData.currentSession && sbData.currentSession.user);
            if (u) {
              var extracted = getUserData(u);
              saveCachedUser(extracted);
              return extracted;
            }
          }
        }
      }
    } catch (e) { }
    return null;
  }

  async function handleSignOut(e) {
    if (e) e.preventDefault();
    saveCachedUser(null);
    renderAuthNavbar(null);
    if (window.supabaseClient) {
      try {
        await window.supabaseClient.auth.signOut();
      } catch (err) { }
    }
    window.location.reload();
  }

  function renderAuthNavbar(userData) {
    var navActions = document.querySelector(".nav-auth-actions");
    var navLinks = document.querySelector(".nav-links");
    var mobileLoginItem = document.querySelector(".nav-login-item");

    if (!userData) {
      if (navActions) {
        navActions.innerHTML =
          '<a href="login.html" class="btn btn-ghost btn-sm">Log In</a>' +
          '<a href="ai-assistant-intro.html" class="btn btn-primary btn-sm">Get Started</a>';
      }
      if (navLinks) {
        var mobileProfile = navLinks.querySelector(".nav-mobile-profile");
        if (mobileProfile) mobileProfile.remove();
      }
      if (mobileLoginItem) {
        mobileLoginItem.className = "nav-login-item";
        mobileLoginItem.innerHTML = '<a href="login.html">Log In</a>';
      }
      return;
    }

    var displayName = userData.displayName || "User";
    var initial = userData.initial || (displayName.charAt(0) || "U").toUpperCase();
    var avatarUrl = userData.avatarUrl || "";
    var email = userData.email || "";

    if (navActions) {
      var avatarHtml = avatarUrl
        ? '<img src="' + escapeHtml(avatarUrl) + '" alt="' + escapeHtml(displayName) + '" class="nav-user-avatar nav-user-avatar-img" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'; if(this.nextElementSibling) this.nextElementSibling.style.display=\'inline-flex\';">' +
        '<span class="nav-user-avatar" style="display:none;">' + escapeHtml(initial) + '</span>'
        : '<span class="nav-user-avatar">' + escapeHtml(initial) + '</span>';

      navActions.innerHTML =
        '<a href="ai-assistant-intro.html" class="btn btn-primary btn-sm">Get Started</a>' +
        '<div class="nav-user-menu">' +
        '<button type="button" class="nav-user-trigger" id="nav-user-trigger" aria-haspopup="true" aria-expanded="false" title="Account menu">' +
        avatarHtml +
        '<span class="nav-user-name">' + escapeHtml(displayName) + '</span>' +
        '<svg class="nav-user-chevron" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>' +
        '</button>' +
        '<div class="nav-user-dropdown" id="nav-user-dropdown" role="menu">' +
        '<div class="nav-dropdown-header">' +
        '<span class="nav-dropdown-name">' + escapeHtml(displayName) + '</span>' +
        '<span class="nav-dropdown-email">' + escapeHtml(email) + '</span>' +
        '</div>' +
        '<div class="nav-dropdown-divider"></div>' +
        '<button type="button" class="nav-dropdown-item nav-dropdown-logout" id="btn-supabase-logout" role="menuitem">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
        '<span>Sign Out</span>' +
        '</button>' +
        '</div>' +
        '</div>';

      var trigger = document.getElementById("nav-user-trigger");
      var dropdown = document.getElementById("nav-user-dropdown");

      if (trigger && dropdown) {
        trigger.addEventListener("click", function (e) {
          e.stopPropagation();
          var isOpen = dropdown.classList.contains("open");
          dropdown.classList.toggle("open", !isOpen);
          trigger.setAttribute("aria-expanded", String(!isOpen));
        });

        document.addEventListener("click", function (e) {
          if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
            dropdown.classList.remove("open");
            trigger.setAttribute("aria-expanded", "false");
          }
        });

        document.addEventListener("keydown", function (e) {
          if (e.key === "Escape") {
            dropdown.classList.remove("open");
            trigger.setAttribute("aria-expanded", "false");
          }
        });
      }

      var logoutBtn = document.getElementById("btn-supabase-logout");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", handleSignOut);
      }
    }

    if (navLinks) {
      var existingProfile = navLinks.querySelector(".nav-mobile-profile");
      if (existingProfile) {
        existingProfile.remove();
      }

      var profileLi = document.createElement("li");
      profileLi.className = "nav-mobile-profile";

      var mobileAvatarHtml = avatarUrl
        ? '<img src="' + escapeHtml(avatarUrl) + '" alt="' + escapeHtml(displayName) + '" class="nav-mobile-user-avatar nav-mobile-user-avatar-img" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'; if(this.nextElementSibling) this.nextElementSibling.style.display=\'inline-flex\';">' +
        '<span class="nav-mobile-user-avatar" style="display:none;">' + escapeHtml(initial) + '</span>'
        : '<span class="nav-mobile-user-avatar">' + escapeHtml(initial) + '</span>';

      profileLi.innerHTML =
        '<div class="nav-mobile-user-card">' +
        mobileAvatarHtml +
        '<div class="nav-mobile-user-details">' +
        '<span class="nav-mobile-user-name">' + escapeHtml(displayName) + '</span>' +
        '<span class="nav-mobile-user-email">' + escapeHtml(email) + '</span>' +
        '</div>' +
        '</div>';

      navLinks.insertBefore(profileLi, navLinks.firstChild);
    }

    if (mobileLoginItem) {
      mobileLoginItem.className = "nav-login-item nav-mobile-bottom-item";
      mobileLoginItem.innerHTML =
        '<button type="button" class="nav-mobile-signout-btn" id="mobile-supabase-logout">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
        '<span>Sign Out</span>' +
        '</button>';

      var mobileLogoutBtn = document.getElementById("mobile-supabase-logout");
      if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener("click", handleSignOut);
      }
    }
  }

  function initAuthNavbar() {
    var isResetPage = window.location.pathname.indexOf("reset-password.html") !== -1;
    if (isResetPage) {
      return;
    }

    var cached = getCachedUser();
    if (cached) {
      document.documentElement.classList.add("auth-user-signed-in");
      renderAuthNavbar(cached);
    } else {
      document.documentElement.classList.remove("auth-user-signed-in");
    }

    if (!window.supabaseClient || (typeof isSupabaseConfigured === "function" && !isSupabaseConfigured())) {
      return;
    }

    window.supabaseClient.auth.getSession().then(function (sessionRes) {
      var session = sessionRes.data ? sessionRes.data.session : null;
      var user = session ? session.user : null;

      if (user) {
        var userData = getUserData(user);
        saveCachedUser(userData);
        renderAuthNavbar(userData);
      } else {
        saveCachedUser(null);
        renderAuthNavbar(null);
      }
    }).catch(function (err) {
      console.warn("Could not check auth session:", err);
    });

    if (!window._supabaseAuthListenerAttached) {
      window._supabaseAuthListenerAttached = true;
      window.supabaseClient.auth.onAuthStateChange(function (event, session) {
        if (event === "PASSWORD_RECOVERY") return;
        var user = session ? session.user : null;
        if (user) {
          var userData = getUserData(user);
          saveCachedUser(userData);
          renderAuthNavbar(userData);
        } else {
          saveCachedUser(null);
          renderAuthNavbar(null);
        }
      });
    }
  }
})();
