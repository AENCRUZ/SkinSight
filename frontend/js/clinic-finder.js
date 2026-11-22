/**
 * SKINSIGHT — Clinic Finder & Google Maps Controller
 *
 * Implements:
 * - Live Google Maps Embed integration (NO API KEY REQUIRED, ZERO WATERMARKS)
 * - Geolocation ("Use My Location") with automatic state reset and fallback
 * - Location Picker Modal with Quick Area Chips & Search
 * - Area-based clinic filtering (only displays clinics in the chosen area)
 * - Smooth clinic selection and Google Maps synchronization
 */
(function () {
  "use strict";

  // Default pinned location: Batangas City, Philippines
  var DEFAULT_LOCATION = {
    lat: 13.7565,
    lng: 121.0583,
    name: "Batangas City, Batangas",
    isUserGps: false
  };

  // Predefined Batangas Province locations for instant fast-matching and quick chips
  var CITY_PRESETS = [
    { name: "Batangas City", lat: 13.7565, lng: 121.0583, alias: ["batangas", "batangas city", "poblacion batangas", "kumintang", "alangilan", "pallocan"] },
    { name: "Lipa City", lat: 13.9419, lng: 121.1631, alias: ["lipa", "lipa city", "ayala highway lipa", "sabang", "marawoy"] },
    { name: "Tanauan City", lat: 14.0863, lng: 121.1504, alias: ["tanauan", "tanauan city", "poblacion tanauan", "darasa", "victory park"] },
    { name: "Santo Tomas", lat: 14.1083, lng: 121.1417, alias: ["santo tomas", "sto tomas", "sto. tomas", "san roque", "cabrini"] },
    { name: "Bauan", lat: 13.7917, lng: 121.0083, alias: ["bauan", "bauan batangas", "mabini", "san pascual"] },
    { name: "Lemery", lat: 13.8833, lng: 120.9167, alias: ["lemery", "taal", "lemery batangas", "calaca", "palanas"] },
    { name: "Nasugbu", lat: 14.0767, lng: 120.6328, alias: ["nasugbu", "nasugbu batangas", "lian", "wawa"] },
    { name: "Balayan", lat: 13.9333, lng: 120.7333, alias: ["balayan", "balayan batangas", "ermita"] },
    { name: "Rosario", lat: 13.8472, lng: 121.2056, alias: ["rosario", "rosario batangas", "taysan", "padre garcia"] },
    { name: "San Jose", lat: 13.8767, lng: 121.1044, alias: ["san jose", "san jose batangas", "cuenca", "ibaan"] }
  ];

  var state = {
    location: Object.assign({}, DEFAULT_LOCATION),
    userActualLocation: null, // Stores actual physical GPS coordinates { lat, lng, isGps: true }
    searchQuery: "",
    filterDistance: "area", // Default: only show clinics in this chosen town / city on Google Maps
    filterAvailability: "all",
    filterType: "all",
    isModalOpen: false,
    selectedClinicId: null,
    isLocating: false,
    locateTimer: null
  };

  // Export so inline handlers or external scripts can safely call these methods
  window.SkinsightClinicFinder = {
    state: state,
    openMapModal: openMapModal,
    closeMapModal: closeMapModal,
    handleUseMyLocation: handleUseMyLocation,
    setLocation: setLocation,
    selectClinic: selectClinic,
    resetLocateButtons: resetLocateButtons,
    saveCurrentLocation: saveCurrentLocation,
    restoreSavedLocation: restoreSavedLocation
  };

  /* --------------------------------------------------------------------------
     Session Storage Persistence (Preserves location across page navigation)
     -------------------------------------------------------------------------- */
  function saveCurrentLocation() {
    try {
      sessionStorage.setItem("skinsight_pinned_location", JSON.stringify(state.location));
      sessionStorage.setItem("skinsight_filter_distance", state.filterDistance);
      sessionStorage.setItem("skinsight_filter_availability", state.filterAvailability);
      sessionStorage.setItem("skinsight_filter_type", state.filterType);
      if (state.userActualLocation) {
        sessionStorage.setItem("skinsight_user_actual_location", JSON.stringify(state.userActualLocation));
        localStorage.setItem("skinsight_user_actual_location", JSON.stringify(state.userActualLocation));
      }
    } catch (e) {}
  }

  function restoreSavedLocation() {
    var restored = false;
    try {
      // 1. Restore user's actual physical location if previously acquired
      var rawActual = sessionStorage.getItem("skinsight_user_actual_location") || localStorage.getItem("skinsight_user_actual_location");
      if (rawActual) {
        var parsedActual = JSON.parse(rawActual);
        if (parsedActual && typeof parsedActual.lat === "number" && typeof parsedActual.lng === "number") {
          state.userActualLocation = parsedActual;
        }
      }

      // 2. Restore pinned location / chosen area
      var raw = sessionStorage.getItem("skinsight_pinned_location");
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed.lat === "number" && typeof parsed.lng === "number" && parsed.name) {
          state.location = Object.assign({}, parsed);
          restored = true;
        }
      } else if (state.userActualLocation) {
        state.location = Object.assign({}, state.userActualLocation);
        restored = true;
      }

      var savedDist = sessionStorage.getItem("skinsight_filter_distance");
      if (savedDist) {
        state.filterDistance = savedDist;
        var fDist = document.getElementById("f-distance");
        if (fDist) fDist.value = savedDist;
      }
      var savedAvail = sessionStorage.getItem("skinsight_filter_availability");
      if (savedAvail) {
        state.filterAvailability = savedAvail;
        var fAvail = document.getElementById("f-availability");
        if (fAvail) fAvail.value = savedAvail;
      }
      var savedType = sessionStorage.getItem("skinsight_filter_type");
      if (savedType) {
        state.filterType = savedType;
        var fType = document.getElementById("f-type");
        if (fType) fType.value = savedType;
      }
    } catch (e) {
      console.warn("[SKINSIGHT] Could not restore saved location", e);
    }
    return restored;
  }

  /* --------------------------------------------------------------------------
     Initialization
     -------------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    if (!window.SkinsightClinics) {
      console.error("[SKINSIGHT] clinics-data.js must be loaded before clinic-finder.js");
      return;
    }

    // Ensure the modal is strictly hidden on page load
    var modal = document.getElementById("mapModal");
    if (modal) {
      modal.setAttribute("hidden", "hidden");
      modal.classList.remove("is-active");
      modal.style.setProperty("display", "none", "important");
    }

    // Restore saved location if previously selected in this session (e.g. before navigating to clinic details)
    restoreSavedLocation();

    setupFormControls();
    setupModalControls();
    updateGoogleIframes();
    updateMiniMapUI();
    renderClinicsList();
    resetLocateButtons();

    // Check if geolocation permission was already granted to quietly update user actual location in background
    checkBackgroundGeolocation();

    // Check URL parameters for specific clinic focus, but DO NOT auto-open modal on page load
    var params = new URLSearchParams(window.location.search);
    if (params.get("clinic")) {
      var clinicId = params.get("clinic");
      setTimeout(function () {
        selectClinic(clinicId, false);
      }, 400);
    }
  });

  function checkBackgroundGeolocation() {
    if (state.userActualLocation) return;
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "geolocation" }).then(function (res) {
        if (res.state === "granted" && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(function (pos) {
            var lat = pos.coords.latitude;
            var lng = pos.coords.longitude;
            if (lat >= 13.45 && lat <= 14.30 && lng >= 120.45 && lng <= 121.50) {
              state.userActualLocation = { lat: lat, lng: lng, isGps: true };
              saveCurrentLocation();
              renderClinicsList();
            }
          }, function () {}, { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 });
        }
      }).catch(function () {});
    }
  }

  // Handle browser Back / Forward cache (bfcache) navigation without resetting location
  window.addEventListener("pageshow", function () {
    if (restoreSavedLocation()) {
      updateGoogleIframes();
      updateMiniMapUI();
      renderClinicsList();
    }
    resetLocateButtons();
  });

  /* --------------------------------------------------------------------------
     Google Maps Embed Helpers
     -------------------------------------------------------------------------- */
  function getGoogleMapsEmbedUrl(lat, lng, name) {
    var areaName = name ? name.split(",")[0].trim() : "Batangas City";
    var query = "dermatologist skin clinic in " + areaName + " Batangas";
    return "https://maps.google.com/maps?q=" + encodeURIComponent(query) + "&t=&z=13&ie=UTF8&iwloc=&output=embed";
  }

  function getClinicGoogleMapsEmbedUrl(clinic) {
    var query = clinic.googleMapsQuery || (clinic.name + " " + clinic.address);
    return "https://maps.google.com/maps?q=" + encodeURIComponent(query) + "&t=&z=16&ie=UTF8&iwloc=&output=embed";
  }

  function updateGoogleIframes() {
    var embedUrl = getGoogleMapsEmbedUrl(state.location.lat, state.location.lng, state.location.name);

    var miniIframe = document.getElementById("miniGoogleIframe");
    if (miniIframe) {
      miniIframe.src = embedUrl;
    }

    var modalIframe = document.getElementById("modalGoogleIframe");
    if (modalIframe && state.isModalOpen) {
      modalIframe.src = embedUrl;
    }
  }

  /* --------------------------------------------------------------------------
     Mini Map UI Updates
     -------------------------------------------------------------------------- */
  function updateMiniMapUI() {
    var labelEl = document.getElementById("miniMapLocLabel");
    if (labelEl) {
      labelEl.textContent = "Pinned: " + state.location.name;
    }

    var locNameText = document.getElementById("locationNameText");
    if (locNameText) {
      locNameText.textContent = state.location.name;
    }

    var googleBtn = document.getElementById("miniMapGoogleBtn");
    if (googleBtn) {
      var areaName = state.location.name ? state.location.name.split(",")[0].trim() : "Batangas City";
      googleBtn.href = window.SkinsightClinics.getGoogleMapsSearchUrl(
        state.location.lat,
        state.location.lng,
        "dermatologist skin clinic in " + areaName + ", Batangas"
      );
    }
  }

  /* --------------------------------------------------------------------------
     Modal Map UI Updates
     -------------------------------------------------------------------------- */
  function updateModalUI() {
    var badgeText = document.getElementById("modalLocationBadgeText");
    if (badgeText) {
      badgeText.textContent = state.location.name;
    }

    var footerLocText = document.getElementById("modalFooterLocationText");
    if (footerLocText) {
      footerLocText.textContent = state.location.name;
    }

    var countText = document.getElementById("modalClinicCountText");
    if (countText) {
      var visibleCount = countClinicsNearLocation(state.location.lat, state.location.lng);
      var countScope = state.filterDistance === "area"
        ? "in this town"
        : (state.filterDistance === "all" ? "across Batangas" : "within " + state.filterDistance + " km");
      countText.textContent = " · " + visibleCount + " clinic" + (visibleCount === 1 ? "" : "s") + " on Google Maps " + countScope;
    }

    var externalLink = document.getElementById("modalExternalGoogleMapsLink");
    if (externalLink) {
      var areaName = state.location.name ? state.location.name.split(",")[0].trim() : "Batangas City";
      externalLink.href = window.SkinsightClinics.getGoogleMapsSearchUrl(
        state.location.lat,
        state.location.lng,
        "dermatologist skin clinic in " + areaName + ", Batangas"
      );
    }

    // Highlight active chip
    updateActiveCityChip();
  }

  function countClinicsNearLocation(lat, lng) {
    var count = 0;
    var selectedCity = (state.location.name || "").toLowerCase().split(",")[0].trim();
    window.SkinsightClinics.DATA.forEach(function (c) {
      var clinicCity = (c.city || "").toLowerCase();
      var isSameCity = clinicCity === selectedCity ||
        selectedCity.indexOf(clinicCity) !== -1 ||
        clinicCity.indexOf(selectedCity) !== -1;
      if (state.filterDistance === "area") {
        if (isSameCity) count++;
      } else if (state.filterDistance === "all") {
        count++;
      } else {
        var maxD = parseFloat(state.filterDistance) || 15;
        var dist = window.SkinsightClinics.calculateDistanceKm(lat, lng, c.lat, c.lng);
        if (dist != null && dist <= maxD) count++;
      }
    });
    return count;
  }

  function updateActiveCityChip() {
    var chips = document.querySelectorAll(".city-chip");
    var locName = (state.location.name || "").toLowerCase();
    Array.prototype.forEach.call(chips, function (chip) {
      var cityAttr = (chip.getAttribute("data-city") || "").toLowerCase();
      var match = locName.indexOf(cityAttr) !== -1 || cityAttr.indexOf(locName.split(",")[0].trim()) !== -1;
      chip.classList.toggle("is-active", match);
    });
  }

  /* --------------------------------------------------------------------------
     Modal Lifecycle
     -------------------------------------------------------------------------- */
  function openMapModal() {
    resetLocateButtons();

    var modal = document.getElementById("mapModal");
    if (!modal) return;

    modal.removeAttribute("hidden");
    modal.classList.add("is-active");
    modal.style.setProperty("display", "flex", "important");
    document.body.classList.add("modal-open");
    state.isModalOpen = true;

    updateModalUI();

    var modalIframe = document.getElementById("modalGoogleIframe");
    if (modalIframe) {
      var targetSrc = getGoogleMapsEmbedUrl(state.location.lat, state.location.lng, state.location.name);
      if (!modalIframe.src || modalIframe.src !== targetSrc) {
        modalIframe.src = targetSrc;
      }
    }
  }

  function closeMapModal() {
    resetLocateButtons();

    var modal = document.getElementById("mapModal");
    if (!modal) return;

    modal.setAttribute("hidden", "hidden");
    modal.classList.remove("is-active");
    modal.style.setProperty("display", "none", "important");
    document.body.classList.remove("modal-open");
    state.isModalOpen = false;

    // Save location whenever modal closes to prevent loss on navigation
    saveCurrentLocation();

    // Refresh mini map view to match chosen location
    updateGoogleIframes();
    updateMiniMapUI();
    renderClinicsList();
  }

  /* --------------------------------------------------------------------------
     Location Manipulation & Geocoding
     -------------------------------------------------------------------------- */
  function setLocation(lat, lng, name, isUserAction, isGps) {
    state.location.lat = lat;
    state.location.lng = lng;
    state.location.isUserGps = isGps === true;

    if (name) {
      state.location.name = name;
      afterLocationUpdated();
    } else {
      var matchedCity = findClosestCityPreset(lat, lng);
      state.location.name = matchedCity || (lat.toFixed(4) + ", " + lng.toFixed(4));
      afterLocationUpdated();

      reverseGeocode(lat, lng, function (resolvedName) {
        if (resolvedName) {
          state.location.name = resolvedName;
          afterLocationUpdated();
        }
      });
    }

    // Always reset locate buttons when a location is chosen
    resetLocateButtons();
  }

  function afterLocationUpdated() {
    saveCurrentLocation();
    updateMiniMapUI();
    updateModalUI();
    updateGoogleIframes();
    renderClinicsList();
  }

  function findClosestCityPreset(lat, lng) {
    var closest = null;
    var minDist = Infinity;
    CITY_PRESETS.forEach(function (city) {
      var d = window.SkinsightClinics.calculateDistanceKm(lat, lng, city.lat, city.lng);
      if (d < minDist) {
        minDist = d;
        closest = city;
      }
    });
    if (closest && minDist <= 18) {
      return closest.name;
    }
    return null;
  }

  function reverseGeocode(lat, lng, callback) {
    var url = "https://nominatim.openstreetmap.org/reverse?format=json&lat=" +
      encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lng) + "&zoom=13";

    fetch(url, { headers: { "Accept-Language": "en" } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.address) return callback(null);
        var addr = data.address;
        var city = addr.city || addr.town || addr.municipality || addr.county || addr.state_district || "";
        var prov = addr.state || addr.province || addr.region || "";
        var res = [city, prov].filter(Boolean).join(", ");
        callback(res || data.display_name.split(",").slice(0, 2).join(","));
      })
      .catch(function () {
        callback(null);
      });
  }

  function geocodeAddress(query, callback) {
    var q = query.trim().toLowerCase();
    for (var i = 0; i < CITY_PRESETS.length; i++) {
      var city = CITY_PRESETS[i];
      if (city.name.toLowerCase().indexOf(q) !== -1) {
        return callback({ lat: city.lat, lng: city.lng, name: city.name + ", Batangas" });
      }
      for (var a = 0; a < city.alias.length; a++) {
        if (q.indexOf(city.alias[a]) !== -1 || city.alias[a].indexOf(q) !== -1) {
          return callback({ lat: city.lat, lng: city.lng, name: city.name + ", Batangas" });
        }
      }
    }

    var searchTerm = query.toLowerCase().indexOf("batangas") !== -1
      ? query + ", Philippines"
      : query + ", Batangas, Philippines";

    var url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
      encodeURIComponent(searchTerm);

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (results) {
        if (results && results.length > 0) {
          var item = results[0];
          var lat = parseFloat(item.lat);
          var lon = parseFloat(item.lon);

          // Check if coordinates fall within Batangas Province bounding box
          if (lat < 13.45 || lat > 14.30 || lon < 120.45 || lon > 121.50) {
            showToast("Search is currently limited to Batangas Province.");
            return callback(null);
          }

          callback({
            lat: lat,
            lng: lon,
            name: item.display_name.split(",").slice(0, 2).join(",") + ", Batangas"
          });
        } else {
          callback(null);
        }
      })
      .catch(function () {
        callback(null);
      });
  }

  /* --------------------------------------------------------------------------
     "Use My Location" (GPS Geolocation Handler with robust reset)
     -------------------------------------------------------------------------- */
  function resetLocateButtons() {
    state.isLocating = false;
    if (state.locateTimer) {
      clearTimeout(state.locateTimer);
      state.locateTimer = null;
    }

    var btn = document.getElementById("useLocationBtn");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-map-pin"/></svg> Use My Location';
    }

    var miniBtn = document.getElementById("miniMapUseLocBtn");
    if (miniBtn) {
      miniBtn.disabled = false;
      miniBtn.innerHTML = '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-map-pin"/></svg> Use My Location';
    }

    var modalBtn = document.getElementById("modalUseLocationBtn");
    if (modalBtn) {
      modalBtn.disabled = false;
      modalBtn.innerHTML = '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-map-pin"/></svg> Use GPS Location';
    }
  }

  function handleUseMyLocation(autoOpenModal) {
    if (state.isLocating) {
      return;
    }
    state.isLocating = true;

    var btn = document.getElementById("useLocationBtn");
    var miniBtn = document.getElementById("miniMapUseLocBtn");
    var modalBtn = document.getElementById("modalUseLocationBtn");

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="loc-spinner"></span> Locating...';
    }
    if (miniBtn) {
      miniBtn.disabled = true;
      miniBtn.innerHTML = '<span class="loc-spinner"></span> Locating...';
    }
    if (modalBtn) {
      modalBtn.disabled = true;
      modalBtn.innerHTML = '<span class="loc-spinner"></span> Locating...';
    }

    // Safety timeout: ensure buttons ALWAYS restore after 4000ms regardless of browser delay
    state.locateTimer = setTimeout(function () {
      resetLocateButtons();
    }, 4000);

    if (!navigator.geolocation) {
      resetLocateButtons();
      showToast("Geolocation is not supported by your browser. Centered on Batangas City.");
      setLocation(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng, DEFAULT_LOCATION.name, true);
      if (autoOpenModal) openMapModal();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        resetLocateButtons();
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;

        // Check if within Batangas Province bounding box
        var isWithinBatangas = lat >= 13.45 && lat <= 14.30 && lng >= 120.45 && lng <= 121.50;

        if (!isWithinBatangas) {
          showToast("📍 Map is limited to Batangas Province. Centered on Batangas City.");
          setLocation(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng, DEFAULT_LOCATION.name, true);
        } else {
          state.userActualLocation = {
            lat: lat,
            lng: lng,
            isGps: true
          };
          state.location.isUserGps = true;
          saveCurrentLocation();

          setLocation(lat, lng, null, true);
          showToast("📍 Located! Distance counts now start from your actual location.");
        }
        if (autoOpenModal) {
          openMapModal();
        }
      },
      function (err) {
        resetLocateButtons();
        var msg = "Could not retrieve GPS location. Showing Batangas City clinics.";
        if (err && err.code === err.PERMISSION_DENIED) {
          msg = "Location permission denied. Showing Batangas City clinics. You can select another town anytime.";
        }
        showToast(msg);
        setLocation(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng, DEFAULT_LOCATION.name, true);
        if (autoOpenModal) {
          openMapModal();
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 60000
      }
    );
  }

  /* --------------------------------------------------------------------------
     Render Clinic Results (Area-Based & Radius Filtering)
     -------------------------------------------------------------------------- */
  function renderClinicsList() {
    // Search origin is ALWAYS the user's selected location (e.g. Tanauan City, Lipa City, Batangas City, or GPS location)
    var searchOrigin = state.location;
    var isUserGps = !!state.location.isUserGps;
    var hasActualUserGps = !!state.userActualLocation;

    // Sort clinics by proximity to the chosen search location
    var sortedClinics = window.SkinsightClinics.getClinicsSorted(searchOrigin.lat, searchOrigin.lng);
    var selectedCityName = (state.location.name || "").toLowerCase();
    var cleanTargetCity = selectedCityName.split(",")[0].trim();
    var areaDisplayName = state.location.name.split(",")[0].trim();

    var filterScopeLabel = "";
    if (state.filterDistance === "area") {
      filterScopeLabel = "in " + areaDisplayName;
    } else if (state.filterDistance === "all") {
      filterScopeLabel = "across Batangas Province";
    } else {
      filterScopeLabel = "within " + state.filterDistance + " km of " + areaDisplayName;
    }

    var filtered = sortedClinics.filter(function (clinic) {
      // 1. Text Search Query Filter
      if (state.searchQuery) {
        var q = state.searchQuery.toLowerCase();
        var matchName = clinic.name.toLowerCase().indexOf(q) !== -1;
        var matchCity = clinic.city.toLowerCase().indexOf(q) !== -1;
        var matchAddress = clinic.address.toLowerCase().indexOf(q) !== -1;
        var matchDoctor = clinic.doctors.some(function (d) { return d.name.toLowerCase().indexOf(q) !== -1; });
        var matchService = clinic.services.some(function (s) { return s.toLowerCase().indexOf(q) !== -1; });
        if (!matchName && !matchCity && !matchAddress && !matchDoctor && !matchService) return false;
      }

      // 2. Area / Distance Filter (relative to chosen search location)
      if (state.filterDistance === "area") {
        var clinicCity = (clinic.city || "").toLowerCase();
        var isSameCity = clinicCity === cleanTargetCity ||
          cleanTargetCity.indexOf(clinicCity) !== -1 ||
          clinicCity.indexOf(cleanTargetCity) !== -1;
        if (!isSameCity) return false;
      } else if (state.filterDistance !== "all") {
        var maxDist = parseFloat(state.filterDistance) || 15;
        if (clinic.distance != null && clinic.distance > maxDist) {
          return false;
        }
      }

      // 3. Operating Status Filter
      if (state.filterAvailability === "open" && !clinic.isOpen) {
        return false;
      }

      // 4. Consultation Type Filter
      if (state.filterType !== "all") {
        if (!clinic.consultationTypes.includes(state.filterType)) return false;
      }

      return true;
    });

    var resultsCountEl = document.getElementById("resultsCount");
    if (resultsCountEl) {
      resultsCountEl.textContent = filtered.length + " clinic" + (filtered.length === 1 ? "" : "s") + " on Google Maps " + filterScopeLabel;
    }

    var locationNameText = document.getElementById("locationNameText");
    if (locationNameText) {
      locationNameText.textContent = areaDisplayName + ", Batangas";
    }

    var container = document.getElementById("clinicsList");
    if (!container) return;

    if (filtered.length === 0) {
      var nearest = sortedClinics.length > 0 ? sortedClinics[0] : null;
      var nearestHint = "";
      if (nearest && nearest.distance != null) {
        nearestHint = '<p class="empty-nearest-hint">Nearest verified clinic on Google Maps is <strong>' + escapeHtml(nearest.name) +
          '</strong> in ' + escapeHtml(nearest.city) + ' (~' + nearest.distance + ' km from ' + escapeHtml(areaDisplayName) + ').</p>';
      }

      var gmapsSearchUrlEmpty = window.SkinsightClinics.getGoogleMapsSearchUrl(
        state.location.lat,
        state.location.lng,
        "dermatologist skin clinic in " + state.location.name + ", Batangas"
      );

      container.innerHTML =
        '<div class="card card-static empty-clinics-card" role="status">' +
          '<div class="empty-icon"><svg class="i" aria-hidden="true"><use href="#i-search"/></svg></div>' +
          '<h3>No clinics listed on Google Maps ' + escapeHtml(filterScopeLabel) + '</h3>' +
          '<p>We couldn\'t find any verified dermatology clinics ' + escapeHtml(filterScopeLabel) + '. You can expand your search distance or view all clinics across Batangas Province below.</p>' +
          nearestHint +
          '<div class="empty-actions">' +
            '<a href="' + gmapsSearchUrlEmpty + '" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">' +
              'Search "' + escapeHtml(areaDisplayName) + ', Batangas" on Google Maps &rarr;' +
            '</a>' +
            '<button type="button" id="expandRadiusBtn" class="btn btn-secondary btn-sm">Show All Batangas Clinics</button>' +
            '<button type="button" id="resetFiltersBtn" class="btn btn-ghost btn-sm">Reset Filters</button>' +
          '</div>' +
        '</div>';

      var expandBtn = document.getElementById("expandRadiusBtn");
      if (expandBtn) {
        expandBtn.addEventListener("click", function () {
          state.filterDistance = "all";
          var fDist = document.getElementById("f-distance");
          if (fDist) fDist.value = "all";
          renderClinicsList();
          showToast("Showing all verified clinics across Batangas Province.");
        });
      }

      var resetBtn = document.getElementById("resetFiltersBtn");
      if (resetBtn) {
        resetBtn.addEventListener("click", resetFilters);
      }
      return;
    }

    var gmapsSearchUrl = window.SkinsightClinics.getGoogleMapsSearchUrl(
      state.location.lat,
      state.location.lng,
      "dermatologist skin clinic in " + state.location.name + ", Batangas"
    );

    var originNote = isUserGps
      ? "Distances are calculated starting from your actual device location (driving road distance)."
      : "Distances and search radius are measured from " + escapeHtml(cleanTargetCity) + (hasActualUserGps ? " (also showing distance from your GPS location)." : ".");

    var syncBannerHtml =
      '<div class="gmaps-sync-banner" role="status">' +
        '<div class="gmaps-sync-left">' +
          '<span class="gmaps-sync-pulse"></span>' +
          '<div class="gmaps-sync-text">' +
            '<strong>Google Maps Matched &middot; ' + filtered.length + ' verified clinic' + (filtered.length === 1 ? '' : 's') + ' ' + escapeHtml(filterScopeLabel) + '</strong>' +
            '<p>' + originNote + '</p>' +
          '</div>' +
        '</div>' +
        '<a href="' + gmapsSearchUrl + '" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-xs gmaps-sync-btn" title="View live Google Maps pins across Batangas">' +
          'Open Google Maps <svg class="i" style="width:12px;height:12px;" aria-hidden="true"><use href="#i-arrow-right"/></svg>' +
        '</a>' +
      '</div>';

    var html = filtered.map(function (clinic) {
      var isClosed = !clinic.isOpen;
      var cardClass = "clinic-card" + (isClosed ? " is-closed" : "") + (clinic.id === state.selectedClinicId ? " is-highlighted" : "");

      var distanceDisplay = "";
      if (clinic.distance != null) {
        if (isUserGps) {
          distanceDisplay = "🚗 ~" + clinic.distance + " km from your location";
        } else {
          distanceDisplay = "~" + clinic.distance + " km from " + escapeHtml(cleanTargetCity);
          if (hasActualUserGps) {
            var actualUserDist = window.SkinsightClinics.calculateDistanceKm(
              state.userActualLocation.lat,
              state.userActualLocation.lng,
              clinic.lat,
              clinic.lng
            );
            if (actualUserDist != null) {
              distanceDisplay += " (🚗 ~" + actualUserDist + " km from your GPS)";
            }
          }
        }
      }
      var metaText = distanceDisplay + " &middot; " + escapeHtml(clinic.city);

      var statusBadge = clinic.isOpen
        ? '<span class="badge badge-open">Open Now</span>'
        : '<span class="badge badge-closed">' + escapeHtml(clinic.reopenText || "Closed") + '</span>';

      var gmapsBadge = '<span class="badge badge-gmaps">📍 On Google Maps</span>';

      var docBadge = '<span class="badge badge-info">' + clinic.doctors.length + ' dermatologist' + (clinic.doctors.length === 1 ? '' : 's') + '</span>';

      var typeBadges = clinic.consultationTypes.map(function (t) {
        return t === "teleconsult"
          ? '<span class="badge badge-teleconsult">Teleconsult</span>'
          : '<span class="badge badge-inperson">In-person</span>';
      }).join(" ");

      var dirOrigin = hasActualUserGps
        ? (state.userActualLocation.lat + "," + state.userActualLocation.lng)
        : (state.location.lat + "," + state.location.lng);
      var gmapsDirectionsUrl = "https://www.google.com/maps/dir/?api=1&origin=" +
        dirOrigin + "&destination=" + clinic.lat + "," + clinic.lng;

      return '<article class="' + cardClass + '" data-clinic-id="' + escapeHtml(clinic.id) + '">' +
        '<div class="clinic-card-icon" aria-hidden="true">' +
          '<svg class="i"><use href="#i-map-pin"/></svg>' +
        '</div>' +
        '<div class="clinic-card-body">' +
          '<h3>' + escapeHtml(clinic.name) + '</h3>' +
          '<p class="clinic-meta">' + metaText + '</p>' +
          '<div class="clinic-tags">' +
            statusBadge +
            gmapsBadge +
            docBadge +
            typeBadges +
          '</div>' +
        '</div>' +
        '<div class="clinic-card-actions">' +
          '<a href="clinic-details.html?id=' + encodeURIComponent(clinic.id) + '" class="btn btn-primary btn-sm">View Details &amp; Contact</a>' +
          '<button type="button" class="btn btn-secondary btn-sm btn-show-on-map" data-clinic-id="' + escapeHtml(clinic.id) + '">' +
            '<svg class="i" aria-hidden="true"><use href="#i-map-pin"/></svg> Show on Map' +
          '</button>' +
          '<a href="' + gmapsDirectionsUrl + '" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm clinic-dir-link" title="Open Google Maps driving directions from your location">' +
            'Directions &rarr;' +
          '</a>' +
        '</div>' +
      '</article>';
    }).join("");

    container.innerHTML = syncBannerHtml + html;

    Array.prototype.forEach.call(container.querySelectorAll(".btn-show-on-map"), function (btn) {
      btn.addEventListener("click", function () {
        var id = this.getAttribute("data-clinic-id");
        selectClinic(id, true);
      });
    });

    Array.prototype.forEach.call(container.querySelectorAll('a[href*="clinic-details.html"]'), function (link) {
      link.addEventListener("click", function () {
        saveCurrentLocation();
        var card = this.closest(".clinic-card");
        if (card) {
          var id = card.getAttribute("data-clinic-id");
          if (id) {
            try { sessionStorage.setItem("skinsight_selected_clinic_id", id); } catch (e) {}
          }
        }
      });
    });

    Array.prototype.forEach.call(container.querySelectorAll(".clinic-card"), function (card) {
      card.addEventListener("click", function (e) {
        if (e.target.closest("a") || e.target.closest("button")) return;
        var id = this.getAttribute("data-clinic-id");
        selectClinic(id, false);
      });
    });
  }

  /* --------------------------------------------------------------------------
     Focus & Select Clinic
     -------------------------------------------------------------------------- */
  function selectClinic(clinicId, shouldScrollToMap) {
    state.selectedClinicId = clinicId;
    var clinic = window.SkinsightClinics.getClinicById(clinicId);
    if (!clinic) return;

    // 1. Highlight card
    var cards = document.querySelectorAll(".clinic-card");
    Array.prototype.forEach.call(cards, function (c) {
      var match = c.getAttribute("data-clinic-id") === clinicId;
      c.classList.toggle("is-highlighted", match);
      if (match && !state.isModalOpen && !shouldScrollToMap) {
        c.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });

    // 2. Update Mini Map Google iframe to focus on this clinic
    var miniIframe = document.getElementById("miniGoogleIframe");
    if (miniIframe) {
      miniIframe.src = getClinicGoogleMapsEmbedUrl(clinic);
    }

    var miniLabel = document.getElementById("miniMapLocLabel");
    if (miniLabel) {
      miniLabel.textContent = "Viewing: " + clinic.name;
    }

    var googleBtn = document.getElementById("miniMapGoogleBtn");
    if (googleBtn) {
      googleBtn.href = "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(clinic.googleMapsQuery || (clinic.name + " " + clinic.address));
    }

    var modalIframe = document.getElementById("modalGoogleIframe");
    if (modalIframe && state.isModalOpen) {
      modalIframe.src = getClinicGoogleMapsEmbedUrl(clinic);
    }

    if (shouldScrollToMap) {
      var miniCard = document.querySelector(".finder-map-card");
      if (miniCard) {
        miniCard.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  /* --------------------------------------------------------------------------
     Filter & Search Reset
     -------------------------------------------------------------------------- */
  function resetFilters() {
    state.searchQuery = "";
    state.filterDistance = "20";
    state.filterAvailability = "all";
    state.filterType = "all";

    var qInput = document.getElementById("clinic-q");
    if (qInput) qInput.value = "";
    var fDist = document.getElementById("f-distance");
    if (fDist) fDist.value = "20";
    var fAvail = document.getElementById("f-availability");
    if (fAvail) fAvail.value = "all";
    var fType = document.getElementById("f-type");
    if (fType) fType.value = "all";

    renderClinicsList();
  }

  /* --------------------------------------------------------------------------
     Setup DOM Form Controls
     -------------------------------------------------------------------------- */
  function setupFormControls() {
    var searchInput = document.getElementById("clinic-q");
    if (searchInput) {
      var debounceTimer;
      searchInput.addEventListener("input", function (e) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          state.searchQuery = e.target.value.trim();
          renderClinicsList();
        }, 250);
      });

      searchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          var val = this.value.trim();
          if (val) {
            geocodeAddress(val, function (res) {
              if (res) {
                setLocation(res.lat, res.lng, res.name, true);
                showToast("📍 Moved to " + res.name);
              }
            });
          }
        }
      });
    }

    var useLocBtn = document.getElementById("useLocationBtn");
    if (useLocBtn) {
      useLocBtn.addEventListener("click", function () {
        handleUseMyLocation(true);
      });
    }

    var miniMapUseLocBtn = document.getElementById("miniMapUseLocBtn");
    if (miniMapUseLocBtn) {
      miniMapUseLocBtn.addEventListener("click", function () {
        handleUseMyLocation(true);
      });
    }

    var fDist = document.getElementById("f-distance");
    if (fDist) {
      fDist.addEventListener("change", function () {
        state.filterDistance = this.value;
        saveCurrentLocation();
        renderClinicsList();
      });
    }

    var fAvail = document.getElementById("f-availability");
    if (fAvail) {
      fAvail.addEventListener("change", function () {
        state.filterAvailability = this.value;
        saveCurrentLocation();
        renderClinicsList();
      });
    }

    var fType = document.getElementById("f-type");
    if (fType) {
      fType.addEventListener("change", function () {
        state.filterType = this.value;
        saveCurrentLocation();
        renderClinicsList();
      });
    }

    var expandMapBtn = document.getElementById("expandMapBtn");
    if (expandMapBtn) {
      expandMapBtn.addEventListener("click", openMapModal);
    }
  }

  /* --------------------------------------------------------------------------
     Setup Modal Controls
     -------------------------------------------------------------------------- */
  function setupModalControls() {
    var closeBtn = document.getElementById("closeMapModalBtn");
    if (closeBtn) closeBtn.addEventListener("click", closeMapModal);

    var backdrop = document.getElementById("mapModalBackdrop");
    if (backdrop) backdrop.addEventListener("click", closeMapModal);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.isModalOpen) {
        closeMapModal();
      }
    });

    var modalUseLocBtn = document.getElementById("modalUseLocationBtn");
    if (modalUseLocBtn) {
      modalUseLocBtn.addEventListener("click", function () {
        handleUseMyLocation(false);
      });
    }

    var confirmBtn = document.getElementById("confirmLocationBtn");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", function () {
        closeMapModal();
        showToast("📍 Location set: " + state.location.name + ". Showing clinics in this area.");
      });
    }

    // Modal Search Bar
    var modalSearchInput = document.getElementById("modalMapSearchInput");
    var modalSearchBtn = document.getElementById("modalMapSearchBtn");

    function executeModalSearch() {
      if (!modalSearchInput) return;
      var query = modalSearchInput.value.trim();
      if (!query) return;

      modalSearchBtn.disabled = true;
      modalSearchBtn.textContent = "Searching...";

      geocodeAddress(query, function (result) {
        modalSearchBtn.disabled = false;
        modalSearchBtn.textContent = "Search";
        if (result) {
          setLocation(result.lat, result.lng, result.name, true);
          showToast("📍 Selected: " + result.name);
        } else {
          showToast("Could not find location. Try another city name.");
        }
      });
    }

    if (modalSearchBtn) modalSearchBtn.addEventListener("click", executeModalSearch);
    if (modalSearchInput) {
      modalSearchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          executeModalSearch();
        }
      });
    }

    // Modal Quick Area Chips
    var cityChips = document.querySelectorAll(".city-chip");
    Array.prototype.forEach.call(cityChips, function (chip) {
      chip.addEventListener("click", function () {
        var cityName = this.getAttribute("data-city");
        var match = CITY_PRESETS.find(function (c) {
          return c.name.toLowerCase().indexOf(cityName.toLowerCase()) !== -1 ||
            cityName.toLowerCase().indexOf(c.name.toLowerCase()) !== -1;
        });

        if (match) {
          setLocation(match.lat, match.lng, match.name, true);
          showToast("📍 Chosen area: " + match.name);
        } else {
          geocodeAddress(cityName, function (res) {
            if (res) {
              setLocation(res.lat, res.lng, res.name, true);
              showToast("📍 Chosen area: " + res.name);
            }
          });
        }
      });
    });
  }

  /* --------------------------------------------------------------------------
     Toast Notification Helper
     -------------------------------------------------------------------------- */
  function showToast(message) {
    var existing = document.getElementById("skinsightMapToast");
    if (existing) existing.remove();

    var toast = document.createElement("div");
    toast.id = "skinsightMapToast";
    toast.className = "skinsight-map-toast";
    toast.setAttribute("role", "status");
    toast.textContent = message;

    document.body.appendChild(toast);
    setTimeout(function () { toast.classList.add("is-visible"); }, 20);
    setTimeout(function () {
      toast.classList.remove("is-visible");
      setTimeout(function () { toast.remove(); }, 300);
    }, 3800);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
