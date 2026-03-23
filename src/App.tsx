import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Navbar from './components/Navbar';
import StaticOverlay from './components/StaticOverlay';
import Auth from './pages/Auth';
import Leaderboard from './pages/Leaderboard';
import MatchHistory from './pages/MatchHistory';
import AddMatch from './pages/AddMatch';
import HeadToHead from './pages/HeadToHead';
import Profile from './pages/Profile';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-emoji">🎾</div>
        <div className="spinner spinner-lg" />
        <p style={{ color: 'var(--text-muted)' }}>Loading Tennis Ranker...</p>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Leaderboard />} />
        <Route path="/matches" element={<MatchHistory />} />
        <Route path="/add-match" element={<AddMatch />} />
        <Route path="/h2h" element={<HeadToHead />} />
        <Route path="/profile/:id" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1A3A1E',
              color: '#F0FFF0',
              border: '1px solid rgba(82, 183, 136, 0.3)',
              borderRadius: '12px',
              fontSize: '0.9rem',
            },
          }}
        />
        <StaticOverlay />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
