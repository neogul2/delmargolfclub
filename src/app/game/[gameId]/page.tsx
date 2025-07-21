"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NavBar from '@/components/NavBar';
import Link from 'next/link';

interface Player {
  id: string;
  name: string;
}

interface TeamPlayer {
  player: Player;
  scores: { score: number }[];
}

interface Team {
  id: string;
  name: string;
  team_players: TeamPlayer[];
}

interface Game {
  id: string;
  name: string;
  date: string;
  teams: Team[];
}

export default function GamePage({ params }: { params: { gameId: string } }) {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [scores, setScores] = useState<number[][]>([]);

  useEffect(() => {
    fetchGameData();
  }, []);

  const fetchGameData = async () => {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select(`
          id,
          name,
          date,
          teams (
            id,
            name,
            team_players (
              player (
                id,
                name
              ),
              scores (
                score
              )
            )
          )
        `)
        .eq('id', params.gameId)
        .single();

      if (gameError) throw gameError;

      setGame(gameData);

      // Extract players and scores
      const allPlayers: Player[] = [];
      const allScores: number[][] = [];

      gameData.teams.forEach(team => {
        team.team_players.forEach(tp => {
          allPlayers.push(tp.player);
          allScores.push(tp.scores.map(s => s.score));
        });
      });

      setPlayers(allPlayers);
      setScores(allScores);
    } catch (error) {
      console.error('Error fetching game:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  };

  const handleScoreChange = (playerIndex: number, holeIndex: number, value: string) => {
    const newValue = value === '' ? null : Math.max(-4, Math.min(12, parseInt(value) || 0));
    
    setScores(prevScores => {
      const newScores = [...prevScores];
      if (!newScores[playerIndex]) {
        newScores[playerIndex] = Array(18).fill(null);
      }
      newScores[playerIndex] = [...newScores[playerIndex]];
      newScores[playerIndex][holeIndex] = newValue;
      return newScores;
    });
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      // Delete existing scores
      const { error: deleteError } = await supabase
        .from('scores')
        .delete()
        .in('team_player_id', 
          game!.teams.flatMap(team => 
            team.team_players.map(tp => tp.player.id)
          )
        );

      if (deleteError) throw deleteError;

      // Insert new scores
      let playerIndex = 0;
      for (const team of game!.teams) {
        for (const tp of team.team_players) {
          const playerScores = scores[playerIndex] || [];
          
          for (let hole = 0; hole < 18; hole++) {
            const score = playerScores[hole];
            if (score !== null && score !== undefined) {
              const { error: insertError } = await supabase
                .from('scores')
                .insert({
                  team_player_id: tp.player.id,
                  hole: hole + 1,
                  score: score
                });

              if (insertError) throw insertError;
            }
          }
          playerIndex++;
        }
      }

      await fetchGameData();
    } catch (error) {
      console.error('Error saving scores:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (error) return <div className="container">에러: {error}</div>;
  if (!game) return <div className="container">게임을 찾을 수 없습니다.</div>;

  return (
    <div className="container page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>{game.name}</h2>
        <div style={{ fontSize: '0.9rem', color: '#666' }}>{new Date(game.date).toLocaleDateString()}</div>
      </div>

      <div className="score-container">
        <table className="score-table">
          <thead>
            <tr>
              <th className="sticky-column">선수</th>
              {Array.from({ length: 18 }, (_, i) => (
                <th key={i}>{i + 1}번홀</th>
              ))}
              <th className="total-column">총점</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, playerIndex) => {
              const totalScore = scores[playerIndex]?.reduce((sum, score) => sum + (score || 0), 0) || 0;
              return (
                <tr key={player.id}>
                  <td className="sticky-column">{player.name}</td>
                  {Array.from({ length: 18 }, (_, holeIndex) => (
                    <td key={holeIndex}>
                      <input
                        type="number"
                        value={scores[playerIndex]?.[holeIndex] || ''}
                        onChange={(e) => handleScoreChange(playerIndex, holeIndex, e.target.value)}
                        min="-4"
                        max="12"
                      />
                    </td>
                  ))}
                  <td className="total-column">{totalScore}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button
          className="btn"
          onClick={handleSave}
          disabled={loading}
          style={{ flex: 1 }}
        >
          {loading ? "저장 중..." : "저장"}
        </button>
        <Link href="/" className="btn btn-outline" style={{ flex: 1 }}>
          리더보드
        </Link>
      </div>

      <NavBar />
    </div>
  );
} 