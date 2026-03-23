import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'framer-motion';
import Avatar from './Avatar';

const NAV_ITEMS = [
  { path: '/', label: 'Rankings', emoji: '🏆' },
  { path: '/matches', label: 'Matches', emoji: '🎾' },
  { path: '/add-match', label: 'New', emoji: '➕' },
  { path: '/h2h', label: 'H2H', emoji: '⚔️' },
];

export default function Navbar() {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  return (
    <>
      {/* Top bar */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-color)',
        boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 100,
      }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.5rem' }}>🎾</span>
          <span style={{
            fontWeight: 800,
            fontSize: '1.1rem',
            color: 'var(--text-primary)',
            letterSpacing: '-0.5px',
          }}>
            Tennis Ranker
          </span>
        </Link>

        {profile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to={`/profile/${profile.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar profile={profile} size="sm" />
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {profile.username}
              </span>
            </Link>
            <button onClick={signOut} className="btn btn-secondary btn-sm" style={{ padding: '6px 12px' }}>
              👋
            </button>
          </div>
        )}
      </nav>

      {/* Bottom tab bar (mobile-style) */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-color)',
        boxShadow: '0 -1px 8px rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 100,
        padding: '0 8px',
      }}>
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '8px 16px',
                borderRadius: 12,
                position: 'relative',
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'var(--accent-glow)',
                    borderRadius: 12,
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span style={{ fontSize: '1.3rem', position: 'relative', zIndex: 1 }}>{item.emoji}</span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 600,
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                position: 'relative',
                zIndex: 1,
              }}>
                {item.label}
              </span>
            </Link>
          );
        })}
        {profile && (
          <Link
            to={`/profile/${profile.id}`}
            style={{
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '8px 16px',
              borderRadius: 12,
              position: 'relative',
            }}
          >
            {location.pathname.startsWith('/profile') && (
              <motion.div
                layoutId="activeTab"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'var(--accent-glow)',
                  borderRadius: 12,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span style={{ fontSize: '1.3rem', position: 'relative', zIndex: 1 }}>👤</span>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 600,
              color: location.pathname.startsWith('/profile') ? 'var(--accent)' : 'var(--text-muted)',
              position: 'relative',
              zIndex: 1,
            }}>
              Profile
            </span>
          </Link>
        )}
      </div>
    </>
  );
}
