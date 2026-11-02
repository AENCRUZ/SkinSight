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

    /* ---------------- Navbar ---------------- */
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

    /* ---------------- Scroll-reveal --------- */
    var revealSelector = [
      ".card",
      ".list-row",
      ".feature-row",
      ".step",
      ".support-list li",
      ".send-option",
      ".cta-band",
      ".section-head",
      ".hero-facts li",
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

    /* ---------------- Stagger repeated groups ------------------------ */
    function stagger(containerSelector, childSelector, stepMs) {
      var containers = document.querySelectorAll(containerSelector);
      containers.forEach(function (container) {
        var children = container.querySelectorAll(childSelector);
        children.forEach(function (child, idx) {
          child.style.transitionDelay = idx * stepMs + "ms";
        });
      });
    }

    stagger(".grid-2, .grid-3, .grid-4", ".card", 70);
    stagger(".hero-facts", "li", 90);
    stagger(".support-list", "li", 80);
    stagger(".send-options", ".send-option", 80);
    stagger(".feature-list", ".feature-row", 60);

    /* ---------------- "How It Works" carousel ---------------- */
    var hiwCarousel = document.getElementById("hiwCarousel");
    if (hiwCarousel) {
      var hiwViewport = hiwCarousel.querySelector(".hiw-viewport");
      var hiwTrack = hiwCarousel.querySelector(".hiw-track");
      var hiwRealSlides = Array.prototype.slice.call(hiwTrack.querySelectorAll(".hiw-slide"));
      var hiwDots = Array.prototype.slice.call(hiwCarousel.querySelectorAll(".hiw-dot"));
      var hiwPrev = hiwCarousel.querySelector(".hiw-prev");
      var hiwNext = hiwCarousel.querySelector(".hiw-next");
      var total = hiwRealSlides.length;

      var lastClone = hiwRealSlides[total - 1].cloneNode(true);
      var firstClone = hiwRealSlides[0].cloneNode(true);
      lastClone.setAttribute("data-clone", "true");
      firstClone.setAttribute("data-clone", "true");
      hiwTrack.insertBefore(lastClone, hiwRealSlides[0]);
      hiwTrack.appendChild(firstClone);

      var allSlides = Array.prototype.slice.call(hiwTrack.querySelectorAll(".hiw-slide"));
      var current = 1; 
      var isAnimating = false;

      function realIndex(pos) {
        return (pos - 1 + total) % total;
      }

      function paint() {
        allSlides.forEach(function (slide, i) {
          slide.classList.toggle("is-active", i === current);
        });
        hiwDots.forEach(function (dot, i) {
          dot.classList.toggle("active", i === realIndex(current));
        });
      }

      function offsetFor(index) {
        var slide = allSlides[index];
        var viewportRect = hiwViewport.getBoundingClientRect();
        var slideRect = slide.getBoundingClientRect();
        var trackRect = hiwTrack.getBoundingClientRect();
        var slideCenter = (slideRect.left - trackRect.left) + slideRect.width / 2;
        return viewportRect.width / 2 - slideCenter;
      }

      function center(withTransition) {
        hiwTrack.style.transform = "translateX(" + offsetFor(current) + "px)";
        if (!withTransition) {
          void hiwTrack.offsetHeight;
        }
      }

      function goTo(newIndex, viaLoopJump) {
        if (isAnimating && !viaLoopJump) return;
        current = newIndex;
        paint();
        center(true);
        isAnimating = true;
      }

      function jumpTo(newIndex) {
        hiwTrack.classList.add("no-anim");
        current = newIndex;
        paint();
        center(false);
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            hiwTrack.classList.remove("no-anim");
          });
        });
      }

      hiwTrack.addEventListener("transitionend", function (e) {
        if (e.propertyName !== "transform") return;
        isAnimating = false;
        if (current === 0) {
          jumpTo(total);
        } else if (current === allSlides.length - 1) {
          jumpTo(1);
        }
      });

      function next() { goTo(current + 1); }
      function prev() { goTo(current - 1); }

      if (hiwNext) hiwNext.addEventListener("click", next);
      if (hiwPrev) hiwPrev.addEventListener("click", prev);

      hiwDots.forEach(function (dot, i) {
        dot.addEventListener("click", function () {
          if (isAnimating) return;
          goTo(i + 1);
        });
      });

      hiwTrack.addEventListener("click", function (e) {
        if (hiwDragMoved) return;
        var slide = e.target.closest(".hiw-slide");
        if (!slide) return;
        var idx = allSlides.indexOf(slide);
        if (idx === -1 || idx === current || isAnimating) return;
        goTo(idx);
      });

      var hiwDragStartX = 0;
      var hiwDragMoved = false;
      var hiwBaseOffset = 0;
      var HIW_SWIPE_THRESHOLD = 40;
      var isDragging = false;

      function currentOffsetPx() {
        var style = window.getComputedStyle(hiwTrack);
        var matrix = style.transform;
        if (!matrix || matrix === "none") return 0;
        var match = matrix.match(/matrix\(([^)]+)\)/);
        if (!match) return 0;
        var parts = match[1].split(",");
        return parseFloat(parts[4]) || 0;
      }

      var hiwPointerId = null;

      hiwTrack.addEventListener("pointerdown", function (e) {
        if (isAnimating) return;
        isDragging = true;
        hiwDragMoved = false;
        hiwDragStartX = e.clientX;
        hiwBaseOffset = currentOffsetPx();
        hiwPointerId = e.pointerId;
        hiwTrack.classList.add("is-dragging");
      });

      hiwTrack.addEventListener("pointermove", function (e) {
        if (!isDragging) return;
        var dx = e.clientX - hiwDragStartX;
        if (!hiwDragMoved && Math.abs(dx) > 4) {
          hiwDragMoved = true;
          hiwTrack.setPointerCapture && hiwTrack.setPointerCapture(hiwPointerId);
        }
        if (hiwDragMoved) {
          hiwTrack.style.transform = "translateX(" + (hiwBaseOffset + dx) + "px)";
        }
      });

      function endDrag(e) {
        if (!isDragging) return;
        isDragging = false;
        hiwTrack.classList.remove("is-dragging");
        var dx = e.clientX - hiwDragStartX;
        var wasDrag = hiwDragMoved;
        if (wasDrag) {
          if (Math.abs(dx) > HIW_SWIPE_THRESHOLD) {
            if (dx < 0) { next(); } else { prev(); }
          } else {
            center(true);
          }
        }
        setTimeout(function () { hiwDragMoved = false; }, 0);
      }
      hiwTrack.addEventListener("pointerup", endDrag);
      hiwTrack.addEventListener("pointercancel", endDrag);

      var hiwResizeTimer = null;
      window.addEventListener("resize", function () {
        clearTimeout(hiwResizeTimer);
        hiwResizeTimer = setTimeout(function () { center(false); }, 120);
      });

      paint();
      center(false);
      window.addEventListener("load", function () { center(false); });
    }
  });
})();