"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NavBar from '@/components/NavBar';
import * as XLSX from 'xlsx';

interface GameData {
  id: string;
  name: string;
  date: string;
  teams: {
    team_players: {
      player: {
        id: string;
        name: string;
      };
      scores: {
        hole_number: number;
        score: number;
      }[];
    }[];
  }[];
}

interface PlayerStats {
  player: {
    id: string;
    name: string;
  };
  averageScore: number;
  totalGames: number;
  gameScores: {
    gameName: string;
    totalScore: number;
  }[];
}

export default function StatsPage() {
  const [loading, setLoading] = useState(false);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select(`
          id,
          name,
          date,
          teams (
            team_players (
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
        .order('date', { ascending: false });

      if (gamesError) {
        console.error('Error fetching games:', gamesError);
        return;
      }

      // Process the data and calculate stats
      const games = (gamesData || []) as GameData[];
      const processedStats = calculatePlayerStats(games);
      setPlayerStats(processedStats);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error:', error.message);
      } else {
        console.error('An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const calculatePlayerStats = (games: GameData[]): PlayerStats[] => {
    const playerMap: { [key: string]: { name: string; totalScore: number; gamesPlayed: number; gameScores: { gameName: string; totalScore: number; }[] } } = {};

    games.forEach(game => {
      game.teams.forEach(team => {
        team.team_players.forEach(teamPlayer => {
          const playerId = teamPlayer.player.id;
          const playerName = teamPlayer.player.name;
          const gameScore = teamPlayer.scores.reduce((sum, score) => sum + score.score, 0);

          if (!playerMap[playerId]) {
            playerMap[playerId] = {
              name: playerName,
              totalScore: 0,
              gamesPlayed: 0,
              gameScores: []
            };
          }

          playerMap[playerId].totalScore += gameScore;
          playerMap[playerId].gamesPlayed++;
          playerMap[playerId].gameScores.push({
            gameName: game.name,
            totalScore: gameScore
          });
        });
      });
    });

    return Object.entries(playerMap).map(([id, data]) => ({
      player: { id, name: data.name },
      averageScore: Math.round((data.totalScore / data.gamesPlayed) * 10) / 10,
      totalGames: data.gamesPlayed,
      gameScores: data.gameScores
    }));
  };

  const downloadExcel = () => {
    try {
      // 엑셀 데이터 준비
      const excelData = playerStats.map(player => {
        const row: { [key: string]: string | number } = {
          '플레이어': player.player.name,
          '평균 스코어': player.averageScore,
          '참여 경기 수': player.totalGames
        };

        // 각 게임의 점수를 열로 추가
        player.gameScores.forEach(game => {
          row[game.gameName] = game.totalScore;
        });

        return row;
      });

      // 워크시트 생성
      const ws = XLSX.utils.json_to_sheet(excelData);

      // 열 너비 자동 조정
      const colWidths = Object.keys(excelData[0] || {}).map(key => ({
        wch: Math.max(key.length, ...excelData.map(row => String(row[key]).length))
      }));
      ws['!cols'] = colWidths;

      // 워크북 생성
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "전체 기록");

      // 파일 다운로드
      XLSX.writeFile(wb, "골프_전체기록.xlsx");
    } catch (error) {
      console.error('Excel download error:', error);
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    }
  };

  if (loading) return <div className="container">로딩 중...</div>;
  if (error) return <div className="container">에러: {error}</div>;

  return (
    <div className="container page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>📊 전체 기록</h1>
        <button 
          className="btn"
          onClick={downloadExcel}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          📥 엑셀 다운로드
        </button>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>플레이어</th>
                <th>평균 스코어</th>
                <th>참여 경기 수</th>
                {playerStats[0]?.gameScores.map(game => (
                  <th key={game.gameId} style={{ minWidth: '120px' }}>
                    {game.gameName}<br />
                    <span style={{ fontSize: '0.8em', color: 'var(--gray)' }}>
                      {new Date(game.gameDate).toLocaleDateString()}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {playerStats.map(player => (
                <tr key={player.player.id}>
                  <td>{player.player.name}</td>
                  <td>{player.averageScore}</td>
                  <td>{player.totalGames}</td>
                  {player.gameScores.map(game => (
                    <td key={game.gameId}>{game.totalScore}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <NavBar />
    </div>
  );
} 