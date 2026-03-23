import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import Avatar from '../components/Avatar';
import type { Match, Profile, SetScore } from '../types';

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

export default function MatchHistory() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('matches')
        .select('*, player1:profiles!matches_player1_id_fkey(*), player2:profiles!matches_player2_id_fkey(*)')
        .order('played_at', { ascending: false })
        .limit(50);

      setMatches((data as Match[]) ?? []);
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

  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">🎾 Match History</h1>

        {matches.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">📭</div>
            <p>No matches recorded yet!</p>
            <Link to="/add-match" className="btn btn-primary" style={{ marginTop: 16 }}>
              ➕ Record First Match
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {matches.map((match, index) => {
              const p1 = match.player1 as Profile;
              const p2 = match.player2 as Profile;
              if (!p1 || !p2) return null;

              const eloChange1 = (match.player1_elo_after ?? 0) - (match.player1_elo_before ?? 0);
              const eloChange2 = (match.player2_elo_after ?? 0) - (match.player2_elo_before ?? 0);

              return (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="card"
                  style={{ padding: '12px 16px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {match.match_format === 'doubles' ? '👥' : '👤'}{' '}
                      {match.match_type === 'tiebreaker_to_7' ? 'Tiebreaker' : 'Best of 3'}{' '}
                      · {new Date(match.played_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Row 1 — players */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 10 }}>
                    {/* Player 1 */}
                    <Link
                      to={`/profile/${p1.id}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        textDecoration: 'none', color: 'inherit',
                        opacity: match.winner_side === 1 ? 1 : 0.6,
                        maxWidth: '44%',
                      }}
                    >
                      <Avatar profile={p1} size="sm" />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', wordBreak: 'break-word', lineHeight: 1.3 }}>
                          {p1.username}
                          {match.winner_side === 1 && <span style={{ marginLeft: 3 }}>🏆</span>}
                        </div>
                        <span className={`elo-change ${eloChange1 >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: '0.75rem' }}>
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
                        opacity: match.winner_side === 2 ? 1 : 0.6,
                        maxWidth: '44%',
                      }}
                    >
                      <div style={{ minWidth: 0, textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', wordBreak: 'break-word', lineHeight: 1.3 }}>
                          {match.winner_side === 2 && <span style={{ marginRight: 3 }}>🏆</span>}
                          {p2.username}
                        </div>
                        <span className={`elo-change ${eloChange2 >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: '0.75rem' }}>
                          {eloChange2 >= 0 ? '+' : ''}{eloChange2}
                        </span>
                      </div>
                      <Avatar profile={p2} size="sm" />
                    </Link>
                  </div>

                  {/* Row 2 — score centred */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <ScoreDisplay score={match.score as SetScore[]} winnerSide={match.winner_side} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
