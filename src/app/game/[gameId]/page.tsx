"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import NavBar from '@/components/NavBar';
import Link from 'next/link';

interface Player {
  id: string;
  name: string;
}

interface Score {
  score: number;
  hole: number;
}

interface TeamPlayer {
  player: Player;
  scores: Score[];
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

interface RawTeamPlayerResponse {
  player: {
    id: string;
    name: string;
  };
  scores: {
    score: number;
    hole: number;
  }[];
}

interface TeamPlayerWithId extends TeamPlayer {
  id: string;
}

interface TeamWithFullData extends Team {
  team_players: TeamPlayerWithId[];
}

interface GameWithFullData extends Game {
  teams: TeamWithFullData[];
}

export default function GamePage() {
  const params = useParams();
  const gameId = params?.gameId as string;
  
  const [game, setGame] = useState<GameWithFullData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [scores, setScores] = useState<number[][]>([]);

  const fetchGameData = useCallback(async () => {
    if (!gameId) {
      setError('게임 ID가 없습니다.');
      return;
    }

    try {
      console.log('Fetching game data for ID:', gameId);

      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select(`
          *,
          teams (
            id,
            name,
            team_players (
              id,
              player:players (
                id,
                name
              ),
              scores (
                hole_number,
                score
              )
            )
          )
        `)
        .eq('id', gameId)
        .single();

      if (gameError) {
        console.error('Game fetch error:', gameError);
        throw gameError;
      }
      
      if (!gameData) {
        console.error('No game data found for ID:', gameId);
        throw new Error('게임을 찾을 수 없습니다.');
      }

      console.log('Game data:', gameData);

      // Transform the data to match our Game interface
      const transformedGame: GameWithFullData = {
        id: gameData.id,
        name: gameData.name,
        date: gameData.date,
        teams: gameData.teams.map(team => ({
          id: team.id,
          name: team.name,
          team_players: team.team_players.map(tp => ({
            id: tp.id, // Keep the team_player id
            player: tp.player,
            scores: tp.scores.map(s => ({
              score: s.score,
              hole: s.hole_number
            }))
          }))
        }))
      };

      setGame(transformedGame);

      // Extract players and scores
      const allPlayers: Player[] = [];
      const allScores: number[][] = [];

      transformedGame.teams.forEach(team => {
        team.team_players.forEach(tp => {
          allPlayers.push(tp.player);
          const playerScores = Array(18).fill(null);
          tp.scores.forEach(s => {
            if (s.hole >= 1 && s.hole <= 18) {
              playerScores[s.hole - 1] = s.score;
            }
          });
          allScores.push(playerScores);
        });
      });

      setPlayers(allPlayers);
      setScores(allScores);
    } catch (error) {
      console.error('Error fetching game:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  }, [gameId]);

  useEffect(() => {
    if (gameId) {
      fetchGameData();
    }
  }, [fetchGameData, gameId]);

  const handleScoreChange = (playerIndex: number, holeIndex: number, value: string) => {
    const parsedValue = value === '' ? null : parseInt(value);
    const newValue = parsedValue === null ? null : Math.max(-4, Math.min(12, parsedValue));
    
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
    if (!game) return;
    
    setLoading(true);
    setError(null);

    try {
      console.log('Saving scores...');
      let playerIndex = 0;
      
      for (const team of game.teams) {
        for (const tp of team.team_players) {
          console.log(`Processing player ${tp.player.name} with team_player_id ${tp.id}`);
          const playerScores = scores[playerIndex] || [];

          // Delete existing scores for this team_player
          const { error: deleteError } = await supabase
            .from('scores')
            .delete()
            .eq('team_player_id', tp.id);

          if (deleteError) {
            console.error('Error deleting scores:', deleteError);
            throw deleteError;
          }

          // Insert new scores
          for (let hole = 0; hole < 18; hole++) {
            const score = playerScores[hole];
            // Changed condition to explicitly check for null
            if (score !== null) {
              console.log(`Saving score ${score} for hole ${hole + 1}`);
              const { error: insertError } = await supabase
                .from('scores')
                .insert({
                  team_player_id: tp.id,
                  hole_number: hole + 1,
                  score: score
                });

              if (insertError) {
                console.error('Error inserting score:', insertError);
                throw insertError;
              }
            }
          }
          playerIndex++;
        }
      }

      console.log('Scores saved successfully');
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
        <div className="score-table-wrapper">
          {/* Fixed Columns with scrollbar container */}
          <div className="fixed-container">
            <table className="fixed-table">
              <thead>
                <tr>
                  <th>선수</th>
                  <th>핸디캡</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, playerIndex) => {
                  const totalScore = scores[playerIndex]?.reduce((sum, score) => sum + (score ?? 0), 0);
                  return (
                    <tr key={player.id}>
                      <td>{player.name}</td>
                      <td>{totalScore}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Scrollable Columns */}
          <div className="scrollable-container">
            <table className="scrollable-table">
              <thead>
                <tr>
                  {Array.from({ length: 18 }, (_, i) => (
                    <th key={i}>{i + 1}번홀</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((player, playerIndex) => (
                  <tr key={player.id}>
                    {Array.from({ length: 18 }, (_, holeIndex) => {
                      const score = scores[playerIndex]?.[holeIndex];
                      return (
                        <td key={holeIndex}>
                          <input
                            type="number"
                            value={score !== null && score !== undefined ? score : ''}
                            onChange={(e) => handleScoreChange(playerIndex, holeIndex, e.target.value)}
                            min="-4"
                            max="12"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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