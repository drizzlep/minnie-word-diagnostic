const CACHE = "minnie-diagnostic-data-v2-summer-training-images";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./src/app.js",
  "./src/data.js",
  "./src/curriculum.js",
  "./src/diagnostic.js",
  "./src/memory-cards.js",
  "./src/storage.js",
  "./src/state-version.js",
  "./src/summer-training.js",
  "./assets/memory/adventure.jpg",
  "./assets/memory/direction.jpg",
  "./assets/memory/festival.jpg",
  "./assets/memory/restaurant.jpg",
  "./assets/memory/delicious.jpg",
  "./assets/memory/comfortable.jpg",
  "./assets/memory/classmate.jpg",
  "./assets/memory/building.jpg",
  "./assets/memory/interesting.jpg",
  "./assets/memory/important.jpg",
  "./assets/memory/medicine.jpg",
  "./assets/memory/dangerous.jpg",
  "./assets/memory/telescope.jpg",
  "./assets/memory/lighthouse.jpg",
  "./assets/memory/masterpiece.jpg",
  "./assets/memory/observatory.jpg",
  "./assets/memory/constellation.jpg",
  "./assets/memory/encyclopedia.jpg",
  "./assets/memory/supermarket.jpg",
  "./assets/memory/celebration.jpg",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then(async (cache) => {
    await cache.addAll(APP_SHELL);
    const indexResponse = await fetch("./assets/audio/index.json");
    const audioFiles = await indexResponse.clone().json();
    await cache.put("./assets/audio/index.json", indexResponse);
    await cache.addAll(audioFiles.map((file) => `./assets/audio/${file}`));
  }));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => event.request.mode === "navigate" ? caches.match("./index.html") : Response.error()))
  );
});
