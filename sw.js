// 우리집 저금통 · 서비스워커 (파일 위치: 사이트 루트의 /sw.js)
const CACHE = 'piggy-v1';
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

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 동적 요청(저금 기록·인식 등)은 캐시하지 않고 그대로 네트워크로
  const dynamic =
    e.request.method !== 'GET' ||
    url.pathname.includes('/api/') ||
    url.host.includes('supabase') ||
    url.host.includes('googleapis') ||
    url.host.includes('esm.sh');
  if (dynamic) return;

  // 앱 셸: 캐시 우선, 없으면 네트워크 → 캐시에 저장, 실패 시 index.html
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
