/**
 * 🎾 Standard Elo Rating System
 * K-factor = 32 (standard for club-level play)
 */

const K = 32;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function calculateEloChange(
  winnerElo: number,
  loserElo: number
): { newWinnerElo: number; newLoserElo: number; change: number } {
  const expected = expectedScore(winnerElo, loserElo);
  const change = Math.round(K * (1 - expected));

  return {
    newWinnerElo: winnerElo + change,
    newLoserElo: loserElo - change,
    change,
  };
}

export function getEloTier(elo: number): { name: string; emoji: string; color: string } {
  if (elo >= 2000) return { name: 'Grand Slam', emoji: '👑', color: '#FFD700' };
  if (elo >= 1600) return { name: 'Masters', emoji: '🏆', color: '#E5A100' };
  if (elo >= 1400) return { name: 'Challenger', emoji: '⚡', color: '#C0C0C0' };
  if (elo >= 1200) return { name: 'Rising Star', emoji: '⭐', color: '#CD7F32' };
  if (elo >= 1000) return { name: 'Club Player', emoji: '🎾', color: '#4CAF50' };
  return { name: 'Rookie', emoji: '🌱', color: '#8BC34A' };
}
