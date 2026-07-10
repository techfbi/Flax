// Minimal service worker for web push notifications.
// Two jobs: show a notification when a push arrives, and focus or
// open the app when that notification is clicked.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "Flax", body: "" };
  try {
    if (event.data) payload = event.data.json();
  } catch {
    payload = { title: "Flax", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Flax";
  const options = {
    body: payload.body || "",
    icon: "/images/logoIcon.png",
    badge: "/images/arrowSpin.png",
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});