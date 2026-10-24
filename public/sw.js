/**
 * Service worker: makes the installed game launch instantly and work offline.
 *
 * Two strategies, because navigations and assets want opposite things:
 *
 *  - Navigations are network-first with a cached fallback. index.html is the
 *    one file whose name never changes, so trusting the cache for it would
 *    pin you to an old build forever.
 *  - Everything else is stale-while-revalidate: serve from cache immediately
 *    (so a launch costs no network), and refresh the entry in the background.
 *    Safe because Vite content-hashes asset filenames — a changed file is a
 *    different URL, so a stale entry can never be the *wrong* content.
 *
 * Offline works from the second launch onward: the first visit populates the
 * cache. Since installing to the home screen requires visiting first, by the
 * time the icon exists the game is already fully cached.
 */

/**
 * Bump this to force every installed copy to throw its cache away.
 *
 * `activate` deletes every cache whose name isn't the current one, so changing
 * the version is the only lever that reaches a phone with the game already on
 * its home screen. Bump it after anything that could have been cached wrong.
 */
const VERSION = 'v4';
const CACHE = `trick-or-treat-${VERSION}`;

// The shell has stable, known names, so it can be cached up front.
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

/**
 * Every painted picture and recorded sound, read from the two indexes.
 *
 * Unlike the siblings, this game is meant to be played in the CAR, on the drive
 * to go trick-or-treating, where there may be no signal at all. The siblings
 * cache art and sound only as the game happens to fetch them, which is nearly
 * everything after one launch, but "nearly" is not good enough with a car full
 * of excited kids. So installing fetches the lot up front: one visit at home
 * on wifi, and the whole game works offline.
 */
async function everyAsset() {
  const urls = [];
  try {
    const sprites = await (await fetch('./sprites/index.json', { cache: 'no-cache' })).json();
    const ext = sprites.ext ?? 'jpg';
    urls.push('./sprites/index.json', ...(sprites.generated ?? []).map((id) => `./sprites/${id}.${ext}`));
  } catch {
    // No art yet: the game draws its fallbacks.
  }
  try {
    const sounds = await (await fetch('./sounds/index.json', { cache: 'no-cache' })).json();
    const ext = sounds.ext ?? 'm4a';
    urls.push('./sounds/index.json', ...[...(sounds.voices ?? []), ...(sounds.music ?? [])].map((id) => `./sounds/${id}.${ext}`));
  } catch {
    // No sound yet: synthesised effects only.
  }
  return urls;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Individually, so one failed entry doesn't abort the whole install.
      .then(async (cache) => {
        await Promise.allSettled(SHELL.map((url) => cache.add(url)));
        const assets = await everyAsset();
        await Promise.allSettled(assets.map((url) => cache.add(url)));
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit ?? caches.match('./'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        // Offline with nothing cached: let the failure surface as a failure.
        .catch(() => cached);
      return cached ?? network;
    }),
  );
});
