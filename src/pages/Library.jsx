import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Library() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const navigate = useNavigate();

    // Plex items carry no TMDB id — resolve via TMDB search (title + type + year)
    // so the card opens the same detail page as a search result.
    const handleItemClick = async (item) => {
        const tmdbType = item.type === 'show' ? 'tv' : 'movie';
        const fallback = () => navigate(`/search?q=${encodeURIComponent(item.title)}`);
        try {
            const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(item.title)}`);
            const data = await res.json();
            const results = (data.results || []).filter(r => r.media_type === tmdbType);

            const titleMatches = (r) => {
                const rTitle = (r.title || r.name || '').toLowerCase();
                const iTitle = (item.title || '').toLowerCase();
                return rTitle.includes(iTitle) || iTitle.includes(rTitle);
            };
            const yearMatches = (r) => {
                const rYear = parseInt((r.release_date || r.first_air_date || '').slice(0, 4));
                return item.year && rYear ? Math.abs(rYear - parseInt(item.year)) <= 1 : false;
            };

            const bestMatch =
                results.find(r => titleMatches(r) && yearMatches(r)) ||
                results.find(titleMatches) ||
                results[0];

            if (bestMatch) {
                navigate(`/${bestMatch.media_type}/${bestMatch.id}`);
            } else {
                fallback();
            }
        } catch {
            fallback();
        }
    };

    useEffect(() => {
        const fetchLibrary = async () => {
            try {
                const res = await fetch('/api/plex/library');
                const data = await res.json();

                if (data.error) {
                    setError(data.error);
                } else {
                    setItems(data.items || []);
                }
            } catch (err) {
                console.error('Failed to fetch library:', err);
                setError('Failed to load library');
            } finally {
                setLoading(false);
            }
        };

        fetchLibrary();
    }, []);

    if (loading) {
        return (
            <div className="page">
                <div className="loading" style={{ minHeight: '60vh' }}>
                    <div className="spinner" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page">
                <div className="container" style={{ paddingTop: '24px' }}>
                    <div className="empty-state">
                        <div className="empty-state-icon">⚠️</div>
                        <h3>Library Error</h3>
                        <p>{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    const filteredItems = items.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = typeFilter === 'all' || item.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const movieCount = items.filter(i => i.type === 'movie').length;
    const showCount = items.filter(i => i.type === 'show').length;

    return (
        <div className="page">
            <div className="container" style={{ paddingTop: '24px' }}>
                <div className="library-search" style={{ marginBottom: '32px' }}>
                    <div className="search-bar">
                        <span className="search-bar-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Filter your library..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    <button
                        className={`btn btn-sm ${typeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setTypeFilter('all')}
                    >
                        All ({items.length})
                    </button>
                    <button
                        className={`btn btn-sm ${typeFilter === 'movie' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setTypeFilter('movie')}
                    >
                        🎬 Movies ({movieCount})
                    </button>
                    <button
                        className={`btn btn-sm ${typeFilter === 'show' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setTypeFilter('show')}
                    >
                        📺 TV Shows ({showCount})
                    </button>
                </div>

                <div className="results-header">
                    <h2>
                        Already Installed
                        <span> ({filteredItems.length} items)</span>
                    </h2>
                </div>

                {filteredItems.length > 0 ? (
                    <div className="results-grid">
                        {filteredItems.map((item, i) => (
                            <div
                                key={item.id}
                                className="media-card"
                                style={{ animationDelay: `${i * 30}ms` }}
                                role="button"
                                tabIndex={0}
                                title="View details"
                                onClick={() => handleItemClick(item)}
                                onKeyDown={(e) => e.key === 'Enter' && handleItemClick(item)}
                            >
                                {item.poster_path ? (
                                    <img
                                        className="media-card-poster"
                                        src={`/api/plex/image?path=${encodeURIComponent(item.poster_path)}`}
                                        alt={item.title}
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="media-card-no-poster">🎬</div>
                                )}
                                <div className="media-card-overlay">
                                    <div className="media-card-title">{item.title}</div>
                                    <div className="media-card-meta">
                                        {item.year && <span>{item.year}</span>}
                                        <span className={`badge badge-${item.type}`}>
                                            {item.type === 'movie' ? 'Movie' : 'TV'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">📭</div>
                        <h3>Library is empty</h3>
                        <p>No titles found on your Plex server.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
