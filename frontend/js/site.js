/*
 * SKINSIGHT — UI Polish lang po
 * Adds scroll animations, staggered element animations,
 * and a glassy navbar effect.
 *
 * This file ONLY handles visual effects.
 * It does not affect any app functionality or business logic.
 */
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  document.addEventListener("DOMContentLoaded", function () {
    var prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    var navbar = document.querySelector(".navbar");
    if (navbar) {
      var updateNavbar = function () {
        if (window.scrollY > 8) {
          navbar.classList.add("navbar-scrolled");
        } else {
          navbar.classList.remove("navbar-scrolled");
        }
      };
      updateNavbar();
      window.addEventListener("scroll", updateNavbar, { passive: true });
    }

    var navLinks = document.querySelector(".nav-links");
    if (navLinks) {
      var NAV_PAGE_GROUPS = [
        { link: "index.html", pages: ["", "index.html"] },
        { link: "ai-assistant-intro.html", pages: ["ai-assistant-intro.html", "ai-chat.html", "consultation-summary.html"] },
        { link: "clinic-finder.html", pages: ["clinic-finder.html", "clinic-details.html", "no-clinic-available.html"] },
        { link: "medication-tracker.html", pages: ["medication-tracker.html", "add-medication.html", "medication-history.html"] },
        { link: "about.html", pages: ["about.html"] }
      ];

      var currentPage = window.location.pathname.split("/").pop();
      var activeLink = null;

      NAV_PAGE_GROUPS.forEach(function (group) {
        if (group.pages.indexOf(currentPage) !== -1) {
          activeLink = group.link;
        }
      });

      Array.prototype.forEach.call(navLinks.querySelectorAll("a"), function (a) {
        var isActive = a.getAttribute("href") === activeLink;
        a.classList.toggle("active", isActive);
      });
    }

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      return;
    }

    var revealSelector = [
      ".card",
      ".send-option",
      ".section-head",
      ".about-hero-inner",
      ".notice.strong"
    ].join(", ");

    var revealItems = Array.prototype.slice.call(
      document.querySelectorAll(revealSelector)
    );

    revealItems.forEach(function (el) {
      el.classList.add("reveal");
    });

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    revealItems.forEach(function (el) {
      io.observe(el);
    });

    function stagger(containerSelector, childSelector, stepMs) {
      var containers = document.querySelectorAll(containerSelector);
      containers.forEach(function (container) {
        var children = container.querySelectorAll(childSelector);
        children.forEach(function (child, idx) {
          child.style.transitionDelay = idx * stepMs + "ms";
        });
      });
    }

    stagger(".send-options", ".send-option", 80);
  });
})();