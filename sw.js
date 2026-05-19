const CACHE_NAME = "daily-english-v1";

self.addEventListener("install", (event) => {
  console.log("Service Worker: 설치 중...");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker: 활성화 중...");
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.status === 200) {
          const cloned = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => {
              cache.put(request, cloned).catch(() => {});
            })
            .catch(() => {});
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          return new Response("인터넷 연결이 필요합니다.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        });
      })
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json().catch(() => ({}));
    const title = data.title || "Daily English";
    const options = {
      body: data.body || "오늘의 영어 문장을 확인해보세요!",
      tag: "daily-english"
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.error("Push 알림 오류:", e);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      if (list.length > 0) return list[0].focus();
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});

console.log("Service Worker: 준비 완료");