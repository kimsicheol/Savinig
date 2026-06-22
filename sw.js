// 우리집 저금통(꿀꿀이) · 서비스워커 (사이트 루트 /sw.js)
// HTML은 '네트워크 우선' → 배포 시 항상 최신 화면. 정적 자산만 '캐시 우선'.
const CACHE = 'piggy-v3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 페이지에서 즉시 갱신을 트리거할 수 있게(선택)
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 동적 요청(기록·인식·외부 모듈)은 캐시하지 않고 네트워크로
  const dynamic =
    e.request.method !== 'GET' ||
    url.pathname.includes('/api/') ||
    url.host.includes('supabase') ||
    url.host.includes('googleapis') ||
    url.host.includes('esm.sh');
  if (dynamic) return;

  // HTML/네비게이션: 네트워크 우선(항상 최신), 오프라인이면 캐시
  const isHTML =
    e.request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('.html');

  if (isHTML) {
    e.respondWith(
      fetch(e.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return resp;
        })
        .catch(() => caches.match(e.request).then((h) => h || caches.match('./index.html')))
    );
    return;
  }

  // 그 외 정적 자산: 캐시 우선, 없으면 네트워크 → 캐시에 저장
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request)
          .then((resp) => {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return resp;
          })
          .catch(() => caches.match('./index.html'))
    )
  );
});
