import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import Navbar from './components/Navbar'
import Toast from './components/Toast'
import { FallingPattern } from './components/ui/FallingPattern'
import Home from './pages/Home'
import SearchResults from './pages/SearchResults'
import MediaDetail from './pages/MediaDetail'
import Library from './pages/Library'
import Instructions from './pages/Instructions'
import MyRequests from './pages/MyRequests'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider } from './context/AuthContext'

// Admin pages are admin-only — keep them out of every visitor's bundle
const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))

const NO_SCROLL_ROUTES = ['/', '/admin', '/instructions'];

// Compositor calm — get the browser to TRUE idle whenever possible:
//  - window blur  -> body.app-paused freezes ALL animations (invisible to user;
//    the canvases also pause themselves on blur).
//  - no input for CALM_AFTER_MS while focused -> body.app-calm pauses the
//    decorative CSS loops (scoped selector list in index.css) and a 'jp:calm'
//    window event cancels every decorative rAF loop (starfield in index.html,
//    FallingPattern, CircularGallery). With no running animation and no
//    pending rAF, the compositor stops producing frames and power drops to ~0.
//  - any pointermove/pointerdown/keydown/wheel/touchstart/scroll (or refocus)
//    removes the class and fires 'jp:active' — resume is instantaneous:
//    paused CSS animations continue from their exact frame, rAF loops restart
//    on the next vsync.
// Why 30s: blur already covers "looking at another window", so calm only has
// to catch "window focused but untouched" (laptop left open on the page,
// reading something else on the same screen). Passive dwell on this UI —
// admiring the hero, reading a detail page — virtually never exceeds ~30s
// without a single pointer/scroll/key event, and a wrong guess costs nothing
// because resume is instant and lossless.
const CALM_AFTER_MS = 30000;

function CalmGovernor() {
  useEffect(() => {
    let timer = null;
    let lastArm = 0;

    const goCalm = () => {
      timer = null;
      document.body.classList.add('app-calm');
      window.dispatchEvent(new Event('jp:calm'));
    };
    const arm = () => {
      if (timer) clearTimeout(timer);
      lastArm = performance.now();
      timer = setTimeout(goCalm, CALM_AFTER_MS);
    };
    // Runs for every input event, so it must stay cheap: pointermove can fire
    // at 120Hz on ProMotion. Re-arm the timeout at most once per second — the
    // page may go calm up to 1s early, which is irrelevant on a 30s horizon.
    const wake = () => {
      if (document.body.classList.contains('app-calm')) {
        document.body.classList.remove('app-calm');
        window.dispatchEvent(new Event('jp:active'));
      }
      if (!timer || performance.now() - lastArm > 1000) arm();
    };

    const onBlur = () => {
      document.body.classList.add('app-paused');
      if (timer) { clearTimeout(timer); timer = null; } // app-paused already covers everything
    };
    const onFocus = () => {
      document.body.classList.remove('app-paused');
      wake(); // refocusing is a user gesture: leave calm + restart the idle clock
    };

    const INPUTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'];
    INPUTS.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    // capture phase: scroll events from inner scrollers don't bubble to window
    window.addEventListener('scroll', wake, { passive: true, capture: true });
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    arm();

    return () => {
      INPUTS.forEach((e) => window.removeEventListener(e, wake));
      window.removeEventListener('scroll', wake, { capture: true });
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      if (timer) clearTimeout(timer);
      document.body.classList.remove('app-paused');
      document.body.classList.remove('app-calm');
    };
  }, []);
  return null;
}

function NoScrollManager() {
  const location = useLocation();
  useEffect(() => {
    const noScroll = NO_SCROLL_ROUTES.includes(location.pathname);
    const val = noScroll ? 'hidden' : '';
    document.documentElement.style.overflow = val;
    document.body.style.overflow = val;
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [location.pathname]);
  return null;
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <NoScrollManager />
        <CalmGovernor />
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, contain: 'strict' }}>
          <FallingPattern style={{ height: '100vh' }} />
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
        <Navbar />
        <Toast />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/library" element={<Library />} />
<Route path="/instructions" element={<Instructions />} />
          <Route path="/requests" element={<MyRequests />} />
          <Route path="/movie/:id" element={<MediaDetail type="movie" />} />
          <Route path="/tv/:id" element={<MediaDetail type="tv" />} />
          <Route path="/admin" element={<Suspense fallback={<div className="page"><div className="loading" style={{ minHeight: '60vh' }}><div className="spinner" /></div></div>}><AdminLogin /></Suspense>} />
          <Route path="/admin/dashboard" element={<Suspense fallback={<div className="page"><div className="loading" style={{ minHeight: '60vh' }}><div className="spinner" /></div></div>}><AdminDashboard /></Suspense>} />
        </Routes>
        </div>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
