import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { supabase, uploadAvatar } from '../lib/supabase';
import { getEloTier } from '../lib/elo';
import { ACHIEVEMENTS } from '../lib/achievements';
import { COUNTRIES, getFlagEmoji } from '../data/countries';
import { useAuth } from '../hooks/useAuth';
import Avatar from '../components/Avatar';
import type { Profile as ProfileType, Achievement, Match, SetScore, PlayerOfTheWeek } from '../types';

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [isPotw, setIsPotw] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [nationality, setNationality] = useState('');
  const [fullName, setFullName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = user?.id === id;

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);

      const [{ data: p }, { data: achs }, { data: allMatches }, { data: potw }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('achievements').select('*').eq('profile_id', id),
        supabase
          .from('matches')
          .select('*, player1:profiles!matches_player1_id_fkey(*), player2:profiles!matches_player2_id_fkey(*)')
          .or(`player1_id.eq.${id},player2_id.eq.${id}`)
          .order('played_at', { ascending: false }),
        supabase
          .from('player_of_the_week')
          .select('*')
          .order('week_start', { ascending: false })
          .limit(1)
          .single(),
      ]);

      // Calculate accurate wins/losses from match records (more reliable than stored columns)
      const allM = (allMatches as Match[]) ?? [];
      const wins   = allM.filter(m => (m.player1_id === id && m.winner_side === 1) || (m.player2_id === id && m.winner_side === 2)).length;
      const losses = allM.filter(m => (m.player1_id === id && m.winner_side === 2) || (m.player2_id === id && m.winner_side === 1)).length;

      setProfile(p ? { ...p, wins, losses } : p);
      setAchievements(achs ?? []);
      setRecentMatches(allM.slice(0, 10));
      setIsPotw(potw?.profile_id === id);
      setNationality(p?.nationality ?? '');
      setFullName(p?.full_name ?? '');
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    toast.loading('Uploading photo... 📸');
    const url = await uploadAvatar(user.id, file);
    if (url) {
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
      setProfile((p) => p ? { ...p, avatar_url: url } : p);
      await refreshProfile();
      toast.dismiss();
      toast.success('Photo updated! 🎉');
    } else {
      toast.dismiss();
      toast.error('Upload failed 😢');
    }
  }

  async function handleSaveProfile() {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({
      nationality,
      full_name: fullName,
    }).eq('id', user.id);

    if (error) {
      toast.error('Failed to save 😢');
    } else {
      setProfile((p) => p ? { ...p, nationality, full_name: fullName } : p);
      await refreshProfile();
      toast.success('Profile saved! ✅');
      setEditing(false);
    }
  }

  if (loading || !profile) {
    return (
      <div className="loading-screen">
        <div className="loading-emoji">🎾</div>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  const tier = getEloTier(profile.elo);
  const winRate = profile.wins + profile.losses > 0
    ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
    : 0;

  const unlockedKeys = new Set(achievements.map((a) => a.achievement_key));

  return (
    <div className="page">
      <div className="container">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ textAlign: 'center', marginBottom: 24, position: 'relative', overflow: 'visible' }}
        >
          {isPotw && (
            <div style={{
              position: 'absolute',
              top: -12,
              right: 16,
              background: 'linear-gradient(135deg, #FFD700, #E9C46A)',
              color: '#1B4332',
              padding: '4px 12px',
              borderRadius: 20,
              fontWeight: 800,
              fontSize: '0.8rem',
            }}>
              👑 Player of the Week
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative', cursor: isOwner ? 'pointer' : 'default' }} onClick={() => isOwner && fileInputRef.current?.click()}>
              <Avatar profile={profile} size="xl" showCrown={isPotw} />
              {isOwner && (
                <div style={{
                  position: 'absolute',
                  bottom: 4,
                  left: 4,
                  background: 'var(--accent)',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem',
                  border: '2px solid var(--bg-card)',
                }}>
                  📷
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
              />
            </div>

            {editing ? (
              <div style={{ width: '100%', maxWidth: 300 }}>
                <div className="input-group">
                  <label>📛 Full Name</label>
                  <input
                    className="input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="input-group">
                  <label>🏳️ Nationality</label>
                  <select
                    className="input"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                  >
                    <option value="">Select country...</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={handleSaveProfile}>✅ Save</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {profile.full_name || profile.username}
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>@{profile.username}</p>
                </div>
                {isOwner && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
                    ✏️ Edit Profile
                  </button>
                )}
              </>
            )}
          </div>

          {/* Elo Badge */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            style={{
              marginTop: 16,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: `rgba(${tier.color === '#FFD700' ? '255,215,0' : '82,183,136'}, 0.1)`,
              border: `2px solid ${tier.color}`,
              borderRadius: 'var(--border-radius-xl)',
              padding: '8px 20px',
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>{tier.emoji}</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.6rem', color: tier.color, lineHeight: 1 }}>
                {profile.elo}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tier.name}</div>
            </div>
          </motion.div>
        </motion.div>

        {/* Stats Grid */}
        <div className="stat-grid">
          <motion.div className="stat-box" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="stat-value">{profile.wins}</div>
            <div className="stat-label">🏆 Wins</div>
          </motion.div>
          <motion.div className="stat-box" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="stat-value">{profile.losses}</div>
            <div className="stat-label">💔 Losses</div>
          </motion.div>
          <motion.div className="stat-box" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="stat-value">{winRate}%</div>
            <div className="stat-label">📊 Win Rate</div>
          </motion.div>
          <motion.div className="stat-box" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className="stat-value">{profile.wins + profile.losses}</div>
            <div className="stat-label">🎾 Matches</div>
          </motion.div>
        </div>

        {/* Achievements */}
        <h2 className="page-title" style={{ fontSize: '1.3rem', marginTop: 8 }}>🏅 Achievements</h2>
        <div className="achievement-grid" style={{ marginBottom: 24 }}>
          {ACHIEVEMENTS.map((ach, i) => {
            const unlocked = unlockedKeys.has(ach.key);
            return (
              <motion.div
                key={ach.key}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className={`achievement-card ${unlocked ? 'unlocked' : 'locked'}`}
              >
                <div className="achievement-emoji">{ach.emoji}</div>
                <div className="achievement-name">{ach.name}</div>
                <div className="achievement-desc">{ach.description}</div>
              </motion.div>
            );
          })}
        </div>

        {/* Recent Matches */}
        <h2 className="page-title" style={{ fontSize: '1.3rem' }}>📋 Recent Matches</h2>
        {recentMatches.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🎾</div>
            <p>No matches yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentMatches.map((match) => {
              const p1 = match.player1 as ProfileType;
              const p2 = match.player2 as ProfileType;
              if (!p1 || !p2) return null;

              const isP1 = match.player1_id === id;
              const won = (isP1 && match.winner_side === 1) || (!isP1 && match.winner_side === 2);
              const opponent = isP1 ? p2 : p1;
              const eloChange = isP1
                ? (match.player1_elo_after ?? 0) - (match.player1_elo_before ?? 0)
                : (match.player2_elo_after ?? 0) - (match.player2_elo_before ?? 0);

              return (
                <div key={match.id} className="card" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: '1.2rem' }}>{won ? '✅' : '❌'}</span>
                    <Avatar profile={opponent} size="sm" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        vs {opponent.username}
                        {opponent.nationality && ` ${getFlagEmoji(opponent.nationality)}`}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(match.played_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="score-sets">
                      {(match.score as SetScore[]).map((set, i) => (
                        <div key={i} className="score-set">
                          <span className={match.winner_side === 1 ? 'winner-score' : 'loser-score'}>{set.p1}</span>
                          <span style={{ color: 'var(--text-muted)', margin: '0 1px' }}>-</span>
                          <span className={match.winner_side === 2 ? 'winner-score' : 'loser-score'}>{set.p2}</span>
                        </div>
                      ))}
                    </div>
                    <span className={`elo-change ${eloChange >= 0 ? 'positive' : 'negative'}`}>
                      {eloChange >= 0 ? '+' : ''}{eloChange}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
