"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import NavBar from '@/components/NavBar';
import Link from 'next/link';
import { calculateTotal } from '@/lib/utils';
import React from 'react';

interface Player {
  id: string;
  name: string;
}

interface Score {
  hole_number: number;
  score: number;
}

interface TeamPlayer {
  id: string;
  team_name: string;
  player: Player;
  scores: Score[];
}

interface Team {
  id: string;
  name: string;
  team_players: TeamPlayer[];
}

interface GameWithFullData {
  id: string;
  name: string;
  date: string;
  teams: Team[];
}

const calculateUpDownScore = (teamAScores: number[], teamBScores: number[]): { aScore: number, bScore: number } => {
  const validTeamAScores = teamAScores.filter(score => score !== null && score !== undefined);
  const validTeamBScores = teamBScores.filter(score => score !== null && score !== undefined);

  if (validTeamAScores.length === 0 || validTeamBScores.length === 0) {
    return { aScore: 0, bScore: 0 };
  }

  let aScore = 0;
  let bScore = 0;

  const minA = Math.min(...validTeamAScores);
  const minB = Math.min(...validTeamBScores);
  if (minA < minB) aScore += 1;
  if (minB < minA) bScore += 1;
  
  const maxA = Math.max(...validTeamAScores);
  const maxB = Math.max(...validTeamBScores);
  if (maxA < maxB) aScore += 1;
  if (maxB < maxA) bScore += 1;

  return { aScore, bScore };
};

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
              team_name,
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
            id: tp.id,
            player: tp.player,
            team_name: tp.team_name, // 여기서 team_name을 제대로 가져오는지 확인
            scores: tp.scores.map(s => ({
              score: s.score,
              hole_number: s.hole_number
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
            if (s.hole_number >= 1 && s.hole_number <= 18) {
              playerScores[s.hole_number - 1] = s.score;
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

  const autoSaveScore = async (playerIndex: number, playerScores: number[]) => {
    if (!game) return;
    setError(null);
    try {
      // team_player_id 찾기
      let teamPlayerId = '';
      let idx = 0;
      for (const team of game.teams) {
        for (const tp of team.team_players) {
          if (idx === playerIndex) {
            teamPlayerId = tp.id;
          }
          idx++;
        }
      }
      if (!teamPlayerId) return;
      // 기존 점수 삭제
      await supabase.from('scores').delete().eq('team_player_id', teamPlayerId);
      // 새 점수 삽입
      for (let hole = 0; hole < 18; hole++) {
        const score = playerScores[hole];
        if (score !== null) {
          await supabase.from('scores').insert({
            team_player_id: teamPlayerId,
            hole_number: hole + 1,
            score: score
          });
        }
      }
      // fetchGameData() 호출 제거 - 페이지 리로딩 방지
      // 점수 저장 성공 시 작은 알림 표시 (선택사항)
      console.log('점수가 저장되었습니다.');
    } catch (error) {
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    }
  };

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
      // 자동 저장 호출
      autoSaveScore(playerIndex, newScores[playerIndex]);
      return newScores;
    });
  };

  if (loading) {
    return <div className="container">로딩 중...</div>;
  }

  if (error) return <div className="container">에러: {error}</div>;
  if (!game) return <div className="container">게임을 찾을 수 없습니다.</div>;

  return (
    <div className="container page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>{game.name}</h2>
        <div style={{ fontSize: '0.9rem', color: '#666' }}>{new Date(game.date).toLocaleDateString()}</div>
      </div>

      <div className="score-container">
        {/* 기존 점수 테이블 */}
        <div className="score-table-wrapper">
          {/* Fixed Columns with scrollbar container */}
          <div className="fixed-container">
            <table className="fixed-table">
              <thead>
                <tr>
                  <th style={{ padding: '4px 6px' }}>선수</th>
                  <th style={{ padding: '4px 6px' }}>조</th>
                  <th style={{ padding: '4px 6px' }}>팀</th>
                  <th style={{ padding: '4px 6px' }}>핸디캡</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, playerIndex) => {
                  const validScores = scores[playerIndex]
                    ?.map((score, index) => ({
                      hole_number: index + 1,
                      score: score
                    }))
                    .filter(s => s.score !== null && s.score !== undefined) || [];
                  
                  const totalScore = calculateTotal(validScores);
                  const teamInfo = game.teams.find(t => 
                    t.team_players.some(tp => tp.player.id === player.id)
                  );
                  // 조 번호 추출
                  const groupNumber = teamInfo?.name.replace(/[^0-9]/g, '') || '';
                  // team_name이 실제 A/B 값을 가지고 있음
                  const playerTeam = teamInfo?.team_players.find(tp => tp.player.id === player.id)?.team_name || '';
                  
                  return (
                    <tr key={player.id}>
                      <td style={{ padding: '4px 6px' }}>{player.name}</td>
                      <td style={{ padding: '4px 6px' }}>{groupNumber}</td>
                      <td className={`team-${playerTeam?.toLowerCase()}`} style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>
                        {playerTeam}
                      </td>
                      <td style={{ padding: '4px 6px' }}>{totalScore}</td>
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
                    <th key={i} style={{ minWidth: '45px', padding: '4px 4px' }}>{i + 1}번홀</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((player, playerIndex) => (
                  <tr key={player.id}>
                    {Array.from({ length: 18 }, (_, holeIndex) => {
                      const score = scores[playerIndex]?.[holeIndex];
                      return (
                        <td key={holeIndex} className={score !== null && score !== undefined ? 'score-filled' : ''} style={{ padding: '0px' }}>
                          <input
                            type="number"
                            value={score !== null && score !== undefined ? score : ''}
                            onChange={(e) => handleScoreChange(playerIndex, holeIndex, e.target.value)}
                            min="-4"
                            max="12"
                            style={{ width: '100%', textAlign: 'center' }}
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

        {/* 업다운 게임 테이블 */}
        <div style={{ marginTop: '2rem' }}>
          <h3>업다운 게임 현황</h3>
          <div className="score-table-wrapper">
            {/* Fixed Columns */}
            <div className="fixed-container">
              <table className="fixed-table">
                <thead>
                  <tr>
                    <th style={{ padding: '4px 6px' }}>조</th>
                    <th style={{ padding: '4px 6px' }}>팀</th>
                    <th style={{ padding: '4px 6px' }}>합계</th>
                  </tr>
                </thead>
                <tbody>
                  {game.teams.map(team => {
                    const groupNumber = team.name.replace(/[^0-9]/g, '');
                    const firstTeamName = groupNumber === '1' ? 'A' : 'C';
                    const secondTeamName = groupNumber === '1' ? 'B' : 'D';
                    
                    const firstTeamPlayers = team.team_players.filter(tp => tp.team_name === firstTeamName);
                    const secondTeamPlayers = team.team_players.filter(tp => tp.team_name === secondTeamName);

                    // 각 홀별 점수 계산
                    const upDownScores = Array.from({ length: 18 }, (_, holeIndex) => {
                      const firstTeamScores = firstTeamPlayers.map(player => {
                        const playerIndex = players.findIndex(p => p.id === player.player.id);
                        return scores[playerIndex]?.[holeIndex];
                      });
                      const secondTeamScores = secondTeamPlayers.map(player => {
                        const playerIndex = players.findIndex(p => p.id === player.player.id);
                        return scores[playerIndex]?.[holeIndex];
                      });
                      
                      return calculateUpDownScore(firstTeamScores, secondTeamScores);
                    });

                    const totalFirstScore = upDownScores.reduce((sum, score) => sum + score.aScore, 0);
                    const totalSecondScore = upDownScores.reduce((sum, score) => sum + score.bScore, 0);

                    return (
                      <React.Fragment key={team.id}>
                        <tr>
                          <td rowSpan={2} style={{ padding: '4px 6px', verticalAlign: 'middle' }}>{groupNumber}</td>
                          <td className={`team-${firstTeamName.toLowerCase()}`} style={{ padding: '4px 6px' }}>{firstTeamName}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 'bold' }}>{totalFirstScore}</td>
                        </tr>
                        <tr>
                          <td className={`team-${secondTeamName.toLowerCase()}`} style={{ padding: '4px 6px' }}>{secondTeamName}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 'bold' }}>{totalSecondScore}</td>
                        </tr>
                      </React.Fragment>
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
                      <th key={i} style={{ minWidth: '45px', padding: '4px 4px' }}>{i + 1}H</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {game.teams.map(team => {
                    const groupNumber = team.name.replace(/[^0-9]/g, '');
                    const firstTeamName = groupNumber === '1' ? 'A' : 'C';
                    const secondTeamName = groupNumber === '1' ? 'B' : 'D';
                    
                    const firstTeamPlayers = team.team_players.filter(tp => tp.team_name === firstTeamName);
                    const secondTeamPlayers = team.team_players.filter(tp => tp.team_name === secondTeamName);

                    const upDownScores = Array.from({ length: 18 }, (_, holeIndex) => {
                      const firstTeamScores = firstTeamPlayers.map(player => {
                        const playerIndex = players.findIndex(p => p.id === player.player.id);
                        return scores[playerIndex]?.[holeIndex];
                      });
                      const secondTeamScores = secondTeamPlayers.map(player => {
                        const playerIndex = players.findIndex(p => p.id === player.player.id);
                        return scores[playerIndex]?.[holeIndex];
                      });
                      
                      return calculateUpDownScore(firstTeamScores, secondTeamScores);
                    });

                    return (
                      <React.Fragment key={team.id}>
                        <tr>
                          {upDownScores.map((score, holeIndex) => (
                            <td key={holeIndex} style={{ padding: '4px 4px', textAlign: 'center' }}>
                              {score.aScore}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          {upDownScores.map((score, holeIndex) => (
                            <td key={holeIndex} style={{ padding: '4px 4px', textAlign: 'center' }}>
                              {score.bScore}
                            </td>
                          ))}
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        <Link href="/" className="btn btn-outline" style={{ flex: 1 }}>
          리더보드
        </Link>
      </div>

      <NavBar />
    </div>
  );
} 