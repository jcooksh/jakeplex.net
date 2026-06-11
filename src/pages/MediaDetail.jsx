import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import SeasonCard from '../components/SeasonCard';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const IMG_BASE = 'https://image.tmdb.org/t/p';

export default function MediaDetail({ type }) {
    const { id } = useParams();
    const { addToast } = useToast();
    const { plexUser, loginWithPlex } = useAuth();
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [requested, setRequested] = useState(false);
    const [requesting, setRequesting] = useState(false);
    const [onPlex, setOnPlex] = useState(false);

    useEffect(() => {
        const fetchDetail = async () => {
            setLoading(true);
            try {
                // Fetch detail first to get title and year for Plex
                const detailRes = await fetch(`/api/tmdb/${type}/${id}`);
                const detailData = await detailRes.json();

                const title = detailData.title || detailData.name;
                const year = (detailData.release_date || detailData.first_air_date || '').slice(0, 4);

                const [checkRes, plexRes] = await Promise.all([
                    fetch(`/api/requests/check/${id}/${type}`),
                    fetch(`/api/plex/check?title=${encodeURIComponent(title)}&year=${year}`)
                ]);

                const checkData = await checkRes.json();
                const plexData = await plexRes.json();

                setDetail(detailData);
                setRequested(checkData.requested);
                setOnPlex(plexData.available);
            } catch (err) {
                console.error('Detail fetch error:', err);
                addToast('Failed to load details', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [id, type]);

    const handleRequestClick = async () => {
        if (requesting || requested || onPlex) return;

        if (!plexUser) {
            try {
                await loginWithPlex();
                // We don't automatically request right after login, 
                // the UI will update and the user can click the button again.
                addToast('Successfully signed in to Plex!', 'success');
            } catch (err) {
                addToast('Failed to sign in with Plex', 'error');
            }
            return;
        }

        handleSubmitRequest();
    };

    const handleSubmitRequest = async () => {
        setRequesting(true);

        try {
            const title = detail.title || detail.name;
            const year = (detail.release_date || detail.first_air_date || '').slice(0, 4);

            const deviceInfo = {
                userAgent: navigator.userAgent,
                language: navigator.language,
                screenWidth: window.screen.width,
                screenHeight: window.screen.height,
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                deviceMemory: navigator.deviceMemory || null,
                hardwareConcurrency: navigator.hardwareConcurrency || null,
                connectionType: navigator.connection ? navigator.connection.effectiveType : null
            };

            const res = await fetch('/api/requests', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${plexUser.token}`
                },
                body: JSON.stringify({
                    tmdb_id: detail.id,
                    media_type: type,
                    title,
                    poster_path: detail.poster_path,
                    backdrop_path: detail.backdrop_path,
                    overview: detail.overview,
                    year,
                    device_info: deviceInfo,
                }),
            });

            if (res.ok) {
                setRequested(true);
                addToast(`"${title}" has been requested!`, 'success');
            } else if (res.status === 409) {
                setRequested(true);
                addToast('This has already been requested', 'info');
            } else {
                addToast('Failed to submit request', 'error');
            }
        } catch (err) {
            addToast('Something went wrong', 'error');
        } finally {
            setRequesting(false);
        }
    };

    if (loading) {
        return (
            <div className="page">
                <div className="loading" style={{ minHeight: '60vh' }}>
                    <div className="spinner" />
                </div>
            </div>
        );
    }

    if (!detail) return null;

    const title = detail.title || detail.name;
    const year = (detail.release_date || detail.first_air_date || '').slice(0, 4);
    const rating = detail.vote_average?.toFixed(1);

    return (
        <div className="page">
            {/* Backdrop */}
            {detail.backdrop_path && (
                <div className="detail-backdrop">
                    <img
                        src={`${IMG_BASE}/w1280${detail.backdrop_path}`}
                        alt=""
                        aria-hidden="true"
                    />
                </div>
            )}

            <div className="container">
                <div className="detail-content">
                    <div className="detail-main">
                        {/* Poster */}
                        <div className="detail-poster">
                            {detail.poster_path ? (
                                <img
                                    src={`${IMG_BASE}/w500${detail.poster_path}`}
                                    alt={title}
                                />
                            ) : (
                                <div style={{
                                    aspectRatio: '2/3',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'var(--bg-secondary)',
                                    fontSize: '4rem',
                                }}>
                                    🎬
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="detail-info">
                            <h1 className="detail-title">{title}</h1>

                            <div className="detail-meta">
                                {year && <span>{year}</span>}
                                <span>•</span>
                                <span className={`badge badge-${type}`}>
                                    {type === 'movie' ? 'Movie' : 'TV Show'}
                                </span>
                                {rating && rating !== '0.0' && (
                                    <>
                                        <span>•</span>
                                        <span className="detail-rating">⭐ {rating}</span>
                                    </>
                                )}
                                {detail.runtime && (
                                    <>
                                        <span>•</span>
                                        <span>{detail.runtime} min</span>
                                    </>
                                )}
                                {detail.number_of_seasons && (
                                    <>
                                        <span>•</span>
                                        <span>
                                            {detail.number_of_seasons} season{detail.number_of_seasons !== 1 ? 's' : ''}
                                        </span>
                                    </>
                                )}
                            </div>

                            {detail.genres && detail.genres.length > 0 && (
                                <div className="detail-genres">
                                    {detail.genres.map((g) => (
                                        <span key={g.id} className="detail-genre-tag">
                                            {g.name}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {detail.overview && (
                                <p className="detail-overview">{detail.overview}</p>
                            )}

                            <div className="detail-actions">
                                <button
                                    className={`request-btn ${onPlex || requested ? 'requested' : ''}`}
                                    onClick={handleRequestClick}
                                    disabled={onPlex || requesting || requested}
                                >
                                    {onPlex
                                        ? '✓ Already on Plex'
                                        : requesting
                                            ? 'Submitting...'
                                            : requested
                                                ? '✓ Requested'
                                                : !plexUser
                                                    ? 'Sign in with Plex to Request'
                                                    : '📥 Request This'}
                                </button>
                                {plexUser && !onPlex && !requested && (
                                    <div style={{ marginLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {plexUser.thumb ? (
                                            <img src={plexUser.thumb} alt={plexUser.username} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                                        ) : (
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                                {plexUser.username.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                            Logged in as <strong>{plexUser.username}</strong>
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Seasons (TV shows) */}
                    {type === 'tv' && detail.seasons && detail.seasons.length > 0 && (
                        <div className="seasons-section">
                            <h2>Seasons</h2>
                            <div className="seasons-grid">
                                {detail.seasons.map((season) => (
                                    <SeasonCard key={season.id} season={season} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
