/*
 * sw.js — Service Worker لنظام Pro الكامل
 * يعمل من: https://keimojan.github.io/Pro/
 *
 * الصفحات المدعومة:
 * restaurant.html, Master.html, driver.html, liderdodsas.html,
 * privacy.html, delete-account.html
 *
 * ملاحظات:
 * - يجب أن يكون هذا الملف في نفس مجلد الصفحات.
 * - لا يتم تخزين Firebase أو Google Apps Script أو التوكنات داخل الكاش.
 * - يحفظ واجهة النظام وملفاته المحلية للعمل عند انقطاع الإنترنت.
 */

'use strict';

const CACHE_NAME = 'pro-system-v15';
const CDN_CACHE_NAME = 'pro-cdn-v15';
const APP_ROOT = new URL('./', self.location.href);

// الملفات المحلية الأساسية للنظام.
// أسماء الملفات حساسة لحالة الأحرف في GitHub Pages.
const APP_SHELL = [
  './',
  './restaurant.html',
  './Master.html',
  './driver.html',
  './liderdodsas.html',
  './privacy.html',
  './delete-account.html',
  './manifest_restaurant.json',
  './manifest_master.json',
  './pro_logo.png'
].map((path) => new URL(path, APP_ROOT).href);

const OFFLINE_PAGE = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0f172a">
  <title>نظام Pro</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: linear-gradient(145deg, #ffca70, #ff8a00 55%, #e76f00);
      color: #0f172a;
      font-family: system-ui, -apple-system, "Cairo", sans-serif;
      text-align: center;
    }
    .card {
      width: min(100%, 460px);
      padding: 32px 24px;
      border-radius: 26px;
      background: rgba(255, 255, 255, .94);
      box-shadow: 0 18px 50px rgba(15, 23, 42, .18);
    }
    .signal { font-size: 58px; line-height: 1; margin-bottom: 18px; }
    h1 { margin: 0 0 10px; font-size: 24px; }
    p { margin: 0 auto 22px; color: #475569; line-height: 1.8; }
    button {
      border: 0;
      border-radius: 14px;
      padding: 13px 28px;
      color: #fff;
      background: #0f172a;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="signal" aria-hidden="true">📡</div>
    <h1>لا يوجد اتصال بالإنترنت</h1>
    <p>تم حفظ واجهة النظام على الجهاز. أعد المحاولة عند عودة الاتصال.</p>
    <button onclick="location.reload()">إعادة المحاولة</button>
  </main>
</body>
</html>`;

function isDataRequest(url) {
  const host = url.hostname;
  return (
    host === 'script.google.com' ||
    host === 'script.googleusercontent.com' ||
    host.endsWith('.firebaseio.com') ||
    host.endsWith('.firebasedatabase.app') ||
    host.endsWith('.firebasestorage.app') ||
    host.endsWith('.googleapis.com') ||
    host === 'securetoken.googleapis.com' ||
    host.endsWith('.cloudfunctions.net') ||
    host.endsWith('.run.app') ||
    host.includes('imgbb.com')
  );
}

function isCdnAsset(url) {
  return (
    url.hostname === 'www.gstatic.com' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'unpkg.com' ||
    url.hostname === 'cdn.jsdelivr.net' ||
    url.hostname === 'basemaps.cartocdn.com' ||
    url.hostname === 'actions.google.com'
  );
}

async function cacheOptional(cache, url) {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    // لا نخزن opaque أو الردود الفاشلة.
    if (response && response.status === 200 && response.type !== 'opaque') {
      await cache.put(url, response.clone());
    }
  } catch (_) {
    // الملف قد يكون اختياريًا أو لم يُرفع بعد؛ لا نفشل تثبيت SW كله.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(APP_SHELL.map((url) => cacheOptional(cache, url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) =>
            (key.startsWith('pro-system-') || key.startsWith('PRO-Core-')) &&
            key !== CACHE_NAME
          )
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // بيانات الحسابات والطلبات يجب أن تمر مباشرة إلى الخادم.
  if (isDataRequest(url)) return;

  // صفحات النظام: الشبكة أولًا لضمان التحديث، ثم الكاش عند انقطاع الشبكة.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-cache' });
        if (response && response.status === 200 && url.origin === self.location.origin) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (_) {
        const cached = await caches.match(request) ||
          await caches.match(new URL('./restaurant.html', APP_ROOT).href) ||
          await caches.match(new URL('./Master.html', APP_ROOT).href);
        return cached || new Response(OFFLINE_PAGE, {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    })());
    return;
  }

  // ملفات المشروع المحلية: الكاش أولًا مع تحديثها في الخلفية.
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      const update = fetch(request).then(async (response) => {
        if (response && response.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      }).catch(() => cached);

      if (cached) {
        event.waitUntil(update);
        return cached;
      }
      return update;
    })());
    return;
  }

  // مكتبات الواجهة والخطوط: الكاش أولًا ثم الشبكة.
  if (isCdnAsset(url)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response && response.status === 200 && response.type !== 'opaque') {
          const cache = await caches.open(CDN_CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (_) {
        return new Response('', { status: 503 });
      }
    })());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const dataUrl = event.notification && event.notification.data &&
    event.notification.data.url;
  const targetUrl = dataUrl
    ? new URL(dataUrl, APP_ROOT).href
    : new URL('./restaurant.html', APP_ROOT).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const targetPath = new URL(targetUrl).pathname.toLowerCase();
        const client = windowClients.find((item) => {
          const path = new URL(item.url).pathname.toLowerCase();
          return path === targetPath ||
            path.endsWith('/restaurant.html') ||
            path.endsWith('/master.html') ||
            path.endsWith('/driver.html') ||
            path.endsWith('/liderdodsas.html');
        });

        if (client && 'focus' in client) return client.focus();
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
        return undefined;
      })
  );
});
