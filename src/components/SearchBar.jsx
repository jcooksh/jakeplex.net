import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const PLACEHOLDERS = [
    'Search for a movie or show…',
    'Try "Oppenheimer"…',
    'What are you in the mood for?',
    'Find something to watch tonight…',
    'Type a title or vibe…',
];

export default function SearchBar({ initialQuery = '', autoFocus = false }) {
    const [query, setQuery] = useState(initialQuery);
    const [phIdx, setPhIdx] = useState(0);
    const [phVisible, setPhVisible] = useState(true);
    const navigate = useNavigate();
    const inputRef = useRef();

    useEffect(() => {
        if (autoFocus && inputRef.current) inputRef.current.focus();
    }, [autoFocus]);

    useEffect(() => {
        const t = setInterval(() => {
            setPhVisible(false);
            setTimeout(() => {
                setPhIdx(i => (i + 1) % PLACEHOLDERS.length);
                setPhVisible(true);
            }, 400);
        }, 3500);
        return () => clearInterval(t);
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    };

    return (
        <form onSubmit={handleSubmit} className="search-bar-wrapper">
            <div className="search-halo" aria-hidden="true" />
            <div className="search-bar">
                <span className="search-bar-icon">🔍</span>
                <input
                    ref={inputRef}
                    type="search"
                    placeholder={PLACEHOLDERS[phIdx]}
                    style={{ transition: 'opacity 0.3s', opacity: phVisible ? 1 : 0.4 }}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit" className="search-bar-btn">Search</button>
            </div>
        </form>
    );
}
