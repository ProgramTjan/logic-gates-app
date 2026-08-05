/* Forge Logic service worker — offline app shell + stale-while-revalidate.
 * Precache list + CACHE_VERSION come from sw-precache.js (npm run build:sw).
 */
/* eslint-disable no-restricted-globals */
importScripts("./sw-precache.js");

const CACHE_VERSION = self.__CACHE_VERSION || "dev";
const CACHE_NAME = `forge-logic-${CACHE_VERSION}`;
const PRECACHE = Array.isArray(self.__PRECACHE) ? self.__PRECACHE : [];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Add one-by-one so a single failure does not abort install.
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            await cache.add(url);
          } catch (error) {
            console.warn("[sw] precache skip", url, error);
          }
        })
      );
      // Navigation requests often use "./" rather than "./index.html".
      try {
        const shell = await cache.match("./index.html");
        if (shell) {
          await cache.put("./", shell.clone());
        }
      } catch (error) {
        console.warn("[sw] could not mirror index as ./", error);
      }
      // Do not skipWaiting — client shows “ververs” banner instead.
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  event.respondWith(handleGet(request));
});

async function handleGet(request) {
  const cache = await caches.open(CACHE_NAME);
  let cached = await cache.match(request);
  if (!cached && request.mode === "navigate") {
    cached = (await cache.match("./")) || (await cache.match("./index.html"));
  }

  // Stale-while-revalidate: return cache immediately; refresh in background when online.
  if (cached) {
    if (self.navigator.onLine) {
      refreshInBackground(cache, request);
    }
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    if (request.mode === "navigate") {
      const shell = (await cache.match("./")) || (await cache.match("./index.html"));
      if (shell) {
        return shell;
      }
    }
    return new Response("Offline", {
      status: 503,
      statusText: "Offline",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

function refreshInBackground(cache, request) {
  fetch(request)
    .then((response) => {
      if (response && response.ok) {
        return cache.put(request, response.clone());
      }
      return undefined;
    })
    .catch(() => undefined);
}
