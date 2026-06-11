import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const IMG_BASE = 'https://image.tmdb.org/t/p';

export default function MyRequests() {
    const { plexUser, logout } = useAuth();
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cancellingId, setCancellingId] = useState(null);
    const [confirmCancelId, setConfirmCancelId] = useState(null);

    useEffect(() => {
        window.scrollTo(0, 0);
        if (!plexUser) {
            navigate('/');
            return;
        }

        const fetchMyRequests = async () => {
            try {
                const res = await fetch('/api/requests/me', {
                    headers: { 'Authorization': `Bearer ${plexUser.token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    // Sort pending to top, then newest
                    data.sort((a, b) => {
                        if (a.status === 'pending' && b.status !== 'pending') return -1;
                        if (b.status === 'pending' && a.status !== 'pending') return 1;
                        return new Date(b.requested_at) - new Date(a.requested_at);
                    });
                    setRequests(data);
                }
            } catch (err) {
                console.error("Failed to fetch my requests", err);
            } finally {
                setLoading(false);
            }
        };

        fetchMyRequests();
    }, [plexUser, navigate]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const openDetail = (req) => {
        if (!req.tmdb_id || !req.media_type) return;
        navigate(`/${req.media_type}/${req.tmdb_id}`);
    };

    const confirmAndCancel = async (id) => {
        setCancellingId(id);
        setConfirmCancelId(null);
        try {
            const res = await fetch(`/api/requests/me/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${plexUser.token}` }
            });
            if (res.ok) {
                setRequests(prev => prev.filter(r => r.id !== id));
            } else {
                console.error("Failed to cancel");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setCancellingId(null);
        }
    };

    if (!plexUser) return null;

    return (
        <div className="page">
            <div className="container dashboard">
                <div className="dashboard-header" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {plexUser.thumb ? (
                            <img src={plexUser.thumb} alt="Avatar" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
                        ) : (
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
                                {plexUser.username.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <h1 style={{ fontSize: '1.8rem', margin: 0 }}>My Requests</h1>
                            <span style={{ color: 'var(--text-muted)' }}>{plexUser.email || plexUser.username}</span>
                        </div>
                    </div>
                    <button className="btn btn-secondary" onClick={handleLogout}>Sign Out</button>
                </div>

                {loading ? (
                    <div className="loading"><div className="spinner" /></div>
                ) : requests.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🍿</div>
                        <h3>No requests yet</h3>
                        <p>Go search for a movie or TV show to request it!</p>
                    </div>
                ) : (
                    <div className="requests-table-wrapper" style={{ marginTop: '24px' }}>
                        <table className="requests-table">
                            <thead>
                                <tr>
                                    <th>Media</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Requested</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map(req => (
                                    <tr
                                        key={req.id}
                                        className={req.tmdb_id ? 'row-clickable' : ''}
                                        onClick={() => openDetail(req)}
                                        onKeyDown={(e) => e.key === 'Enter' && openDetail(req)}
                                        tabIndex={req.tmdb_id ? 0 : undefined}
                                        title={req.tmdb_id ? 'View details' : undefined}
                                    >
                                        <td data-label="Media">
                                            <div className="request-row-media">
                                                {req.poster_path ? (
                                                    <img
                                                        src={`${IMG_BASE}/w92${req.poster_path}`}
                                                        alt={req.title}
                                                        className="request-row-poster"
                                                    />
                                                ) : (
                                                    <div className="request-row-poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🎬</div>
                                                )}
                                                <div>
                                                    <div className="request-row-title">{req.title}</div>
                                                    <div className="request-row-year">{req.year}</div>
                                                    {req.overview && (
                                                        <div className="request-row-overview">{req.overview}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td data-label="Type">
                                            <span className={`badge badge-${req.media_type}`}>
                                                {req.media_type === 'movie' ? 'Movie' : 'TV'}
                                            </span>
                                        </td>
                                        <td data-label="Status">
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                                                <span className={`badge badge-${req.status}`}>
                                                    {req.status}
                                                </span>
                                                {req.status === 'pending' && (
                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                                                        {confirmCancelId === req.id ? (
                                                            <>
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>Sure?</span>
                                                                <button className="btn btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => confirmAndCancel(req.id)}>Yes</button>
                                                                <button className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => setConfirmCancelId(null)}>No</button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                className="btn btn-danger btn-sm"
                                                                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                                                                onClick={() => setConfirmCancelId(req.id)}
                                                                disabled={cancellingId === req.id}
                                                            >
                                                                {cancellingId === req.id ? 'Cancelling...' : 'Cancel'}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td data-label="Requested" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {new Date(req.requested_at).toLocaleDateString('en-GB', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                            })}
                                        </td>
                                        <td data-label="Details">
                                            {req.tmdb_id && <span className="request-row-hint">View details ›</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
