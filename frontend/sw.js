/*
 * SKINSIGHT service worker: shows medication reminders sent by the backend (Web Push), even when no SKINSIGHT tab
 * is open. Chrome on Windows/macOS delivers them while Chrome runs in the background; Android delivers them with
 * Chrome closed.
 *
 * Kept at the site root (frontend/) so its scope covers every page. URLs in payloads are relative and resolved
 * against the scope, so this works both on localhost and under a GitHub Pages sub-path.
 */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) { event.waitUntil(self.clients.claim()); });

function resolve(url) {
  try { return new URL(url || "medication-tracker.html", self.registration.scope).href; }
  catch (e) { return self.registration.scope; }
}

self.addEventListener("push", function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { body: event.data ? event.data.text() : "" }; }

  var title = data.title || "SKINSIGHT medication reminder";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "You have a scheduled medication dose.",
    tag: data.tag || "skinsight-reminder",
    renotify: true,
    requireInteraction: true,
    data: { url: resolve(data.url) },
    actions: [{ action: "open", title: "Open tracker" }]
  }));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || resolve();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.split("?")[0] === target.split("?")[0] && "focus" in list[i]) return list[i].focus();
    }
    return self.clients.openWindow ? self.clients.openWindow(target) : null;
  }));
});
