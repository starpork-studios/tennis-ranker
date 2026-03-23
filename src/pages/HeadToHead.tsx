import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import Avatar from '../components/Avatar';
import type { Profile, Match, SetScore } from '../types';

export default function HeadToHead() {
  const [players, setPlayers] = useState<Profile[]>([]);
  const [player1Id, setPlayer1Id] = useState('');
  const [player2Id, setPlayer2Id] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('*').order('username').then(({ data }) => {
      setPlayers(data ?? []);
    });
  }, []);

  async function search() {
    if (!player1Id || !player2Id || player1Id === player2Id) return;
    setLoading(true);
    setSearched(true);

    const { data } = await supabase
      .from('matches')
      .select('*, player1:profiles!matches_player1_id_fkey(*), player2:profiles!matches_player2_id_fkey(*)')
      .or(
        `and(player1_id.eq.${player1Id},player2_id.eq.${player2Id}),and(player1_id.eq.${player2Id},player2_id.eq.${player1Id})`
      )
      .order('played_at', { ascending: false });

    setMatches((data as Match[]) ?? []);
    setLoading(false);
  }

  const p1 = players.find((p) => p.id === player1Id);
  const p2 = players.find((p) => p.id === player2Id);

  // Calculate H2H record
  let p1Wins = 0;
  let p2Wins = 0;
  for (const m of matches) {
    const p1IsPlayer1 = m.player1_id === player1Id;
    if ((p1IsPlayer1 && m.winner_side === 1) || (!p1IsPlayer1 && m.winner_side === 2)) {
      p1Wins++;
    } else {
      p2Wins++;
    }
  }

  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">⚔️ Head to Head</h1>

        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'end' }}>
            <div className="input-group" style={{ margin: 0 }}>
              <label>🟢 Player 1</label>
              <select className="input" value={player1Id} onChange={(e) => setPlayer1Id(e.target.value)}>
                <option value="">Select...</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.username} ({p.elo})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-muted)', paddingBottom: 12 }}>
              VS
            </div>

            <div className="input-group" style={{ margin: 0 }}>
              <label>🔴 Player 2</label>
              <select className="input" value={player2Id} onChange={(e) => setPlayer2Id(e.target.value)}>
                <option value="">Select...</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.username} ({p.elo})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 16 }}
            onClick={search}
            disabled={!player1Id || !player2Id || player1Id === player2Id || loading}
          >
            {loading ? <span className="spinner" /> : '🔍 Compare'}
          </button>
        </div>

        <AnimatePresence>
          {searched && p1 && p2 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {/* H2H Summary */}
              <div className="card" style={{
                textAlign: 'center',
                marginBottom: 24,
                background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(82, 183, 136, 0.05) 100%)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '8px 0' }}>
                  {/* Player 1 */}
                  <div style={{ textAlign: 'center' }}>
                    <Avatar profile={p1} size="lg" />
                    <div style={{ marginTop: 8, fontWeight: 700 }}>
                      {p1.username}
                    </div>
                    <div className="badge badge-elo" style={{ marginTop: 4 }}>
                      ⚡ {p1.elo}
                    </div>
                  </div>

                  {/* Score */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <motion.span
                        key={p1Wins}
                        initial={{ scale: 1.5 }}
                        animate={{ scale: 1 }}
                        style={{
                          fontSize: '3rem',
                          fontWeight: 900,
                          color: p1Wins > p2Wins ? 'var(--success)' : p1Wins < p2Wins ? 'var(--danger)' : 'var(--text-muted)',
                        }}
                      >
                        {p1Wins}
                      </motion.span>
                      <span style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>—</span>
                      <motion.span
                        key={p2Wins}
                        initial={{ scale: 1.5 }}
                        animate={{ scale: 1 }}
                        style={{
                          fontSize: '3rem',
                          fontWeight: 900,
                          color: p2Wins > p1Wins ? 'var(--success)' : p2Wins < p1Wins ? 'var(--danger)' : 'var(--text-muted)',
                        }}
                      >
                        {p2Wins}
                      </motion.span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {matches.length} match{matches.length !== 1 ? 'es' : ''} played
                    </div>
                  </div>

                  {/* Player 2 */}
                  <div style={{ textAlign: 'center' }}>
                    <Avatar profile={p2} size="lg" />
                    <div style={{ marginTop: 8, fontWeight: 700 }}>
                      {p2.username}
                    </div>
                    <div className="badge badge-elo" style={{ marginTop: 4 }}>
                      ⚡ {p2.elo}
                    </div>
                  </div>
                </div>
              </div>

              {/* Match List */}
              {matches.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-emoji">🤝</div>
                  <p>These two haven't played each other yet!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {matches.map((match, index) => {
                    const p1IsPlayer1 = match.player1_id === player1Id;
                    const p1Won = (p1IsPlayer1 && match.winner_side === 1) || (!p1IsPlayer1 && match.winner_side === 2);

                    return (
                      <motion.div
                        key={match.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="card"
                        style={{ padding: '12px 16px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '1.2rem' }}>{p1Won ? '🟢' : '🔴'}</span>
                            <span style={{ fontWeight: 700, color: p1Won ? 'var(--success)' : 'var(--danger)' }}>
                              {p1Won ? p1.username : p2.username} wins
                            </span>
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

                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {new Date(match.played_at).toLocaleDateString()}
                          </span>
                        </div>
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
