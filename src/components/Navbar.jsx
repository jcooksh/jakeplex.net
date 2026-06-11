import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { plexUser, loginWithPlex, loginWithCustom } = useAuth();
    const { addToast } = useToast();
    const [menuOpen, setMenuOpen] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [modalView, setModalView] = useState('options');
    const [customUsername, setCustomUsername] = useState('');
    const [customPassword, setCustomPassword] = useState('');
    const [customLoading, setCustomLoading] = useState(false);
    const [customError, setCustomError] = useState('');

    // Close menu on route change
    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    // Prevent body scroll when menu or modal is open
    useEffect(() => {
        document.body.style.overflow = (menuOpen || showLoginModal) ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [menuOpen, showLoginModal]);

    const handlePlexLogin = async () => {
        try {
            await loginWithPlex();
            setShowLoginModal(false);
            setMenuOpen(false);
            addToast('Successfully signed in to Plex!', 'success');
        } catch (err) {
            addToast('Failed to sign in with Plex', 'error');
        }
    };

    const handleAdminLogin = () => {
        setShowLoginModal(false);
        setMenuOpen(false);
        navigate('/admin');
    };

    const openLoginModal = () => {
        setModalView('options');
        setCustomUsername('');
        setCustomPassword('');
        setCustomError('');
        setShowLoginModal(true);
    };

    const handleCustomLogin = async (e) => {
        e.preventDefault();
        setCustomError('');
        setCustomLoading(true);
        try {
            await loginWithCustom(customUsername, customPassword);
            setShowLoginModal(false);
            setMenuOpen(false);
            addToast(`Welcome, ${customUsername}!`, 'success');
        } catch (err) {
            setCustomError(err.message || 'Login failed');
        } finally {
            setCustomLoading(false);
        }
    };

    return (
        <nav className="navbar">
            {/* Bottom gradient glow. Real element (not ::after) because its
                sliding ::before needs an overflow:hidden clipper, and putting
                overflow:hidden on .navbar would clip the .mobile-nav drawer. */}
            <div className="navbar-glow" aria-hidden="true" />
            <Link to="/" className="navbar-brand">
                <span className="navbar-brand-icon">🎬</span>
                JakePlex
                <div className="navbar-brand-glitch bg1" aria-hidden="true"><span>🎬</span>JakePlex</div>
                <div className="navbar-brand-glitch bg2" aria-hidden="true"><span>🎬</span>JakePlex</div>
            </Link>

            {/* Hamburger button — visible only on mobile via CSS */}
            <button
                className={`hamburger ${menuOpen ? 'open' : ''}`}
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle menu"
            >
                <span />
                <span />
                <span />
            </button>

            {/* Desktop links (hidden on mobile via CSS) */}
            <div className="navbar-links navbar-links-desktop">
                <Link to="/" className={`navbar-link ${location.pathname === '/' ? 'active' : ''}`}>Home</Link>
                <Link to="/library" className={`navbar-link ${location.pathname === '/library' ? 'active' : ''}`}>On Plex</Link>
                <Link to="/instructions" className={`navbar-link ${location.pathname === '/instructions' ? 'active' : ''}`}>Instructions</Link>
                {plexUser ? (
                    <Link to="/requests" className={`navbar-link ${location.pathname === '/requests' ? 'active' : ''}`}>My Requests</Link>
                ) : (
                    <button className="navbar-link" onClick={openLoginModal}>
                        Sign in
                    </button>
                )}
            </div>

            {/* Mobile overlay (portaled: the navbar's backdrop-filter makes it
                the containing block for fixed descendants, which would shrink
                this full-screen overlay to the navbar strip) + drawer */}
            {menuOpen && createPortal(
                <div className="mobile-nav-overlay" onClick={() => setMenuOpen(false)} />,
                document.body
            )}
            <div className={`mobile-nav ${menuOpen ? 'open' : ''}`}>
                <Link to="/" className={`mobile-nav-link ${location.pathname === '/' ? 'active' : ''}`}>Home</Link>
                <Link to="/library" className={`mobile-nav-link ${location.pathname === '/library' ? 'active' : ''}`}>On Plex</Link>
                <Link to="/instructions" className={`mobile-nav-link ${location.pathname === '/instructions' ? 'active' : ''}`}>Instructions</Link>
                {plexUser ? (
                    <Link to="/requests" className={`mobile-nav-link ${location.pathname === '/requests' ? 'active' : ''}`}>My Requests</Link>
                ) : (
                    <button className="mobile-nav-link" style={{ textAlign: 'left', width: '100%' }} onClick={openLoginModal}>
                        Sign in
                    </button>
                )}
            </div>

            {/* Login Modal */}
            {showLoginModal && typeof document !== 'undefined' && createPortal(
                <>
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, backdropFilter: 'blur(5px)' }} onClick={() => setShowLoginModal(false)} />
                    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(4,6,15,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-xl)', padding: '36px', zIndex: 1101, width: '90%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center', boxShadow: '0 20px 80px rgba(0,0,0,0.8),0 0 40px rgba(139,92,246,0.15)' }}>
                        {modalView === 'options' ? (
                            <>
                                <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>Sign In</h2>
                                <button style={{ background: '#e5a00d', color: '#000', border: 'none', padding: '13px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.95rem' }} onClick={handlePlexLogin}>
                                    Sign in with Plex 🟡
                                </button>
                                <button style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--text-primary)', border: '1px solid rgba(139,92,246,0.4)', padding: '13px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.95rem' }} onClick={() => setModalView('custom')}>
                                    Custom Login
                                </button>
                                <button className="btn btn-secondary" onPointerDown={handleAdminLogin} onClick={handleAdminLogin}>
                                    Admin Login
                                </button>
                                <button style={{ marginTop: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem' }} onClick={() => setShowLoginModal(false)}>
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <>
                                <button style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }} onClick={() => setModalView('options')}>
                                    ← Back
                                </button>
                                <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-heading)', marginBottom: '4px' }}>Custom Login</h2>
                                {customError && <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', padding: '10px', color: '#f87171', fontSize: '0.9rem' }}>{customError}</div>}
                                <form onSubmit={handleCustomLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Username</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={customUsername}
                                            onChange={e => setCustomUsername(e.target.value)}
                                            placeholder="Enter username"
                                            autoFocus
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Password</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            value={customPassword}
                                            onChange={e => setCustomPassword(e.target.value)}
                                            placeholder="Enter password"
                                            required
                                        />
                                    </div>
                                    <button type="submit" className="btn btn-primary" disabled={customLoading} style={{ marginTop: '4px' }}>
                                        {customLoading ? 'Signing in...' : 'Sign In'}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </>,
                document.body
            )}
        </nav>
    );
}
