import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { calculateEloChange } from '../lib/elo';
import { ACHIEVEMENTS } from '../lib/achievements';
import { useAuth } from '../hooks/useAuth';
import type { Profile, MatchFormat, MatchType, SetScore, PlayerStats, Match } from '../types';

export default function AddMatch() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  // Match config
  const [matchFormat, setMatchFormat] = useState<MatchFormat>('singles');
  const [matchType, setMatchType] = useState<MatchType>('best_of_3');

  // Players
  const [player1Id, setPlayer1Id] = useState('');
  const [player2Id, setPlayer2Id] = useState('');
  const [player3Id, setPlayer3Id] = useState('');  // doubles partner p1
  const [player4Id, setPlayer4Id] = useState('');  // doubles partner p2

  // Score
  const [sets, setSets] = useState<SetScore[]>([{ p1: 0, p2: 0 }]);
  const [winnerSide, setWinnerSide] = useState<1 | 2>(1);

  useEffect(() => {
    supabase.from('profiles').select('*').order('username').then(({ data }) => {
      setPlayers(data ?? []);
    });
  }, []);

  function addSet() {
    if (sets.length < 3) {
      setSets([...sets, { p1: 0, p2: 0 }]);
    }
  }

  function removeSet(index: number) {
    if (sets.length > 1) {
      setSets(sets.filter((_, i) => i !== index));
    }
  }

  function updateSet(index: number, field: 'p1' | 'p2', value: number) {
    const newSets = [...sets];
    newSets[index] = { ...newSets[index], [field]: value };
    setSets(newSets);
  }

  async function computePlayerStats(profileId: string, newElo: number): Promise<PlayerStats> {
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)
      .order('played_at', { ascending: true });

    let wins = 0, losses = 0, currentStreak = 0, maxStreak = 0;
    let biggestUpset = 0, comebacks = 0;

    for (const m of (matches ?? []) as Match[]) {
      const isP1Side = m.player1_id === profileId || m.player3_id === profileId;
      const won = (isP1Side && m.winner_side === 1) || (!isP1Side && m.winner_side === 2);

      if (won) {
        wins++;
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);

        // Check upset
        const myElo = isP1Side ? (m.player1_elo_before ?? 1000) : (m.player2_elo_before ?? 1000);
        const oppElo = isP1Side ? (m.player2_elo_before ?? 1000) : (m.player1_elo_before ?? 1000);
        if (oppElo > myElo) {
          biggestUpset = Math.max(biggestUpset, oppElo - myElo);
        }

        // Check comeback (won after losing first set in best_of_3)
        const score = m.score as SetScore[];
        if (score.length >= 2 && m.match_type === 'best_of_3') {
          const lostFirst = isP1Side ? score[0].p1 < score[0].p2 : score[0].p2 < score[0].p1;
          if (lostFirst) comebacks++;
        }
      } else {
        losses++;
        currentStreak = 0;
      }
    }

    return {
      wins,
      losses,
      currentStreak,
      maxStreak,
      elo: newElo,
      matchesPlayed: wins + losses,
      biggestUpset,
      comebacks,
    };
  }

  async function checkAndAwardAchievements(profileId: string, stats: PlayerStats) {
    const { data: existing } = await supabase
      .from('achievements')
      .select('achievement_key')
      .eq('profile_id', profileId);

    const existingKeys = new Set((existing ?? []).map((a) => a.achievement_key));
    const newAchievements = ACHIEVEMENTS.filter(
      (a) => !existingKeys.has(a.key) && a.check(stats)
    );

    for (const ach of newAchievements) {
      await supabase.from('achievements').insert({
        profile_id: profileId,
        achievement_key: ach.key,
      });
      toast.success(`🏅 Achievement Unlocked: ${ach.emoji} ${ach.name}!`, { duration: 4000 });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!player1Id || !player2Id) {
      toast.error('Select both players!');
      return;
    }
    if (player1Id === player2Id) {
      toast.error('Can\'t play against yourself! 😄');
      return;
    }
    if (matchFormat === 'doubles' && (!player3Id || !player4Id)) {
      toast.error('Select all 4 players for doubles!');
      return;
    }

    setLoading(true);

    try {
      // Get current Elo
      const p1 = players.find((p) => p.id === player1Id)!;
      const p2 = players.find((p) => p.id === player2Id)!;

      const winnerId = winnerSide === 1 ? player1Id : player2Id;
      const loserId = winnerSide === 1 ? player2Id : player1Id;
      const winnerElo = winnerSide === 1 ? p1.elo : p2.elo;
      const loserElo = winnerSide === 1 ? p2.elo : p1.elo;

      const { newWinnerElo, newLoserElo } = calculateEloChange(winnerElo, loserElo);

      // Insert match
      await supabase.from('matches').insert({
        match_format: matchFormat,
        match_type: matchType,
        player1_id: player1Id,
        player2_id: player2Id,
        player3_id: matchFormat === 'doubles' ? player3Id : null,
        player4_id: matchFormat === 'doubles' ? player4Id : null,
        score: sets,
        winner_side: winnerSide,
        player1_elo_before: p1.elo,
        player2_elo_before: p2.elo,
        player1_elo_after: winnerSide === 1 ? newWinnerElo : newLoserElo,
        player2_elo_after: winnerSide === 2 ? newWinnerElo : newLoserElo,
        created_by: user.id,
      });

      // Update Elo & W/L via RPC (bypasses RLS so both players update)
      const { error: rpcError } = await supabase.rpc('update_elo_after_match', {
        p_winner_id:     winnerId,
        p_loser_id:      loserId,
        p_winner_elo:    newWinnerElo,
        p_loser_elo:     newLoserElo,
        p_winner_wins:   players.find((p) => p.id === winnerId)!.wins + 1,
        p_loser_losses:  players.find((p) => p.id === loserId)!.losses + 1,
      });

      if (rpcError) throw rpcError;

      // Check achievements for both players
      const winnerStats = await computePlayerStats(winnerId, newWinnerElo);
      const loserStats = await computePlayerStats(loserId, newLoserElo);
      await checkAndAwardAchievements(winnerId, winnerStats);
      await checkAndAwardAchievements(loserId, loserStats);

      // 🎉 Confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#52B788', '#FFD700', '#E9C46A', '#40916C'],
      });

      const winnerProfile = players.find((p) => p.id === winnerId)!;
      toast.success(`🎉 ${winnerProfile.username} wins! Elo: ${winnerElo} → ${newWinnerElo}`);

      await refreshProfile();
      setTimeout(() => navigate('/matches'), 1500);
    } catch (err) {
      toast.error('Something went wrong! 😢');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const playerOptions = players.filter(() => {
    // const usedIds = [player1Id, player2Id, player3Id, player4Id].filter(Boolean);
    return true; // Show all, validation happens on submit
  });

  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">🎾 Record Match</h1>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="card"
        >
          {/* Match Format */}
          <div className="input-group">
            <label>🏟️ Format</label>
            <div className="tabs">
              <button
                type="button"
                className={`tab ${matchFormat === 'singles' ? 'active' : ''}`}
                onClick={() => setMatchFormat('singles')}
              >
                👤 Singles
              </button>
              <button
                type="button"
                className={`tab ${matchFormat === 'doubles' ? 'active' : ''}`}
                onClick={() => setMatchFormat('doubles')}
              >
                👥 Doubles
              </button>
            </div>
          </div>

          {/* Match Type */}
          <div className="input-group">
            <label>📋 Type</label>
            <div className="tabs">
              <button
                type="button"
                className={`tab ${matchType === 'best_of_3' ? 'active' : ''}`}
                onClick={() => { setMatchType('best_of_3'); setSets([{ p1: 0, p2: 0 }]); }}
              >
                🎯 Best of 3
              </button>
              <button
                type="button"
                className={`tab ${matchType === 'tiebreaker_to_7' ? 'active' : ''}`}
                onClick={() => { setMatchType('tiebreaker_to_7'); setSets([{ p1: 0, p2: 0 }]); }}
              >
                ⚡ Tiebreaker
              </button>
            </div>
          </div>

          {/* Player Selection */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <div className="input-group">
                <label>🟢 Side 1 {matchFormat === 'doubles' ? '(Team 1)' : ''}</label>
                <select className="input" value={player1Id} onChange={(e) => setPlayer1Id(e.target.value)} required>
                  <option value="">Select player...</option>
                  {playerOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.username} ({p.elo})</option>
                  ))}
                </select>
              </div>
              {matchFormat === 'doubles' && (
                <div className="input-group">
                  <label>🟢 Partner</label>
                  <select className="input" value={player3Id} onChange={(e) => setPlayer3Id(e.target.value)} required>
                    <option value="">Select partner...</option>
                    {playerOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.username} ({p.elo})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <div className="input-group">
                <label>🔴 Side 2 {matchFormat === 'doubles' ? '(Team 2)' : ''}</label>
                <select className="input" value={player2Id} onChange={(e) => setPlayer2Id(e.target.value)} required>
                  <option value="">Select player...</option>
                  {playerOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.username} ({p.elo})</option>
                  ))}
                </select>
              </div>
              {matchFormat === 'doubles' && (
                <div className="input-group">
                  <label>🔴 Partner</label>
                  <select className="input" value={player4Id} onChange={(e) => setPlayer4Id(e.target.value)} required>
                    <option value="">Select partner...</option>
                    {playerOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.username} ({p.elo})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Score Entry */}
          <div className="input-group">
            <label>📊 Score</label>
            {sets.map((set, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                  background: 'var(--bg-input)',
                  padding: '8px 12px',
                  borderRadius: 'var(--border-radius)',
                }}
              >
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: 50 }}>
                  {matchType === 'tiebreaker_to_7' ? 'TB' : `Set ${i + 1}`}
                </span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  className="input"
                  style={{ width: 60, textAlign: 'center', padding: '8px' }}
                  value={set.p1}
                  onChange={(e) => updateSet(i, 'p1', parseInt(e.target.value) || 0)}
                />
                <span style={{ fontWeight: 800, color: 'var(--text-muted)' }}>—</span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  className="input"
                  style={{ width: 60, textAlign: 'center', padding: '8px' }}
                  value={set.p2}
                  onChange={(e) => updateSet(i, 'p2', parseInt(e.target.value) || 0)}
                />
                {sets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSet(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                  >
                    ❌
                  </button>
                )}
              </motion.div>
            ))}
            {matchType === 'best_of_3' && sets.length < 3 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={addSet}>
                ➕ Add Set
              </button>
            )}
          </div>

          {/* Winner Selection */}
          <div className="input-group">
            <label>🏆 Winner</label>
            <div className="tabs">
              <button
                type="button"
                className={`tab ${winnerSide === 1 ? 'active' : ''}`}
                onClick={() => setWinnerSide(1)}
              >
                🟢 Side 1 {player1Id ? `(${players.find((p) => p.id === player1Id)?.username})` : ''}
              </button>
              <button
                type="button"
                className={`tab ${winnerSide === 2 ? 'active' : ''}`}
                onClick={() => setWinnerSide(2)}
              >
                🔴 Side 2 {player2Id ? `(${players.find((p) => p.id === player2Id)?.username})` : ''}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 12 }}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : '🎾 Submit Match'}
          </button>
        </motion.form>
      </div>
    </div>
  );
}
