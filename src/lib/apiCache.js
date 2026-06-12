// Tiny module-scope fetch cache: dedupes in-flight requests and serves repeats
// within the TTL. Pages share entries by URL (e.g. SearchResults and Library
// both read /api/plex/library), so navigating around stops re-crawling the
// Plex server on every visit.
const cache = new Map(); // url -> { ts, promise }

export function cachedJson(url, ttl = 5 * 60_000) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.ts < ttl) return hit.promise;
    const promise = fetch(url).then(r => r.json());
    cache.set(url, { ts: Date.now(), promise });
    // A failed fetch shouldn't poison the cache for the whole TTL
    promise.catch(() => cache.delete(url));
    return promise;
}
