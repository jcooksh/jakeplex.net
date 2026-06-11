import { useState, useEffect } from 'react';
import SearchBar from '../components/SearchBar';
import { CircularGallery } from '../components/ui/circular-gallery';

const IMG_BASE = 'https://image.tmdb.org/t/p';

const ALL_POSTER_PATHS = [
    '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', '/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
    '/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg', '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    '/lgkBAqBFdbCnlVLFNBcGpSHPsaQ.jpg', '/49WJfeN0moxb9IPfGn8AIqMGskD.jpg',
    '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', '/d5NXSklpcuveU44vs7O8gQ7UZHG.jpg',
    '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', '/74xTEgt7R36Fpocon6hy0bRmEdQ.jpg',
    '/9PFonBhy4cQy7Jz20NpMygczOkv.jpg', '/e2X8x1NKFDg6YsNNFJDg46Xb6XO.jpg',
    '/b3mdmjYTEL70j7nuXATUAD9qgu4.jpg', '/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg',
    '/62HCnUTziyWcpDaBO2i1DX17ljH.jpg', '/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg',
];

const POSTER_POSITIONS = [
    { x: 8,  y: 20, rot: '-8deg',  delay: 0 },
    { x: 88, y: 15, rot: '6deg',   delay: 1.5 },
    { x: 5,  y: 70, rot: '5deg',   delay: 3 },
    { x: 92, y: 65, rot: '-5deg',  delay: 2 },
    { x: 15, y: 45, rot: '10deg',  delay: 4 },
    { x: 82, y: 42, rot: '-9deg',  delay: 2.5 },
    { x: 50, y: 88, rot: '3deg',   delay: 1 },
    { x: 30, y: 82, rot: '-6deg',  delay: 3.5 },
];

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const shuffled = shuffle(ALL_POSTER_PATHS);
const HERO_POSTERS = POSTER_POSITIONS.map((pos, i) => ({ ...pos, p: shuffled[i] }));

export default function Home() {
    const [galleryItems, setGalleryItems] = useState([]);

    useEffect(() => {
        fetch('/api/plex/recent-unrequested')
            .then(r => r.json())
            .then(data => {
                const items = (data.items || [])
                    .filter(i => i.poster_path)
                    .map(i => ({
                        title: i.title,
                        year: i.year || '',
                        genre: i.type === 'show' ? 'TV Show' : 'Movie',
                        poster: `/api/plex/image?path=${encodeURIComponent(i.poster_path)}`,
                    }));
                setGalleryItems(items);
            })
            .catch(() => {});
    }, []);

    return (
        <div className="page home-page">
            <div className="hero">

                <div className="hero-posters">
                    {HERO_POSTERS.map((hp, i) => (
                        <div key={i}>
                            <img
                                className="hero-poster-img"
                                src={`${IMG_BASE}/w185${hp.p}`}
                                alt=""
                                aria-hidden="true"
                                style={{
                                    '--rot': hp.rot,
                                    left: hp.x + '%',
                                    top: hp.y + '%',
                                    animationDelay: `${hp.delay}s`,
                                    animationDuration: `${11 + i * 1.3}s`,
                                }}
                                loading="lazy"
                            />
                            <img
                                className="hero-poster-glitch"
                                src={`${IMG_BASE}/w185${hp.p}`}
                                alt=""
                                aria-hidden="true"
                                style={{
                                    '--rot': hp.rot,
                                    left: hp.x + '%',
                                    top: hp.y + '%',
                                    animationDelay: `${hp.delay + 0.05}s`,
                                    animationDuration: `${11 + i * 1.3}s`,
                                }}
                                loading="lazy"
                            />
                        </div>
                    ))}
                </div>

                <div className="hero-content">
                    <div className="hero-eyebrow">Your Personal Streaming Universe</div>

                    <div className="hero-title-wrap">
                        <h1 className="hero-title">JakePlex</h1>
                        <div className="hero-title-glow" aria-hidden="true">JakePlex</div>
                        <div className="hero-title-glitch g1" aria-hidden="true">JakePlex</div>
                        <div className="hero-title-glitch g2" aria-hidden="true">JakePlex</div>
                        <div className="hero-title-glitch-h hg1" aria-hidden="true">JakePlex</div>
                        <div className="hero-title-glitch-h hg2" aria-hidden="true">JakePlex</div>
                    </div>

                    <SearchBar autoFocus />

                    {galleryItems.length >= 3 && (
                        <div style={{ width: '100%', height: '220px', position: 'relative', marginTop: '32px' }}>
                            <CircularGallery items={galleryItems} radius={280} autoRotateSpeed={0.03} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
