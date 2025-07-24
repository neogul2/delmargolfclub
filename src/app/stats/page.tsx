'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NavBar from '@/components/NavBar';
import * as XLSX from 'xlsx';

interface Player {
  id: string;
  name: string;
}

interface Game {
  id: string;
  name: string;
  date: string;
}

interface SupabaseResponse {
  player: {
    id: string;
    name: string;
  };
  team: {
    id: string;
    name: string;
    game: {
      id: string;
      name: string;
      date: string;
    };
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
  gameScores: {
    [key: string]: {
      score: number;
      name: string;
      date: string;
    };
  };
  handicaps: {
    [key: string]: number;
  };
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

      // 핸디 데이터 가져오기 (에러가 발생해도 계속 진행)
      let handicapsData = null;
      try {
        const { data, error: handicapsError } = await supabase
          .from('player_handicaps')
          .select('player_name, game_name, game_date, handicap');
        
        if (!handicapsError) {
          handicapsData = data;
        }
      } catch (handicapsError) {
        console.log('핸디 데이터를 가져올 수 없습니다:', handicapsError);
      }

      const playerStatsMap = new Map<string, PlayerStats>();

      (playersData as unknown as SupabaseResponse[])?.forEach((tp) => {
        const player = tp.player;
        const game = tp.team.game;
        if (!player || !game) return;

        // 중복된 홀 번호 제거하고 유니크한 점수만 사용
        const uniqueScores = tp.scores.reduce((acc, score) => {
          if (score.score !== null && score.score !== undefined) {
            acc[score.hole_number] = score.score;
          }
          return acc;
        }, {} as { [key: number]: number });

        const totalScore = Object.values(uniqueScores).reduce((sum, score) => sum + score, 0);
        const completedHoles = Object.keys(uniqueScores).length;
        
        // 정확히 18홀이 완료된 게임만 포함
        if (completedHoles !== 18) {
          console.log(`제외된 플레이어: ${player.name}, 완료된 홀: ${completedHoles}/18`);
          return;
        }

        if (!playerStatsMap.has(player.name)) {
          playerStatsMap.set(player.name, {
            name: player.name,
            average: 0,
            gamesPlayed: 0,
            gameScores: {},
            handicaps: {},
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

      // 핸디 데이터 추가
      handicapsData?.forEach((handicap) => {
        const playerStats = playerStatsMap.get(handicap.player_name);
        if (playerStats) {
          const gameKey = `${handicap.game_name} (${handicap.game_date})`;
          playerStats.handicaps[gameKey] = handicap.handicap;
        }
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
                  const handicap = player.handicaps[gameDate];
                  
                  return (
                    <td key={gameDate} className={gameScore ? '' : 'na'}>
                      <div>{gameScore ? gameScore.score : 'N/A'}</div>
                      {handicap && (
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>핸디: {handicap}</div>
                      )}
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