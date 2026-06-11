import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

const IMG_BASE = 'https://image.tmdb.org/t/p/w92';

// Internal media server links (local network only)
const SONARR_URL = 'http://100.95.16.108:30113';
const RADARR_URL = 'http://100.95.16.108:30025';
const RADARR_API_KEY = 'cbc86ec4110741028822e35e6702c6cc';

const toSonarrSlug = (title) =>
    title.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

const openInSonarr = (title) => {
    window.open(`${SONARR_URL}/series/${toSonarrSlug(title)}`, '_blank', 'noopener');
};

const openInRadarr = (tmdbId) => {
    // Use a direct navigation URL that Radarr understands to avoid CORS fetch issues.
    // The 'add/new?term=tmdb:ID' URL opens the movie in Radarr directly.
    window.open(`${RADARR_URL}/add/new?term=tmdb:${tmdbId}`, '_blank', 'noopener');
};

const guessDeviceModel = (deviceInfo) => {
    if (!deviceInfo || !deviceInfo.userAgent) return 'Unknown Device';
    
    const ua = deviceInfo.userAgent;
    const width = Math.min(deviceInfo.screenWidth || 0, deviceInfo.screenHeight || 0);
    const height = Math.max(deviceInfo.screenWidth || 0, deviceInfo.screenHeight || 0);
    
    if (/iPhone/i.test(ua)) {
        if (width === 430 && height === 932) return 'iPhone 14/15/16 Pro Max / 16 Plus';
        if (width === 393 && height === 852) return 'iPhone 14/15/16 Pro / 15/16 / 14 Plus';
        if (width === 428 && height === 926) return 'iPhone 12/13/14 Pro Max / 14 Plus';
        if (width === 390 && height === 844) return 'iPhone 12/13/14 / 12/13/14 Pro';
        if (width === 375 && height === 812) return 'iPhone X/XS / 11 Pro / 12/13 Mini';
        if (width === 414 && height === 896) return 'iPhone XR/11 / XS Max / 11 Pro Max';
        if (width === 414 && height === 736) return 'iPhone 6/7/8 Plus';
        if (width === 375 && height === 667) return 'iPhone 6/7/8 / SE (2nd/3rd Gen)';
        return 'iPhone (Unknown Model)';
    }
    
    if (/iPad/i.test(ua) || (ua.includes('Mac') && typeof document !== 'undefined' && 'ontouchend' in document)) {
        if (width === 1024 && height === 1366) return 'iPad Pro 12.9"';
        if (width === 834 && height === 1194) return 'iPad Pro 11"';
        if (width === 820 && height === 1180) return 'iPad Air (4th/5th Gen)';
        if (width === 810 && height === 1080) return 'iPad (7th/8th/9th Gen)';
        if (width === 768 && height === 1024) return 'iPad Mini / iPad (<=6th Gen)';
        return 'iPad';
    }
    
    if (/Macintosh/i.test(ua)) return 'Mac / MacBook';
    if (/Windows/i.test(ua)) return 'Windows PC';
    if (/Android/i.test(ua)) {
        const match = ua.match(/Android.*?; ([^;]+)\sBuild/);
        return match ? `Android (${match[1].trim()})` : 'Android Device';
    }
    
    if (/Linux/i.test(ua)) return 'Linux Device';
    if (/CrOS/i.test(ua)) return 'Chromebook';
    
    return 'Other Device';
};

export default function AdminDashboard() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [assignName, setAssignName] = useState('');
    const [assigning, setAssigning] = useState(false);
    const [activeTab, setActiveTab] = useState('requests');
    const [customUsers, setCustomUsers] = useState([]);
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [createdCredentials, setCreatedCredentials] = useState(null);
    const [customUsersLoading, setCustomUsersLoading] = useState(false);
    const navigate = useNavigate();
    const { addToast } = useToast();

    const token = localStorage.getItem('jakeplex_token');

    useEffect(() => {
        if (!token) {
            navigate('/admin', { replace: true });
            return;
        }
        fetchRequests();
    }, []);

    useEffect(() => {
        if (activeTab === 'customUsers') fetchCustomUsers();
    }, [activeTab]);

    const fetchCustomUsers = async () => {
        setCustomUsersLoading(true);
        try {
            const res = await fetch('/api/auth/custom-users', { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) setCustomUsers(await res.json());
        } catch {}
        setCustomUsersLoading(false);
    };

    const handleCreateCustomUser = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/auth/custom-users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ username: newUsername, password: newPassword }),
            });
            const data = await res.json();
            if (!res.ok) { addToast(data.error || 'Failed to create user', 'error'); return; }
            setCreatedCredentials({ username: newUsername, password: newPassword });
            setNewUsername('');
            setNewPassword('');
            fetchCustomUsers();
        } catch { addToast('Failed to create user', 'error'); }
    };

    const handleDeleteCustomUser = async (id, username) => {
        if (!confirm(`Delete user "${username}"?`)) return;
        try {
            const res = await fetch(`/api/auth/custom-users/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) { addToast(`Deleted user "${username}"`, 'success'); fetchCustomUsers(); }
        } catch { addToast('Failed to delete user', 'error'); }
    };

    const fetchRequests = async () => {
        setLoading(true);
        try {
            // First, trigger auto-detect for any pending requests
            try {
                const autoRes = await fetch('/api/requests/auto-detect', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                });
                const autoData = await autoRes.json();
                if (autoData.updated && autoData.updated.length > 0) {
                    addToast(`Auto-approved ${autoData.updated.length} item(s) found on Plex!`, 'success');
                }
            } catch (err) {
                console.error('Auto-detect failed:', err);
                // Non-fatal, continue to fetch requests
            }

            // Then fetch the (potentially updated) list of requests
            const res = await fetch('/api/requests', {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('jakeplex_token');
                navigate('/admin', { replace: true });
                return;
            }

            const data = await res.json();
            setRequests(data);
        } catch (err) {
            addToast('Failed to load requests', 'error');
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id, status) => {
        try {
            await fetch(`/api/requests/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status }),
            });
            setRequests((prev) =>
                prev.map((r) => (r.id === id ? { ...r, status } : r))
            );
            addToast(`Request ${status}`, 'success');
        } catch (err) {
            addToast('Failed to update request', 'error');
        }
    };

    const deleteReq = async (id) => {
        try {
            await fetch(`/api/requests/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            setRequests((prev) => prev.filter((r) => r.id !== id));
            addToast('Request deleted', 'success');
        } catch (err) {
            addToast('Failed to delete request', 'error');
        }
    };

    const handleAssignIdentity = async (reqId, ip, ua) => {
        if (!assignName.trim()) {
            addToast('Please enter a name', 'error');
            return;
        }
        setAssigning(true);
        try {
            const res = await fetch(`/api/requests/${reqId}/assign-user`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    name: assignName.trim(), 
                    ip_address: ip, 
                    user_agent: ua 
                })
            });
            if (!res.ok) throw new Error('Failed');
            
            // Update local state
            setRequests(prev => prev.map(r => r.id === reqId ? { ...r, estimated_user: assignName.trim() } : r));
            setSelectedRequest(prev => ({ ...prev, estimated_user: assignName.trim() }));
            addToast('Identity assigned successfully!', 'success');
            setAssignName('');
        } catch (err) {
            addToast('Failed to assign identity', 'error');
        } finally {
            setAssigning(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('jakeplex_token');
        navigate('/admin', { replace: true });
    };

    const pendingCount = requests.filter((r) => r.status === 'pending').length;
    const approvedCount = requests.filter((r) => r.status === 'approved').length;
    const declinedCount = requests.filter((r) => r.status === 'declined').length;

    const filteredRequests = requests.filter((req) => {
        const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
        const matchesType = typeFilter === 'all' || req.media_type === typeFilter;
        return matchesStatus && matchesType;
    });

    const userProfiles = [];
    const usersMap = new Map();
    requests.forEach(req => {
        if (!req.ip_address || !req.device_info?.userAgent) return;
        const key = `${req.ip_address}_${req.device_info.userAgent}`;
        if (!usersMap.has(key)) {
            usersMap.set(key, {
                id: req.id, // reference ID for assignment
                ip_address: req.ip_address,
                location_info: req.location_info,
                device_info: req.device_info,
                estimated_user: req.estimated_user,
                names_used: new Set([req.requested_by || 'Anonymous']),
                request_count: 1,
                last_active: req.requested_at
            });
        } else {
            const u = usersMap.get(key);
            u.names_used.add(req.requested_by || 'Anonymous');
            u.request_count++;
            if (new Date(req.requested_at) > new Date(u.last_active)) {
                u.last_active = req.requested_at;
                if (req.estimated_user) u.estimated_user = req.estimated_user;
                u.id = req.id; // use latest request ID for future assignment payloads
            }
        }
    });
    usersMap.forEach(v => {
        v.names_used = Array.from(v.names_used).join(', ');
        userProfiles.push(v);
    });
    userProfiles.sort((a, b) => new Date(b.last_active) - new Date(a.last_active));

    const hardwareProfiles = [];
    const hardwareMap = new Map();
    requests.forEach(req => {
        if (!req.device_info?.userAgent) return;
        const guessedModel = guessDeviceModel(req.device_info);
        const resolutionString = `${req.device_info.screenWidth || 0}x${req.device_info.screenHeight || 0}`;
        const key = `${guessedModel}_${resolutionString}`;
        
        if (!hardwareMap.has(key)) {
            hardwareMap.set(key, {
                id: key,
                guessed_model: guessedModel,
                resolution: resolutionString,
                ua_snippet: req.device_info.userAgent.split(' ').slice(0,3).join(' ') + '...',
                full_ua: req.device_info.userAgent,
                request_count: 1,
                linked_users: new Set([req.estimated_user || req.requested_by || 'Anonymous']),
                last_active: req.requested_at
            });
        } else {
            const h = hardwareMap.get(key);
            h.linked_users.add(req.estimated_user || req.requested_by || 'Anonymous');
            h.request_count++;
            if (new Date(req.requested_at) > new Date(h.last_active)) {
                h.last_active = req.requested_at;
            }
        }
    });
    hardwareMap.forEach(v => {
        v.linked_users = Array.from(v.linked_users).join(', ');
        hardwareProfiles.push(v);
    });
    hardwareProfiles.sort((a, b) => b.request_count - a.request_count); // Sort by most popular hardware

    if (loading) {
        return (
            <div className="page">
                <div className="loading" style={{ minHeight: '60vh' }}>
                    <div className="spinner" />
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="container dashboard">
                <div className="dashboard-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <h1 style={{ margin: 0 }}>Dashboard <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>v{__APP_VERSION__}</span></h1>
                        <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '4px' }}>
                            <button 
                                onClick={() => setActiveTab('requests')}
                                style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: activeTab === 'requests' ? 'var(--accent-primary)' : 'transparent', color: activeTab === 'requests' ? '#1a1a1a' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
                            >
                                Requests
                            </button>
                            <button 
                                onClick={() => setActiveTab('users')}
                                style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: activeTab === 'users' ? 'var(--accent-primary)' : 'transparent', color: activeTab === 'users' ? '#1a1a1a' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
                            >
                                Users
                            </button>
                            <button
                                onClick={() => setActiveTab('devices')}
                                style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: activeTab === 'devices' ? 'var(--accent-primary)' : 'transparent', color: activeTab === 'devices' ? '#1a1a1a' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
                            >
                                Devices
                            </button>
                            <button
                                onClick={() => setActiveTab('customUsers')}
                                style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: activeTab === 'customUsers' ? 'var(--accent-primary)' : 'transparent', color: activeTab === 'customUsers' ? '#1a1a1a' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
                            >
                                Custom Users
                            </button>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div className="dashboard-stats">
                            <div className="stat-card">
                                <div className="stat-number">{pendingCount}</div>
                                <div className="stat-label">Pending</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-number">{approvedCount}</div>
                                <div className="stat-label">Approved</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-number">{declinedCount}</div>
                                <div className="stat-label">Declined</div>
                            </div>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                </div>

                {activeTab === 'requests' ? (
                    <>
                        <div className="filter-bar">
                    <div className="filter-group">
                        <span className="filter-label">Status:</span>
                        <div className="filter-chips">
                            {[
                                { id: 'all', label: 'All' },
                                { id: 'pending', label: 'Pending' },
                                { id: 'approved', label: 'Installed' },
                                { id: 'declined', label: 'Declined' }
                            ].map(status => (
                                <button
                                    key={status.id}
                                    className={`filter-chip ${statusFilter === status.id ? 'active' : ''}`}
                                    onClick={() => setStatusFilter(status.id)}
                                >
                                    {status.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="filter-group">
                        <span className="filter-label">Type:</span>
                        <div className="filter-chips">
                            {[
                                { id: 'all', label: 'All' },
                                { id: 'movie', label: 'Movies' },
                                { id: 'tv', label: 'TV' }
                            ].map(type => (
                                <button
                                    key={type.id}
                                    className={`filter-chip ${typeFilter === type.id ? 'active' : ''}`}
                                    onClick={() => setTypeFilter(type.id)}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {filteredRequests.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📭</div>
                        <h3>No matching requests</h3>
                        <p>Try adjusting your filters</p>
                    </div>
                ) : (
                    <div className="requests-table-wrapper">
                        <table className="requests-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Type</th>
                                    <th>Requested By</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRequests.map((req) => (
                                    <tr key={req.id}>
                                        <td data-label="Title">
                                            <div
                                                className="request-row-media"
                                                style={{ cursor: req.tmdb_id ? 'pointer' : 'default' }}
                                                title={req.tmdb_id ? 'View details' : undefined}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (req.tmdb_id && req.media_type) {
                                                        navigate(`/${req.media_type}/${req.tmdb_id}`);
                                                    }
                                                }}
                                            >
                                                {req.poster_path ? (
                                                    <img
                                                        className="request-row-poster"
                                                        src={`${IMG_BASE}${req.poster_path}`}
                                                        alt={req.title}
                                                    />
                                                ) : (
                                                    <div
                                                        className="request-row-poster"
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '1.2rem',
                                                        }}
                                                    >
                                                        🎬
                                                    </div>
                                                )}
                                                <div>
                                                    <div
                                                        className="request-row-title"
                                                        style={{ textDecoration: 'underline', textDecorationColor: 'var(--accent-primary)', textUnderlineOffset: '3px' }}
                                                    >
                                                        {req.title}
                                                    </div>
                                                    {req.year && (
                                                        <div className="request-row-year">{req.year}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td data-label="Type">
                                            <span className={`badge badge-${req.media_type}`}>
                                                {req.media_type === 'movie' ? 'Movie' : 'TV'}
                                            </span>
                                        </td>
                                        <td 
                                            data-label="Requested By" 
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => setSelectedRequest(req)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                {req.plex_thumb ? (
                                                    <img src={req.plex_thumb} alt="Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }} />
                                                ) : (
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem', color: '#1a1a1a', flexShrink: 0 }}>
                                                        {(req.requested_by || 'A').charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        {req.requested_by || 'Anonymous'}
                                                    </span>
                                                    {req.plex_email ? (
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                            {req.plex_email}
                                                        </span>
                                                    ) : req.estimated_user ? (
                                                        <span className="badge badge-pending" style={{ fontSize: '0.65rem', backgroundColor: 'var(--accent-primary)', color: '#1a1a1a', marginTop: '2px', alignSelf: 'flex-start' }}>
                                                            Known: {req.estimated_user}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </td>
                                        <td data-label="Status">
                                            <span className={`badge badge-${req.status}`}>
                                                {req.status === 'approved' ? 'installed' : req.status}
                                            </span>
                                        </td>
                                        <td data-label="Date" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {new Date(req.requested_at).toLocaleDateString('en-GB', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                            })}
                                        </td>
                                        <td data-label="Actions">
                                            <div className="request-row-actions">
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    title={req.media_type === 'tv' ? 'Open in Sonarr' : 'Open in Radarr'}
                                                    onClick={() => {
                                                        if (req.media_type === 'tv') {
                                                            openInSonarr(req.title);
                                                        } else {
                                                            openInRadarr(req.tmdb_id);
                                                        }
                                                    }}
                                                >
                                                    {req.media_type === 'tv' ? 'Sonarr ↗' : 'Radarr ↗'}
                                                </button>
                                                {req.status !== 'approved' && (
                                                    <button
                                                        className="btn btn-success btn-sm"
                                                        onClick={() => updateStatus(req.id, 'approved')}
                                                    >
                                                        Approve
                                                    </button>
                                                )}
                                                {req.status !== 'declined' && (
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => updateStatus(req.id, 'declined')}
                                                    >
                                                        Decline
                                                    </button>
                                                )}
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() => deleteReq(req.id)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                    </>
                ) : activeTab === 'users' ? (
                    <div className="requests-table-wrapper" style={{ marginTop: '20px' }}>
                        <table className="requests-table">
                            <thead>
                                <tr>
                                    <th>Identity</th>
                                    <th>Location</th>
                                    <th>Browser / OS</th>
                                    <th>Names Used</th>
                                    <th>Total Requests</th>
                                    <th>Last Active</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {userProfiles.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>No device footprints found.</td>
                                    </tr>
                                ) : userProfiles.map(user => (
                                    <tr key={user.id}>
                                        <td data-label="Identity">
                                            {user.estimated_user ? (
                                                <span className="badge badge-pending" style={{ backgroundColor: 'var(--accent-primary)', color: '#1a1a1a' }}>
                                                    Known: {user.estimated_user}
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                                            )}
                                        </td>
                                        <td data-label="Location">
                                            {user.location_info?.country !== 'Unknown' ? `${user.location_info?.city}, ${user.location_info?.country}` : 'Unknown'}
                                        </td>
                                        <td data-label="Browser / OS" className="truncate-cell" style={{ maxWidth: '200px' }} title={user.device_info?.userAgent}>
                                            {user.device_info?.userAgent?.split(' ')[0] || 'Unknown'}
                                        </td>
                                        <td data-label="Names Used" style={{ fontStyle: 'italic' }}>
                                            {user.names_used}
                                        </td>
                                        <td data-label="Total Requests">
                                            {user.request_count}
                                        </td>
                                        <td data-label="Last Active" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {new Date(user.last_active).toLocaleDateString()}
                                        </td>
                                        <td data-label="Actions">
                                            <button 
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => setSelectedRequest(user)}
                                            >
                                                Assign Identity
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : activeTab === 'devices' ? (
                    <div className="requests-table-wrapper" style={{ marginTop: '20px' }}>
                        <table className="requests-table">
                            <thead>
                                <tr>
                                    <th>Hardware Model</th>
                                    <th>Resolution</th>
                                    <th>User Agent Snippet</th>
                                    <th>Linked Users</th>
                                    <th>Total Requests</th>
                                    <th>Last Active</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hardwareProfiles.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No devices found.</td>
                                    </tr>
                                ) : hardwareProfiles.map(device => (
                                    <tr key={device.id}>
                                        <td data-label="Hardware Model" style={{ fontWeight: typeof device.guessed_model === 'string' && !device.guessed_model.includes('Unknown') ? 'bold' : 'normal', color: 'var(--text-primary)' }}>
                                            {device.guessed_model}
                                        </td>
                                        <td data-label="Resolution">
                                            {device.resolution}
                                        </td>
                                        <td data-label="User Agent Snippet" className="truncate-cell" style={{ maxWidth: '250px' }} title={device.full_ua}>
                                            {device.ua_snippet}
                                        </td>
                                        <td data-label="Linked Users" style={{ fontStyle: 'italic', color: 'var(--accent-secondary)' }}>
                                            {device.linked_users}
                                        </td>
                                        <td data-label="Total Requests">
                                            {device.request_count}
                                        </td>
                                        <td data-label="Last Active" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {new Date(device.last_active).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : activeTab === 'customUsers' ? (
                    <div style={{ marginTop: '20px', maxWidth: '600px' }}>
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
                            <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>Create Custom Login</h3>
                            <form onSubmit={handleCreateCustomUser} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>Username</label>
                                    <input className="form-input" type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="Enter username" required />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>Password</label>
                                    <input className="form-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter password" required />
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Create User</button>
                            </form>
                        </div>

                        {createdCredentials && (
                            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: '10px', padding: '18px', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <span style={{ fontWeight: 700, color: '#4ade80' }}>User created — save these credentials</span>
                                    <button onClick={() => setCreatedCredentials(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ color: 'var(--text-muted)', minWidth: '90px' }}>Username:</span>
                                        <span style={{ background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: '4px', color: 'var(--text-primary)' }}>{createdCredentials.username}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ color: 'var(--text-muted)', minWidth: '90px' }}>Password:</span>
                                        <span style={{ background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: '4px', color: 'var(--text-primary)' }}>{createdCredentials.password}</span>
                                        <button onClick={() => { navigator.clipboard.writeText(createdCredentials.password); addToast('Password copied', 'success'); }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 8px', fontSize: '0.8rem' }}>Copy</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary)' }}>Existing Custom Users</h3>
                        {customUsersLoading ? (
                            <div className="loading"><div className="spinner" /></div>
                        ) : customUsers.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>No custom users yet.</p>
                        ) : (
                            <div className="requests-table-wrapper">
                                <table className="requests-table">
                                    <thead><tr><th>Username</th><th>Password</th><th>Created</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {customUsers.map(u => (
                                            <tr key={u.id} style={{ cursor: 'default' }}>
                                                <td data-label="Username" style={{ fontWeight: 600 }}>{u.username}</td>
                                                <td data-label="Password">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{u.password || '—'}</span>
                                                        {u.password && (
                                                            <button onClick={() => { navigator.clipboard.writeText(u.password); addToast('Password copied', 'success'); }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 8px', fontSize: '0.75rem' }}>Copy</button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td data-label="Created" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                                                <td data-label="Action">
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCustomUser(u.id, u.username)}>Delete</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>

            {/* Analytics Modal */}
            {selectedRequest && (
                <div className="modal-overlay" onClick={() => setSelectedRequest(null)} style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200}}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto'}}>
                        <h2 style={{marginTop: 0, marginBottom: '16px', color: 'var(--text-primary)'}}>
                            Analytics for {selectedRequest.requested_by || 'Anonymous'}
                        </h2>
                        
                        <div style={{marginBottom: '20px'}}>
                            <h3 style={{color: 'var(--accent-primary)', fontSize: '1.1rem', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px'}}>Network</h3>
                            <p style={{margin: '4px 0'}}><strong>IP Address:</strong> {selectedRequest.ip_address || 'Unknown'}</p>
                            {selectedRequest.location_info && selectedRequest.location_info.country !== 'Unknown' && (
                                <p style={{margin: '4px 0'}}><strong>Location:</strong> {selectedRequest.location_info.city !== 'Unknown' ? `${selectedRequest.location_info.city}, ` : ''}{selectedRequest.location_info.region !== 'Unknown' ? `${selectedRequest.location_info.region}, ` : ''}{selectedRequest.location_info.country}</p>
                            )}
                            <p style={{margin: '4px 0'}}><strong>Connection Type:</strong> {selectedRequest.device_info?.connectionType || 'Unknown'}</p>
                        </div>

                        <div style={{marginBottom: '20px'}}>
                            <h3 style={{color: 'var(--accent-primary)', fontSize: '1.1rem', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px'}}>Assigned Identity</h3>
                            {selectedRequest.estimated_user ? (
                                <p style={{margin: '4px 0'}}><strong>Known User:</strong> <span style={{color: 'var(--accent-secondary)', fontWeight: 'bold'}}>{selectedRequest.estimated_user}</span></p>
                            ) : (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        placeholder="Assign real name..." 
                                        value={assignName}
                                        onChange={(e) => setAssignName(e.target.value)}
                                        style={{ padding: '6px 10px', fontSize: '0.9rem', flex: 1 }}
                                    />
                                    <button 
                                        className="btn btn-secondary btn-sm"
                                        disabled={assigning}
                                        onClick={() => handleAssignIdentity(selectedRequest.id, selectedRequest.ip_address, selectedRequest.device_info?.userAgent)}
                                    >
                                        {assigning ? 'Saving...' : 'Set Known User'}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div style={{marginBottom: '20px'}}>
                            <h3 style={{color: 'var(--accent-primary)', fontSize: '1.1rem', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px'}}>Device & Browser</h3>
                            <p style={{margin: '4px 0'}}><strong>OS / Browser:</strong> {selectedRequest.device_info?.userAgent || 'Unknown'}</p>
                            <p style={{margin: '4px 0'}}><strong>Language:</strong> {selectedRequest.device_info?.language || 'Unknown'}</p>
                            <p style={{margin: '4px 0'}}><strong>Time Zone:</strong> {selectedRequest.device_info?.timeZone || 'Unknown'}</p>
                            <p style={{margin: '4px 0'}}><strong>Screen Resolution:</strong> {selectedRequest.device_info?.screenWidth}x{selectedRequest.device_info?.screenHeight}</p>
                            <p style={{margin: '4px 0'}}><strong>Viewport Size:</strong> {selectedRequest.device_info?.innerWidth}x{selectedRequest.device_info?.innerHeight}</p>
                            <p style={{margin: '4px 0'}}><strong>RAM Estimate:</strong> {selectedRequest.device_info?.deviceMemory ? `${selectedRequest.device_info.deviceMemory} GB` : 'Unknown'}</p>
                            <p style={{margin: '4px 0'}}><strong>Logical Cores:</strong> {selectedRequest.device_info?.hardwareConcurrency || 'Unknown'}</p>
                        </div>

                        <button className="btn btn-secondary" onClick={() => setSelectedRequest(null)} style={{width: '100%', marginTop: '10px'}}>
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
