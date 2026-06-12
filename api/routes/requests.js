import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { addRequest, getRequests, getRequestByTmdbId, getRequestsByUser, updateRequestStatus, deleteRequest, updateRequestEstimatedUser, assignKnownDevice, findKnownDevice } from '../db.js';
import { verifyToken } from '../middleware/auth.js';
import { fetchPlexLibrary } from './plex.js';

// Resolves a Bearer token to { username, email, thumb } — supports both Plex tokens and custom user JWTs
async function resolveRequester(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role === 'custom') {
            return { username: decoded.username, email: null, thumb: null };
        }
    } catch {}
    const plexRes = await fetch('https://plex.tv/api/v2/user', {
        headers: { 'Accept': 'application/json', 'X-Plex-Token': token, 'X-Plex-Client-Identifier': 'jakeplex-backend' }
    });
    if (!plexRes.ok) return null;
    const u = await plexRes.json();
    return { username: u.username || u.email, email: u.email, thumb: u.thumb };
}

const router = Router();

// Public: submit a request
router.post('/', async (req, res) => {
    try {
        const { tmdb_id, media_type, title, poster_path, backdrop_path, overview, year, device_info } = req.body;

        const requester = await resolveRequester(req.headers.authorization);
        if (!requester) {
            return res.status(401).json({ error: 'Unauthorized: valid login required to make a request' });
        }

        const requested_by = requester.username;
        const plex_email = requester.email;
        const plex_thumb = requester.thumb;
        const ip_address = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip;
        
        const location_info = {
            city: req.headers['x-vercel-ip-city'] || 'Unknown',
            region: req.headers['x-vercel-ip-country-region'] || 'Unknown',
            country: req.headers['x-vercel-ip-country'] || 'Unknown'
        };

        if (!tmdb_id || !media_type || !title) {
            return res.status(400).json({ error: 'tmdb_id, media_type, and title are required' });
        }

        // Check if already requested
        const existing = await getRequestByTmdbId(tmdb_id, media_type);
        if (existing) {
            return res.status(409).json({ error: 'Already requested', request: existing });
        }

        let estimated_user = null;
        if (ip_address && device_info?.userAgent) {
            const knownDevice = await findKnownDevice(ip_address, device_info.userAgent);
            if (knownDevice) {
                estimated_user = knownDevice.assigned_user;
            }
        }

        const result = await addRequest({ 
            tmdb_id, media_type, title, poster_path, backdrop_path, 
            overview, year, requested_by, plex_email, plex_thumb, device_info, ip_address, location_info, estimated_user 
        });
        res.status(201).json({ id: result.id, message: 'Request submitted!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Public: get my requests
router.get('/me', async (req, res) => {
    try {
        const requester = await resolveRequester(req.headers.authorization);
        if (!requester) return res.status(401).json({ error: 'Unauthorized' });
        const myRequests = await getRequestsByUser(requester.username);
        res.json(myRequests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Public: cancel my request
router.delete('/me/:id', async (req, res) => {
    try {
        const requester = await resolveRequester(req.headers.authorization);
        if (!requester) return res.status(401).json({ error: 'Unauthorized' });
        const username = requester.username;

        const myRequests = await getRequestsByUser(username);
        const reqToDelete = myRequests.find(r => r.id === req.params.id);

        if (!reqToDelete) {
            return res.status(403).json({ error: 'Request not found or not owned by you' });
        }

        if (reqToDelete.status !== 'pending') {
            return res.status(400).json({ error: 'Can only cancel pending requests' });
        }

        await deleteRequest(req.params.id);
        res.json({ message: 'Request cancelled' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Public: check if a specific item has been requested
router.get('/check/:tmdbId/:mediaType', async (req, res) => {
    try {
        const existing = await getRequestByTmdbId(parseInt(req.params.tmdbId), req.params.mediaType);
        res.json({ requested: !!existing, request: existing || null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: get all requests
router.get('/', verifyToken, async (req, res) => {
    try {
        const requests = await getRequests();
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: update request status
router.patch('/:id', verifyToken, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['pending', 'approved', 'declined'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        await updateRequestStatus(req.params.id, status);
        res.json({ message: 'Status updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: delete request
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        await deleteRequest(req.params.id);
        res.json({ message: 'Request deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: auto-detect installed items on Plex and mark as approved
router.post('/auto-detect', verifyToken, async (req, res) => {
    try {
        // 1. Get all requests
        const allRequests = await getRequests();
        const pendingRequests = allRequests.filter(r => r.status === 'pending');

        if (pendingRequests.length === 0) {
            return res.json({ updated: [], message: 'No pending requests' });
        }

        // 2. Reuse the shared (TTL-cached) library walk instead of a third
        // copy of the full Plex crawl
        const libraryItems = await fetchPlexLibrary();
        if (libraryItems === null) {
            return res.json({ updated: [], message: 'Plex not configured' });
        }
        const plexItems = libraryItems.map(item => ({
            title: item.title?.toLowerCase(),
            year: item.year
        }));

        // 4. Cross-reference: check each pending request against Plex
        const updated = [];
        for (const req of pendingRequests) {
            const reqTitle = req.title?.toLowerCase();
            const reqYear = req.year ? parseInt(req.year) : null;

            const found = plexItems.some(item => {
                const titleMatch = item.title === reqTitle;
                const yearMatch = !reqYear || !item.year || Math.abs(item.year - reqYear) <= 1;
                return titleMatch && yearMatch;
            });

            if (found) {
                await updateRequestStatus(req.id, 'approved');
                updated.push({ id: req.id, title: req.title });
            }
        }

        res.json({ updated, message: `${updated.length} request(s) auto-approved` });
    } catch (err) {
        console.error('Auto-detect error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin: Assign a known user to a request's device signature
router.post('/:id/assign-user', verifyToken, async (req, res) => {
    try {
        const { name, ip_address, user_agent } = req.body;
        if (!name || !ip_address || !user_agent) {
            return res.status(400).json({ error: 'Name, ip_address, and user_agent are required' });
        }
        
        await assignKnownDevice(name, ip_address, user_agent);
        await updateRequestEstimatedUser(req.params.id, name);
        
        res.json({ message: 'User identity assigned to device!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
