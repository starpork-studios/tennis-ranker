import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { getEloTier } from '../lib/elo';
import Avatar from '../components/Avatar';
import type { Profile, PlayerOfTheWeek, Match, SetScore } from '../types';

// ── Score display (inline) ─────────────────────────────
function ScoreDisplay({ score, winnerSide }: { score: SetScore[]; winnerSide: 1 | 2 }) {
  return (
    <div className="score-sets">
      {score.map((set, i) => (
        <div key={i} className="score-set">
          <span className={winnerSide === 1 ? 'winner-score' : 'loser-score'}>{set.p1}</span>
          <span style={{ color: 'var(--text-muted)', margin: '0 1px' }}>-</span>
          <span className={winnerSide === 2 ? 'winner-score' : 'loser-score'}>{set.p2}</span>
        </div>
      ))}
    </div>
  );
}

type Tab = 'weekly' | 'alltime';

interface WeeklyPlayer {
  profile: Profile;
  wins: number;
  losses: number;
  tiebreakerElo: number;
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon…
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

// ── Podium ────────────────────────────────────────────
function Podium({ players }: { players: WeeklyPlayer[] }) {
  const [first, second, third] = players;

  // Layout order: 2nd (left) · 1st (centre) · 3rd (right)
  const slots = [
    { player: second, rank: 2, medal: '🥈', color: '#C0C0C0', podiumH: 72,  avatarSize: 'lg' as const, delay: 0.25 },
    { player: first,  rank: 1, medal: '🥇', color: '#FFD700', podiumH: 104, avatarSize: 'xl' as const, delay: 0.0  },
    { player: third,  rank: 3, medal: '🥉', color: '#CD7F32', podiumH: 52,  avatarSize: 'lg' as const, delay: 0.45 },
  ];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 8,
      padding: '8px 8px 0',
      marginBottom: 32,
    }}>
      {slots.map(({ player, rank, medal, color, podiumH, avatarSize, delay }) => {
        if (!player) {
          return (
            <div key={rank} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '100%',
                height: podiumH,
                borderRadius: '8px 8px 0 0',
                background: 'rgba(255,255,255,0.04)',
                border: '2px dashed rgba(255,255,255,0.1)',
              }} />
            </div>
          );
        }

        return (
          <motion.div
            key={player.profile.id}
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, type: 'spring', stiffness: 200, damping: 18 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <Link
              to={`/profile/${player.profile.id}`}
              style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginBottom: 6 }}
            >
              <Avatar profile={player.profile} size={avatarSize} showCrown={rank === 1} />
              <div style={{
                textAlign: 'center',
                maxWidth: 100,
                color: '#ffffff',
                textShadow: '0 1px 3px rgba(0,0,0,0.4)',
              }}>
                <div style={{ fontWeight: 800, fontSize: '0.75rem', wordBreak: 'break-word', lineHeight: 1.3 }}>
                  {player.profile.full_name || player.profile.username}
                </div>
                {player.profile.full_name && (
                  <div style={{ fontSize: '0.65rem', opacity: 0.75, marginTop: 1 }}>
                    @{player.profile.username}
                  </div>
                )}
              </div>
              <div style={{ fontSize: '0.7rem', color, fontWeight: 700 }}>
                {player.wins}W · {player.losses}L
              </div>
            </Link>

            {/* Podium block */}
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: delay + 0.15, type: 'spring', stiffness: 220, damping: 20 }}
              style={{ transformOrigin: 'bottom', width: '100%' }}
            >
              <div style={{
                width: '100%',
                height: podiumH,
                background: `linear-gradient(180deg, ${color}30 0%, ${color}18 100%)`,
                border: `2px solid ${color}55`,
                borderBottom: 'none',
                borderRadius: '10px 10px 0 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}>
                <span style={{ fontSize: rank === 1 ? '1.8rem' : '1.3rem' }}>{medal}</span>
                <span style={{ fontWeight: 900, fontSize: '0.85rem', color, letterSpacing: '0.5px' }}>
                  #{rank}
                </span>
              </div>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Court line decoration below podium ───────────────
function CourtLine() {
  return (
    <div style={{
      height: 6,
      background: 'linear-gradient(90deg, transparent, #4ade80aa, #4ade80, #4ade80aa, transparent)',
      borderRadius: 4,
      marginBottom: 24,
      opacity: 0.5,
    }} />
  );
}

// ── Main component ────────────────────────────────────
export default function Leaderboard() {
  const [tab, setTab] = useState<Tab>('weekly');
  const [players, setPlayers] = useState<Profile[]>([]);
  const [potw, setPotw] = useState<PlayerOfTheWeek | null>(null);
  const [weeklyPlayers, setWeeklyPlayers] = useState<WeeklyPlayer[]>([]);
  const [weeklyMatches, setWeeklyMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const weekStart = getWeekStart();

      const [
        { data: profiles },
        { data: potwData },
        { data: weeklyMatches },
      ] = await Promise.all([
        supabase.from('profiles').select('*').order('elo', { ascending: false }),
        supabase
          .from('player_of_the_week')
          .select('*, profile:profiles(*)')
          .order('week_start', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('matches')
          .select('*, player1:profiles!matches_player1_id_fkey(*), player2:profiles!matches_player2_id_fkey(*)')
          .gte('played_at', weekStart),
      ]);

      setPlayers(profiles ?? []);
      setPotw(potwData);

      if (profiles) {
        // Aggregate weekly stats
        const statsMap: Record<string, { wins: number; losses: number; tiebreakerElo: number }> = {};

        (weeklyMatches as Match[] ?? []).forEach((m) => {
          const p1 = m.player1 as Profile;
          const p2 = m.player2 as Profile;
          if (!p1 || !p2) return;

          const winnerId = m.winner_side === 1 ? p1.id : p2.id;
          const loserId  = m.winner_side === 1 ? p2.id : p1.id;
          const winnerOppElo = m.winner_side === 1
            ? (m.player2_elo_before ?? p2.elo)
            : (m.player1_elo_before ?? p1.elo);

          if (!statsMap[winnerId]) statsMap[winnerId] = { wins: 0, losses: 0, tiebreakerElo: 0 };
          if (!statsMap[loserId])  statsMap[loserId]  = { wins: 0, losses: 0, tiebreakerElo: 0 };

          statsMap[winnerId].wins++;
          statsMap[winnerId].tiebreakerElo += winnerOppElo;
          statsMap[loserId].losses++;
        });

        // Build sorted weekly list — only players who played this week
        const weekly: WeeklyPlayer[] = Object.entries(statsMap).map(([id, stats]) => {
          const profile = (profiles as Profile[]).find((p) => p.id === id);
          if (!profile) return null;
          return { profile, ...stats };
        }).filter(Boolean) as WeeklyPlayer[];

        weekly.sort((a, b) => b.wins - a.wins || b.tiebreakerElo - a.tiebreakerElo);
        setWeeklyPlayers(weekly);

        const sorted = ((weeklyMatches as Match[]) ?? []).sort(
          (a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
        );
        setWeeklyMatches(sorted);
      }

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-emoji">🎾</div>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  const podiumPlayers = weeklyPlayers.slice(0, 3);

  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">🏆 Rankings</h1>

        {/* ── Toggle ── */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-card)',
          borderRadius: 40,
          padding: 4,
          marginBottom: 24,
          border: '1px solid var(--border)',
          width: 'fit-content',
          margin: '0 auto 24px',
        }}>
          {(['weekly', 'alltime'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 24px',
                borderRadius: 36,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.9rem',
                transition: 'all 0.2s',
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? 'white' : 'var(--text-muted)',
                boxShadow: tab === t ? '0 2px 8px rgba(82,183,136,0.35)' : 'none',
              }}
            >
              {t === 'weekly' ? '📅 This Week' : '🏆 All-Time'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'weekly' ? (
            <motion.div
              key="weekly"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Player of the Week banner */}
              {potw?.profile && (
                <motion.div
                  initial={{ opacity: 0, y: -16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card"
                  style={{
                    marginBottom: 24,
                    background: 'linear-gradient(135deg, rgba(255,215,0,0.12) 0%, rgba(233,196,106,0.06) 100%)',
                    border: '1px solid rgba(255,215,0,0.35)',
                    textAlign: 'center',
                    padding: '14px 20px',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--ball-yellow)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '1.2px' }}>
                    👑 Player of the Week 👑
                  </div>
                  <Link to={`/profile/${potw.profile_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                      <Avatar profile={potw.profile as Profile} size="md" showCrown />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                          {(potw.profile as Profile).full_name || (potw.profile as Profile).username}
                        </div>
                        <div style={{ color: 'var(--ball-yellow)', fontWeight: 600, fontSize: '0.85rem' }}>
                          🏅 {potw.wins_count} wins this week
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )}

              {/* Podium */}
              {podiumPlayers.length >= 1 ? (
                <>
                  <Podium players={podiumPlayers} />
                  <CourtLine />
                </>
              ) : (
                <div className="empty-state" style={{ marginBottom: 24 }}>
                  <div className="empty-emoji">🎾</div>
                  <p>No matches played yet this week!</p>
                </div>
              )}

              {/* Weekly rankings list (4th place onward) */}
              {/* Players below the podium */}
              {weeklyPlayers.length > podiumPlayers.length && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {weeklyPlayers.slice(podiumPlayers.length).map((wp, index) => {
                    const rank = index + podiumPlayers.length + 1;
                    const tier = getEloTier(wp.profile.elo);
                    return (
                      <motion.div
                        key={wp.profile.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Link
                          to={`/profile/${wp.profile.id}`}
                          className="card"
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', textDecoration: 'none', color: 'inherit' }}
                        >
                          <span className="rank-number" style={{ minWidth: 32, textAlign: 'center', fontWeight: 800, color: 'var(--text-muted)' }}>
                            #{rank}
                          </span>
                          <Avatar profile={wp.profile} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, wordBreak: 'break-word', lineHeight: 1.3 }}>
                              {wp.profile.full_name || wp.profile.username}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              @{wp.profile.username}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                              {wp.wins}W · {wp.losses}L
                            </div>
                            <div style={{ fontSize: '0.75rem', color: tier.color }}>
                              {tier.emoji} {wp.profile.elo} elo
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* ── This week's matches ── */}
              {weeklyMatches.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#ffffff', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                    🎾 This Week's Matches
                    <span style={{
                      background: 'var(--accent)',
                      color: 'white',
                      borderRadius: 20,
                      padding: '2px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}>
                      {weeklyMatches.length}
                    </span>
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {weeklyMatches.map((match, index) => {
                      const p1 = match.player1 as Profile;
                      const p2 = match.player2 as Profile;
                      if (!p1 || !p2) return null;
                      const eloChange1 = (match.player1_elo_after ?? 0) - (match.player1_elo_before ?? 0);
                      const eloChange2 = (match.player2_elo_after ?? 0) - (match.player2_elo_before ?? 0);
                      const date = new Date(match.played_at);
                      const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

                      return (
                        <motion.div
                          key={match.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04 }}
                          className="card"
                          style={{ padding: '12px 14px' }}
                        >
                          {/* Date */}
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 8, textAlign: 'center' }}>
                            📅 {dateStr}
                          </div>

                          {/* Row 1 — players */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 10 }}>
                            {/* Player 1 */}
                            <Link
                              to={`/profile/${p1.id}`}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                textDecoration: 'none', color: 'inherit',
                                opacity: match.winner_side === 1 ? 1 : 0.5,
                                maxWidth: '44%',
                              }}
                            >
                              <Avatar profile={p1} size="sm" />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.82rem', wordBreak: 'break-word', lineHeight: 1.3 }}>
                                  {p1.full_name || p1.username}
                                  {match.winner_side === 1 && <span style={{ marginLeft: 3 }}>🏆</span>}
                                </div>
                                <span className={`elo-change ${eloChange1 >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: '0.72rem' }}>
                                  {eloChange1 >= 0 ? '+' : ''}{eloChange1}
                                </span>
                              </div>
                            </Link>

                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>vs</span>

                            {/* Player 2 */}
                            <Link
                              to={`/profile/${p2.id}`}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
                                textDecoration: 'none', color: 'inherit',
                                opacity: match.winner_side === 2 ? 1 : 0.5,
                                maxWidth: '44%',
                              }}
                            >
                              <div style={{ minWidth: 0, textAlign: 'right' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.82rem', wordBreak: 'break-word', lineHeight: 1.3 }}>
                                  {match.winner_side === 2 && <span style={{ marginRight: 3 }}>🏆</span>}
                                  {p2.full_name || p2.username}
                                </div>
                                <span className={`elo-change ${eloChange2 >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: '0.72rem' }}>
                                  {eloChange2 >= 0 ? '+' : ''}{eloChange2}
                                </span>
                              </div>
                              <Avatar profile={p2} size="sm" />
                            </Link>
                          </div>

                          {/* Row 2 — score centred below players */}
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <ScoreDisplay score={match.score as SetScore[]} winnerSide={match.winner_side} />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="alltime"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Player of the Week banner */}
              {potw?.profile && (
                <motion.div
                  initial={{ opacity: 0, y: -16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card"
                  style={{
                    marginBottom: 24,
                    background: 'linear-gradient(135deg, rgba(255,215,0,0.12) 0%, rgba(233,196,106,0.06) 100%)',
                    border: '1px solid rgba(255,215,0,0.35)',
                    textAlign: 'center',
                    padding: '14px 20px',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--ball-yellow)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '1.2px' }}>
                    👑 Player of the Week 👑
                  </div>
                  <Link to={`/profile/${potw.profile_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                      <Avatar profile={potw.profile as Profile} size="md" showCrown />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                          {(potw.profile as Profile).full_name || (potw.profile as Profile).username}
                        </div>
                        <div style={{ color: 'var(--ball-yellow)', fontWeight: 600, fontSize: '0.85rem' }}>
                          🏅 {potw.wins_count} wins this week
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )}

              {/* All-time Elo leaderboard */}
              {players.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-emoji">🎾</div>
                  <p>No players yet. Be the first to sign up!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {players.map((player, index) => {
                    const rank = index + 1;
                    const tier = getEloTier(player.elo);
                    const isPotw = potw?.profile_id === player.id;

                    return (
                      <motion.div
                        key={player.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.04 }}
                      >
                        <Link
                          to={`/profile/${player.id}`}
                          className="card"
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', textDecoration: 'none', color: 'inherit' }}
                        >
                          <span className={`rank-number ${rank <= 3 ? `rank-${rank}` : ''}`}>
                            {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                          </span>

                          <Avatar profile={player} showCrown={isPotw} />

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {player.full_name || player.username}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              @{player.username} · {player.wins}W {player.losses}L
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: tier.color }}>
                              {player.elo}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {tier.emoji} {tier.name}
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
