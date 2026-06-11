import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './components/Navbar'
import Toast from './components/Toast'
import { FallingPattern } from './components/ui/FallingPattern'
import Home from './pages/Home'
import SearchResults from './pages/SearchResults'
import MediaDetail from './pages/MediaDetail'
import Library from './pages/Library'
import Instructions from './pages/Instructions'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import MyRequests from './pages/MyRequests'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider } from './context/AuthContext'

const NO_SCROLL_ROUTES = ['/', '/admin', '/instructions'];

// Freeze all decorative CSS animations while the window is unfocused —
// invisible to the user, but drops idle GPU/CPU draw to near zero.
function FocusPause() {
  useEffect(() => {
    const onBlur = () => document.body.classList.add('app-paused');
    const onFocus = () => document.body.classList.remove('app-paused');
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.body.classList.remove('app-paused');
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
        <FocusPause />
        <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
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
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Routes>
        </div>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
