"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import NavBar from '@/components/NavBar';

interface Player {
  id: string;
  name: string;
}

interface TeamPlayer {
  id: string;
  player: Player;
  scores: {
    hole_number: number;
    score: number;
  }[];
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

export default function GamePage() {
  const params = useParams();
  const gameId = params?.gameId as string;
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentHole, setCurrentHole] = useState(1);
  const [saving, setSaving] = useState(false);
  const [pendingScores, setPendingScores] = useState<{[key: string]: number}>({});

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

      if (gameError) throw gameError;
      if (gameData) {
        const formattedGame: Game = {
          id: gameData.id,
          name: gameData.name,
          date: gameData.date,
          teams: gameData.teams.map(team => ({
            id: team.id,
            name: team.name,
            team_players: team.team_players.map(tp => ({
              id: tp.id,
              player: {
                id: tp.player.id,
                name: tp.player.name
              },
              scores: tp.scores || []
            }))
          }))
        };
        setGame(formattedGame);
      }
    } catch (err: any) {
      console.error('Error fetching game:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleError = (error: Error) => {
    console.error('Error:', error.message);
    alert('오류가 발생했습니다. 다시 시도해주세요.');
  };

  useEffect(() => {
    fetchGameData();
  }, [gameId, fetchGameData]);

  const isHoleComplete = (holeNumber: number): boolean => {
    if (!game) return false;
    let complete = true;
    game.teams.forEach(team => {
      team.team_players.forEach(tp => {
        if (!tp.scores.some(s => s.hole_number === holeNumber)) {
          complete = false;
        }
      });
    });
    return complete;
  };

  const handleScoreChange = (teamPlayerId: string, playerId: string, value: number) => {
    setPendingScores(prev => ({
      ...prev,
      [`${teamPlayerId}-${playerId}`]: value
    }));
  };

  const handleSave = async (teamId: string) => {
    if (!game) return;
    
    setSaving(true);
    try {
      // 현재 선택된 팀의 플레이어 점수만 저장
      const team = game.teams.find(t => t.id === teamId);
      if (!team) return;

      for (const tp of team.team_players) {
        const scoreKey = `${tp.id}-${tp.player.id}`;
        const existingScore = tp.scores.find(s => s.hole_number === currentHole);
        
        // pendingScores에 있는 경우에만 업데이트하거나 새로 저장
        if (scoreKey in pendingScores || !existingScore) {
          const score = pendingScores[scoreKey] ?? 0;

          if (existingScore) {
            // 기존 점수 업데이트
            const { error: updateError } = await supabase
              .from('scores')
              .update({ score: score })
              .eq('game_id', gameId)
              .eq('player_id', tp.player.id)
              .eq('hole_number', currentHole);

            if (updateError) throw updateError;
          } else {
            // 새로운 점수 입력
            const { error: insertError } = await supabase
              .from('scores')
              .insert([
                {
                  game_id: gameId,
                  team_id: team.id,
                  player_id: tp.player.id,
                  team_player_id: tp.id,
                  hole_number: currentHole,
                  score: score
                }
              ]);

            if (insertError) throw insertError;
          }
        }
      }

      // 데이터 새로고침
      await fetchGameData();
      
      // 저장된 팀의 점수만 pendingScores에서 제거
      const newPendingScores = { ...pendingScores };
      team.team_players.forEach(tp => {
        const scoreKey = `${tp.id}-${tp.player.id}`;
        delete newPendingScores[scoreKey];
      });
      setPendingScores(newPendingScores);
      
      alert('점수가 저장되었습니다.');
    } catch (error) {
      console.error('Error saving scores:', error);
      alert('점수 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const calculateTotal = (scores: { hole_number: number; score: number }[] = []): number => {
    return scores.reduce((sum, s) => sum + s.score, 0);
  };

  if (loading) return <div className="container">로딩 중...</div>;
  if (error) return <div className="container">에러: {error}</div>;
  if (!game) return <div className="container">게임을 찾을 수 없습니다.</div>;

  return (
    <div className="container page-container">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>{game.name}</h1>
        <p style={{ margin: '0.5rem 0', color: 'var(--gray)' }}>
          {new Date(game.date).toLocaleDateString()}
        </p>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>
          점수 입력 - {currentHole}번 홀
        </h2>
      </div>

      {/* 홀별 점수 표시 */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3>홀별 점수</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>플레이어</th>
                {Array.from({ length: 18 }, (_, i) => (
                  <th key={i} className={currentHole === i + 1 ? 'active' : ''}>
                    {i + 1}
                  </th>
                ))}
                <th>총점</th>
              </tr>
            </thead>
            <tbody>
              {game.teams.map(team => (
                team.team_players.map(tp => (
                  <tr key={tp.id}>
                    <td>{tp.player.name}</td>
                    {Array.from({ length: 18 }, (_, i) => {
                      const score = tp.scores.find(s => s.hole_number === i + 1)?.score;
                      const isPending = pendingScores[`${tp.id}-${tp.player.id}`] && currentHole === i + 1;
                      const displayScore = isPending ? pendingScores[`${tp.id}-${tp.player.id}`] : score;
                      
                      return (
                        <td 
                          key={i}
                          className={currentHole === i + 1 ? 'active' : ''}
                          style={{ 
                            cursor: 'pointer',
                            backgroundColor: displayScore !== undefined ? (currentHole === i + 1 ? 'var(--primary-light)' : '#e5e5e5') : 'transparent'
                          }}
                          onClick={() => setCurrentHole(i + 1)}
                        >
                          {displayScore}
                        </td>
                      );
                    })}
                    <td className="total-score">{calculateTotal(tp.scores)}</td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 홀 선택 버튼 */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.5rem' }}>
          {Array.from({ length: 18 }).map((_, i) => {
            const holeNumber = i + 1;
            const isComplete = isHoleComplete(holeNumber);
            return (
              <button
                key={i}
                className={`hole-button ${currentHole === holeNumber ? 'active' : ''} ${isComplete ? 'complete' : ''}`}
                onClick={() => setCurrentHole(holeNumber)}
              >
                {holeNumber}
              </button>
            );
          })}
        </div>
      </div>

      {/* 점수 입력 */}
      {game.teams.map((team) => (
        <div key={team.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>{team.name}</h2>
            <button
              className="btn"
              onClick={() => handleSave(team.id)}
              disabled={saving}
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
          <div className="score-input-container">
            {team.team_players.map((tp) => {
              const currentScore = tp.scores.find(s => s.hole_number === currentHole)?.score || 0;
              const pendingScore = pendingScores[`${tp.id}-${tp.player.id}`];
              const displayScore = pendingScore !== undefined ? pendingScore : currentScore;
              
              return (
                <div key={tp.id} className="player-score">
                  <div className="player-name">{tp.player.name}</div>
                  <div className="score-info">
                    <div className="total-score">총점: {calculateTotal(tp.scores)}</div>
                    <div className="score-controls">
                      <button
                        className="score-btn minus"
                        onClick={() => handleScoreChange(tp.id, tp.player.id, Math.max(-4, displayScore - 1))}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={displayScore}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          handleScoreChange(tp.id, tp.player.id, Math.max(-4, Math.min(value, 10)));
                        }}
                        min="-4"
                        max="10"
                        className="score-input"
                      />
                      <button
                        className="score-btn plus"
                        onClick={() => handleScoreChange(tp.id, tp.player.id, Math.min(10, displayScore + 1))}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <NavBar gameId={gameId} />
    </div>
  );
} 