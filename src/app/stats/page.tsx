'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NavBar from '@/components/NavBar';
import * as XLSX from 'xlsx';

interface Player {
  id: string;
  name: string;
}

interface Score {
  score: number;
  hole_number: number;
}

interface Game {
  id: string;
  name: string;
  date: string;
}

interface SupabaseResponse {
  player: Player;
  team: {
    id: string;
    name: string;
    game: Game;
  };
  scores: Array<{
    score: number | null;
    hole_number: number;
  }>;
}

interface PlayerStats {
  name: string;
  average: number;
  gamesPlayed: number;
  gameScores: { [key: string]: { score: number; name: string; date: string } };
}

export default function StatsPage() {
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: playersData, error: playersError } = await supabase
        .from('team_players')
        .select(`
          player:players (id, name),
          team:teams (
            id,
            name,
            game:games (
              id,
              name,
              date
            )
          ),
          scores (
            score,
            hole_number
          )
        `);

      if (playersError) throw playersError;

      const playerStatsMap = new Map<string, PlayerStats>();

      (playersData as unknown as SupabaseResponse[])?.forEach((tp) => {
        const player = tp.player;
        const game = tp.team.game;
        if (!player || !game) return;

        const totalScore = tp.scores.reduce((sum: number, s) => sum + (s.score || 0), 0);
        const completedHoles = tp.scores.filter((s) => s.score !== null).length;
        
        // 18홀이 완료된 게임만 포함
        if (completedHoles !== 18) return;

        if (!playerStatsMap.has(player.name)) {
          playerStatsMap.set(player.name, {
            name: player.name,
            average: 0,
            gamesPlayed: 0,
            gameScores: {}
          });
        }

        const playerStats = playerStatsMap.get(player.name)!;
        playerStats.gameScores[game.id] = {
          score: totalScore,
          name: game.name,
          date: game.date
        };
        
        const totalScores = Object.values(playerStats.gameScores).reduce((sum, g) => sum + g.score, 0);
        playerStats.gamesPlayed = Object.keys(playerStats.gameScores).length;
        playerStats.average = totalScores / playerStats.gamesPlayed;
      });

      const sortedStats = Array.from(playerStatsMap.values())
        .sort((a, b) => a.average - b.average);

      setStats(sortedStats);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError(error instanceof Error ? error.message : '통계를 불러오는데 실패했습니다.');
      setLoading(false);
    }
  };

  const downloadExcel = () => {
    // 데이터 준비
    const data = stats.map(player => {
      const row: Record<string, string | number> = {
        '선수': player.name,
        '평균': Number(player.average.toFixed(1)),
        '경기수': player.gamesPlayed,
      };

      // 각 게임 스코어 추가
      Object.values(player.gameScores).forEach(game => {
        row[`${game.name} (${game.date})`] = game.score;
      });

      return row;
    });

    // 워크시트 생성
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "전체기록");

    // 파일 다운로드
    XLSX.writeFile(wb, "델마 골프클럽 전체기록.xlsx");
  };

  if (loading) return <div className="container">로딩 중...</div>;
  if (error) return <div className="container">에러: {error}</div>;

  // 모든 게임 날짜를 수집하고 정렬
  const allGameDates = new Set<string>();
  stats.forEach(player => {
    Object.values(player.gameScores).forEach(game => {
      allGameDates.add(`${game.name} (${game.date})`);
    });
  });
  const sortedGameDates = Array.from(allGameDates).sort((a, b) => b.localeCompare(a));

  return (
    <div className="container page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>전체기록</h2>
        <button onClick={downloadExcel} className="btn">
          Excel 다운로드
        </button>
      </div>

      <div className="stats-table-container">
        <table className="stats-table">
          <thead>
            <tr>
              <th>#</th>
              <th>선수</th>
              <th>평균</th>
              <th>경기수</th>
              {sortedGameDates.map(gameDate => (
                <th key={gameDate}>{gameDate}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((player, index) => (
              <tr key={player.name}>
                <td>{index + 1}</td>
                <td>{player.name}</td>
                <td>{player.average.toFixed(1)}</td>
                <td>{player.gamesPlayed}</td>
                {sortedGameDates.map(gameDate => {
                  const gameScore = Object.values(player.gameScores).find(
                    game => `${game.name} (${game.date})` === gameDate
                  );
                  return (
                    <td key={gameDate} className={gameScore ? '' : 'na'}>
                      {gameScore ? gameScore.score : 'N/A'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <NavBar />
    </div>
  );
} 