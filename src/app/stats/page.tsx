"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NavBar from '@/components/NavBar';
import * as XLSX from 'xlsx';

interface Score {
  hole_number: number;
  score: number;
}

interface TeamPlayer {
  id: string;
  player: {
    id: string;
    name: string;
  };
  scores: Score[];
}

interface Game {
  id: string;
  name: string;
  date: string;
  teams: {
    id: string;
    name: string;
    team_players: TeamPlayer[];
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
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // 1. 모든 게임 정보 가져오기
      const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('*')
        .order('date', { ascending: false });

      if (gamesError) throw gamesError;

      // 2. 모든 플레이어 가져오기
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*');

      if (playersError) throw playersError;

      // 3. 각 플레이어의 게임 기록 가져오기
      const stats = await Promise.all(players.map(async (player) => {
        const { data: scores, error: scoresError } = await supabase
          .from('scores')
          .select(`
            score,
            hole_number,
            game_id
          `)
          .eq('player_id', player.id);

        if (scoresError) throw scoresError;

        // 게임별 점수와 완료된 홀 수 계산
        const gameScores = games.map(game => {
          const gameScores = scores?.filter(s => s.game_id === game.id) || [];
          return {
            gameId: game.id,
            gameName: game.name,
            gameDate: game.date,
            totalScore: gameScores.reduce((sum, s) => sum + s.score, 0),
            completedHoles: gameScores.length
          };
        }).filter(game => game.completedHoles === 18);

        // 평균 점수 계산 (18홀이 완료된 게임만)
        const totalScore = gameScores.reduce((sum, game) => sum + game.totalScore, 0);
        const averageScore = gameScores.length > 0 ? totalScore / gameScores.length : 0;

        return {
          playerId: player.id,
          playerName: player.name,
          averageScore: Math.round(averageScore * 10) / 10,
          totalGames: gameScores.length,
          gameScores: gameScores
        };
      }));

      setPlayerStats(stats.filter(player => player.totalGames > 0));
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = () => {
    // 엑셀 데이터 준비
    const excelData = playerStats.map(player => {
      const row: any = {
        '플레이어': player.playerName,
        '평균 스코어': player.averageScore,
        '참여 경기 수': player.totalGames
      };

      // 각 게임의 점수를 열로 추가
      player.gameScores.forEach(game => {
        const gameTitle = `${game.gameName} (${new Date(game.gameDate).toLocaleDateString()})`;
        row[gameTitle] = game.totalScore;
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
                <tr key={player.playerId}>
                  <td>{player.playerName}</td>
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