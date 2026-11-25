/*
 * SKINSIGHT — Shared UI shell
 *
 * Defines <site-header> and <site-footer> so every page gets the same
 * navbar, mobile drawer, skip link and footer from one place.
 *
 * Load synchronously in <head> (no `defer`): the elements then render while the
 * page is parsed, so the navbar exists before auth.js / site.js run on
 * DOMContentLoaded and there is no flash of an empty header.
 *
 * Markup contract kept for auth.js / site.js (do not rename):
 *   .navbar, .nav-links, .nav-login-item, .nav-auth-actions,
 *   #nav-toggle (a <button aria-expanded>; exposes .checked, see initDrawer), .hamburger-label
 *
 * Usage:
 *   <site-header data-nav="home|assistant|clinics|meds|about|none"></site-header>
 *   <main id="main"> ... </main>
 *   <site-footer></site-footer>
 */
(function () {
  "use strict";

  // Check and synchronize initial auth class on <html> based on "Keep me signed in"
  try {
    var remember = localStorage.getItem("skinsight_remember_me") === "true";
    if (!remember) {
      // Clean up orphan tokens in localStorage if "Keep me signed in" was not checked
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && (k.indexOf("sb-") === 0 && k.indexOf("-auth-token") !== -1 || k === "skinsight_user")) {
          localStorage.removeItem(k);
        }
      }
    }
    var activeUser = (remember ? localStorage.getItem("skinsight_user") : null) || sessionStorage.getItem("skinsight_user");
    if (activeUser) {
      document.documentElement.classList.add("auth-user-signed-in");
    } else {
      document.documentElement.classList.remove("auth-user-signed-in");
    }
  } catch (e) {}

  var NAV_ITEMS = [
    { key: "home",      href: "index.html",              label: "Home",                pages: ["", "index.html"] },
    { key: "assistant", href: "ai-assistant-intro.html", label: "AI Skin Assistant",   pages: ["ai-assistant-intro.html", "ai-chat.html", "consultation-summary.html"] },
    { key: "clinics",   href: "clinic-finder.html",      label: "Find a Dermatologist", pages: ["clinic-finder.html", "clinic-details.html", "no-clinic-available.html"] },
    { key: "meds",      href: "medication-tracker.html", label: "Medication Tracker",  pages: ["medication-tracker.html", "add-medication.html", "medication-history.html"] },
    { key: "about",     href: "about.html",              label: "About",               pages: ["about.html"] }
  ];

  // Shared icon sprite. Use as: <svg class="i" aria-hidden="true"><use href="#i-name"/></svg>
  // Injected inline (not an external file) so it also works when opened from file://.
  var ICONS = {
    "info": '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    "shield-check": '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "x": '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    "send": '<path d="m3 3 3 9-3 9 19-9Z"/><path d="M6 12h16"/>',
    "camera": '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    "image": '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    "message": '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    "map-pin": '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    "pill": '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
    "file-text": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    "download": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><path d="M12 15V3"/>',
    "search": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    "mail": '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    "clock": '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    "calendar": '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    "user": '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    "log-out": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    "plus": '<path d="M5 12h14"/><path d="M12 5v14"/>',
    "trash": '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    "panel-left": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
    "chevron-left": '<path d="m15 18-6-6 6-6"/>',
    "sparkles": '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
    "rotate-ccw": '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    "copy": '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    "phone": '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    "circle-check": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    "alert-circle": '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    "ban": '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    "droplet": '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
    "eye": '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    "bell": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'
  };

  function spriteHtml() {
    var out = '<svg class="icon-sprite" aria-hidden="true" focusable="false" ' +
      'style="position:absolute;width:0;height:0;overflow:hidden" xmlns="http://www.w3.org/2000/svg">';
    Object.keys(ICONS).forEach(function (name) {
      out += '<symbol id="i-' + name + '" viewBox="0 0 24 24">' + ICONS[name] + "</symbol>";
    });
    return out + "</svg>";
  }

  function icon(name) {
    return '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-' + name + '"/></svg>';
  }

  function activeKeyFromPath() {
    var page = window.location.pathname.split("/").pop();
    for (var i = 0; i < NAV_ITEMS.length; i++) {
      if (NAV_ITEMS[i].pages.indexOf(page) !== -1) return NAV_ITEMS[i].key;
    }
    return "none";
  }

  function headerHtml(activeKey) {
    var links = NAV_ITEMS.map(function (item) {
      var isActive = item.key === activeKey;
      return '<li><a href="' + item.href + '"' +
        (isActive ? ' class="active" aria-current="page"' : "") + ">" + item.label + "</a></li>";
    }).join("");

    // Initial auth actions mirror what auth.js renders for signed-out users;
    // auth.js replaces .nav-auth-actions / .nav-login-item once it knows the session.
    return spriteHtml() +
      '<a class="skip-link" href="#main">Skip to main content</a>' +
      '<header class="navbar">' +
        '<nav class="wrap" aria-label="Primary">' +
          '<a href="index.html" class="brand" aria-label="SKINSIGHT home"><img class="brand-mark" src="img/logo-mark.svg" alt="" width="26" height="26"><span class="brand-word">SKIN<span>SIGHT</span></span></a>' +
          '<button type="button" id="nav-toggle" class="nav-toggle" ' +
            'aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="primary-nav"></button>' +
          '<label for="nav-toggle" class="hamburger-label" aria-hidden="true"><span></span><span></span><span></span></label>' +
          '<ul class="nav-links" id="primary-nav">' +
            links +
            '<li class="nav-login-item"><a href="login.html">Log In</a></li>' +
          "</ul>" +
          '<div class="nav-auth-actions">' +
            '<a href="login.html" class="btn btn-ghost btn-sm">Log In</a>' +
            '<a href="ai-assistant-intro.html" class="btn btn-primary btn-sm">Get Started</a>' +
          "</div>" +
          '<div class="nav-backdrop" aria-hidden="true"></div>' +
        "</nav>" +
      "</header>";
  }

  function footerHtml() {
    var links = NAV_ITEMS.map(function (item) {
      return '<li><a href="' + item.href + '">' + item.label + "</a></li>";
    }).join("");

    return "<footer>" +
      '<div class="wrap">' +
        '<div class="footer-grid">' +
          "<div>" +
            '<div class="brand"><img class="brand-mark" src="img/logo-mark-reversed.svg" alt="" width="26" height="26"><span class="brand-word">SKIN<span>SIGHT</span></span></div>' +
            '<p class="footer-blurb">AI-assisted skin health platform. Document your concerns and prepare for better dermatology care.</p>' +
          "</div>" +
          '<nav aria-label="Footer">' +
            '<h2 class="footer-heading">Explore</h2>' +
            '<ul class="footer-links">' + links + "</ul>" +
          "</nav>" +
          "<div>" +
            '<h2 class="footer-heading">Please note</h2>' +
            '<div class="footer-note">' + icon("shield-check") +
              "<p>SKINSIGHT organizes information to help you talk with a dermatologist. It does not diagnose, treat or prescribe.</p>" +
            "</div>" +
          "</div>" +
        "</div>" +
        '<div class="footer-bottom">' +
          "<span>&copy; " + new Date().getFullYear() + " SKINSIGHT</span>" +
          '<span class="footer-legal"><a href="terms.html">Terms of Use</a><a href="privacy.html">Privacy Policy</a></span>' +
          "<span>SKINSIGHT is not a substitute for professional medical advice, diagnosis, or treatment.</span>" +
        "</div>" +
      "</div>" +
    "</footer>";
  }

  // Mobile drawer. #nav-toggle is a real <button aria-expanded> (the standard disclosure pattern).
  // auth.js, which we do not modify, closes the menu by assigning `toggle.checked = false` and reading
  // `toggle.checked`, so expose `checked` as a live view of aria-expanded to keep that contract working.
  function initDrawer(root) {
    var toggle = root.querySelector("#nav-toggle");
    if (!toggle) return;
    Object.defineProperty(toggle, "checked", {
      configurable: true,
      get: function () { return this.getAttribute("aria-expanded") === "true"; },
      set: function (v) { this.setAttribute("aria-expanded", v ? "true" : "false"); }
    });
    var backdrop = root.querySelector(".nav-backdrop");
    var links = root.querySelector(".nav-links");
    var desktop = window.matchMedia("(min-width: 1025px)");

    function close(returnFocus) {
      if (!toggle.checked) return;
      toggle.checked = false;
      if (returnFocus) toggle.focus();
    }

    // Native <button>: Enter and Space both fire click.
    toggle.addEventListener("click", function () { toggle.checked = !toggle.checked; });
    if (backdrop) backdrop.addEventListener("click", function () { close(false); });
    if (links) links.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a")) close(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close(true);
    });
    window.addEventListener("pageshow", function () { toggle.checked = false; });
    var onBreakpoint = function (e) { if (e.matches) close(false); };
    if (desktop.addEventListener) desktop.addEventListener("change", onBreakpoint);
    else if (desktop.addListener) desktop.addListener(onBreakpoint);
  }

  function define(tag, ctor) {
    if (window.customElements && !window.customElements.get(tag)) window.customElements.define(tag, ctor);
  }

  if (!window.customElements) return; // very old browsers: pages stay usable without the shell

  define("site-header", class extends HTMLElement {
    connectedCallback() {
      if (this._rendered) return;
      this._rendered = true;
      var key = this.getAttribute("data-nav") || activeKeyFromPath();
      this.innerHTML = headerHtml(key);
      initDrawer(this);
    }
  });

  define("site-footer", class extends HTMLElement {
    connectedCallback() {
      if (this._rendered) return;
      this._rendered = true;
      this.innerHTML = footerHtml();
    }
  });

  // Tiny public surface for later phases (icon helper for dynamic markup).
  window.SkinsightUI = { icon: icon };
})();
