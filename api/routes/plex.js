import { Router } from 'express';

const router = Router();

const getPlexConfig = () => {
    const plexUrl = process.env.PLEX_URL;
    const plexToken = process.env.PLEX_TOKEN;
    if (!plexUrl || !plexToken || plexUrl.includes('your-plex-ip') || plexToken.includes('YOUR_PLEX_TOKEN')) {
        return null;
    }
    return {
        url: plexUrl.endsWith('/') ? plexUrl.slice(0, -1) : plexUrl,
        token: plexToken,
    };
};

const sanitize = (metadata, type) =>
    metadata.map(item => ({
        id: item.ratingKey,
        title: item.title,
        year: item.year,
        type, // 'movie' or 'show'
        poster_path: item.thumb,
        addedAt: item.addedAt,
    }));

const fetchSections = async ({ url, token }) => {
    const res = await fetch(`${url}/library/sections?X-Plex-Token=${token}`, {
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to fetch sections');
    const data = await res.json();
    return (data.MediaContainer?.Directory || []).filter(d => d.type === 'movie' || d.type === 'show');
};

const fetchSectionItems = ({ url, token }, dir, limit) => {
    const paging = limit ? `&X-Plex-Container-Start=0&X-Plex-Container-Size=${limit}` : '';
    return fetch(`${url}/library/sections/${dir.key}/all?sort=addedAt%3Adesc${paging}&X-Plex-Token=${token}`, {
        headers: { Accept: 'application/json' },
    }).then(async (libRes) => {
        if (!libRes.ok) return [];
        const libData = await libRes.json();
        return sanitize(libData.MediaContainer?.Metadata || [], dir.type);
    }).catch(e => {
        console.error('Section fetch error:', e);
        return [];
    });
};

// Module-scope TTL cache: warm serverless invocations share module state, so
// repeat hits within the TTL skip the (slow, multi-MB) Plex library walk.
// The in-flight promise also dedupes concurrent callers — /library is hit by
// every search, so bursts collapse into one upstream crawl.
const TTL = 5 * 60_000;
const cache = new Map(); // key -> { ts, promise }

const cached = (key, fn) => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < TTL) return hit.promise;
    const promise = fn().catch(err => { cache.delete(key); throw err; });
    cache.set(key, { ts: Date.now(), promise });
    return promise;
};

// Full library walk — used by /library (and importable by other routes)
export const fetchPlexLibrary = () => {
    const config = getPlexConfig();
    if (!config) return Promise.resolve(null);
    return cached('library', async () => {
        const sections = await fetchSections(config);
        const resultsArrays = await Promise.all(sections.map(dir => fetchSectionItems(config, dir)));
        const allItems = resultsArrays.flat();
        allItems.sort((a, b) => b.addedAt - a.addedAt);
        return allItems;
    });
};

router.get('/check', async (req, res) => {
    try {
        const { title, year } = req.query;
        if (!title) {
            return res.status(400).json({ error: 'Title required' });
        }

        const config = getPlexConfig();
        if (!config) {
            return res.json({ available: false, configured: false });
        }

        // Response is user-independent — let the edge serve repeat lookups
        res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

        const searchUrl = `${config.url}/search?query=${encodeURIComponent(title)}&X-Plex-Token=${config.token}`;
        const response = await fetch(searchUrl, {
            headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
            console.error(`Plex API Error: ${response.status}`);
            return res.json({ available: false, error: 'Plex connection failed' });
        }

        const data = await response.json();
        const results = data.MediaContainer?.Metadata || [];

        // Simple match on title, and optionally year to be safe
        let isAvailable = false;
        for (const item of results) {
            if (item.type === 'movie' || item.type === 'show') {
                const titleMatches = item.title.toLowerCase() === title.toLowerCase();
                let yearMatches = true;
                if (year && item.year) {
                    // Allow 1 year difference due to release date variations
                    yearMatches = Math.abs(parseInt(item.year) - parseInt(year)) <= 1;
                }
                if (titleMatches && yearMatches) {
                    isAvailable = true;
                    break;
                }
            }
        }

        // Return ONLY a simple boolean to the frontend to keep Plex details secure
        res.json({ available: isAvailable, configured: true });
    } catch (err) {
        console.error('Plex Proxy Error:', err);
        // Fail silently to the frontend so the app doesn't break if Plex is offline
        res.json({ available: false, error: 'Internal server error' });
    }
});

// Securely fetch all installed movies/shows
router.get('/library', async (req, res) => {
    try {
        const items = await fetchPlexLibrary();
        if (items === null) {
            return res.json({ error: 'Plex not configured', items: [] });
        }
        // Library contents change rarely; 5-min edge staleness is invisible and
        // lets Vercel's CDN answer without invoking the function at all
        res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        res.json({ items });
    } catch (err) {
        console.error('Plex Library Error:', err.message, err.cause);
        res.json({ items: [], error: `Fetch failed: ${err.message} | Cause: ${err.cause ? err.cause.message : 'unknown'}` });
    }
});

// Securely fetch recently added items
router.get('/recent-unrequested', async (req, res) => {
    try {
        const config = getPlexConfig();
        if (!config) {
            return res.json({ error: 'Plex not configured', items: [] });
        }

        // Only the 10 newest per section are requested from Plex (the sections
        // are already sorted addedAt:desc) — the old version transferred the
        // entire library to return 10 items.
        const items = await cached('recent', async () => {
            const sections = await fetchSections(config);
            const resultsArrays = await Promise.all(sections.map(dir => fetchSectionItems(config, dir, 10)));
            const allItems = resultsArrays.flat();
            allItems.sort((a, b) => b.addedAt - a.addedAt);
            return allItems.slice(0, 10);
        });

        res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        res.json({ items });
    } catch (err) {
        console.error('Plex Recent-Unrequested Error:', err.message, err.cause);
        res.json({ items: [], error: `Fetch failed: ${err.message}` });
    }
});

// Securely proxy Plex images so tokens aren't sent to frontend
router.get('/image', async (req, res) => {
    try {
        const { path } = req.query;
        if (!path) return res.status(400).send('Path required');

        const config = getPlexConfig();
        if (!config) return res.status(503).send('Plex not configured');

        const imageUrl = `${config.url}${path}?X-Plex-Token=${config.token}`;
        const response = await fetch(imageUrl);

        if (!response.ok) {
            return res.status(response.status).send('Image failed to load');
        }

        const buffer = await response.arrayBuffer();
        res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
        // s-maxage lets Vercel's CDN serve every user from one origin fetch per day
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
        res.send(Buffer.from(buffer));
    } catch (err) {
        console.error('Image proxy error:', err);
        res.status(500).send('Error loading image');
    }
});

export default router;
