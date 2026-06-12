import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import MediaCard from '../components/MediaCard';
import { cachedJson } from '../lib/apiCache';

export default function SearchResults() {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (!query) return;

        const fetchResults = async () => {
            setLoading(true);
            setErrorMsg('');
            try {
                const [data, plexData] = await Promise.all([
                    fetch(`/api/tmdb/search?q=${encodeURIComponent(query)}`).then(r => r.json()),
                    cachedJson('/api/plex/library'),
                ]);

                if (data.error === 'TMDB_API_KEY_MISSING') {
                    setErrorMsg('TMDB_API_KEY_MISSING');
                    setResults([]);
                } else {
                    const rawResults = data.results || [];
                    const plexItems = plexData.items || [];

                    // Mark results that are already on Plex
                    const finalResults = rawResults.map(item => {
                        const title = item.title || item.name || '';
                        const year = (item.release_date || item.first_air_date || '').slice(0, 4);
                        const mediaType = item.media_type;

                        let isOnPlex = false;
                        for (const p of plexItems) {
                            if (p.type === mediaType && p.title.toLowerCase() === title.toLowerCase()) {
                                if (year && p.year) {
                                    if (Math.abs(parseInt(p.year) - parseInt(year)) <= 1) {
                                        isOnPlex = true;
                                        break;
                                    }
                                } else {
                                    isOnPlex = true;
                                    break;
                                }
                            }
                        }
                        return { ...item, _isOnPlex: isOnPlex };
                    });

                    setResults(finalResults);
                }
            } catch (err) {
                console.error('Search error:', err);
                setErrorMsg('Search failed');
                setResults([]);
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [query]);

    return (
        <div className="page">
            <div className="container">
                <div style={{ paddingTop: '24px' }}>
                    <SearchBar initialQuery={query} />
                </div>

                <div className="results-header">
                    <h2>
                        Results for &ldquo;{query}&rdquo;{' '}
                        {!loading && <span>({results.length} found)</span>}
                    </h2>
                </div>

                {loading ? (
                    <div className="loading">
                        <div className="spinner" />
                    </div>
                ) : errorMsg === 'TMDB_API_KEY_MISSING' ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">⚠️</div>
                        <h3>Missing TMDB API Key</h3>
                        <p>To enable search, you need to add your free TMDB API key to the project's .env file and restart the backend server.</p>
                    </div>
                ) : results.length > 0 ? (
                    <div className="results-grid">
                        {results.map((item, i) => (
                            <MediaCard key={`${item.media_type}-${item.id}`} item={item} index={i} />
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">🔍</div>
                        <h3>No results found</h3>
                        <p>Try a different search term</p>
                    </div>
                )}
            </div>
        </div>
    );
}
