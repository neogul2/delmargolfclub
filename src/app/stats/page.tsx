"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NavBar from '@/components/NavBar';
import * as XLSX from 'xlsx';

interface PlayerStats {
  name: string;
  avgScore: number;
  gamesPlayed: number;
  gameScores: {
    gameId: string;
    gameName: string;
    gameDate: string;
    score: number | null;
  }[];
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
      // 1. 모든 게임 정보 가져오기
      const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('id, name, date')
        .order('date', { ascending: false });

      if (gamesError) throw gamesError;

      // 2. 모든 플레이어와 점수 정보 가져오기
      const { data: playersData, error: playersError } = await supabase
        .from('team_players')
        .select(`
          player:players (
            id,
            name
          ),
          team:teams (
            game:games (
              id,
              name,
              date
            )
          ),
          scores (
            score
          )
        `);

      if (playersError) throw playersError;

      // 3. 플레이어별로 데이터 그룹화
      const playerMap = new Map();

      playersData.forEach(tp => {
        const player = tp.player;
        const gameId = tp.team.game.id;
        const gameName = tp.team.game.name;
        const gameDate = tp.team.game.date;
        const totalScore = tp.scores.reduce((sum, s) => sum + (s.score || 0), 0);

        if (!playerMap.has(player.id)) {
          playerMap.set(player.id, {
            name: player.name,
            gameScores: new Map(),
            totalScore: 0,
            gamesPlayed: 0
          });
        }

        const playerData = playerMap.get(player.id);
        playerData.gameScores.set(gameId, {
          gameId,
          gameName,
          gameDate,
          score: totalScore
        });
        playerData.totalScore += totalScore;
        playerData.gamesPlayed += 1;
      });

      // 4. 최종 통계 데이터 생성
      const playerStats: PlayerStats[] = [];

      playerMap.forEach((data, playerId) => {
        const gameScores = games.map(game => {
          const score = data.gameScores.get(game.id);
          return {
            gameId: game.id,
            gameName: game.name,
            gameDate: game.date,
            score: score ? score.score : null
          };
        });

        playerStats.push({
          name: data.name,
          avgScore: data.gamesPlayed > 0 ? Number((data.totalScore / data.gamesPlayed).toFixed(1)) : 0,
          gamesPlayed: data.gamesPlayed,
          gameScores
        });
      });

      // 5. 이름순으로 정렬
      playerStats.sort((a, b) => a.name.localeCompare(b.name));

      setStats(playerStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError(error instanceof Error ? error.message : '통계를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    try {
      // Excel 데이터 준비
      const excelData = stats.map(player => {
        const baseData = {
          '선수': player.name,
          '평균 스코어': player.avgScore,
          '참여 경기 수': player.gamesPlayed,
        };

        // 각 게임 스코어 추가
        player.gameScores.forEach(gs => {
          baseData[`${gs.gameName} (${new Date(gs.gameDate).toLocaleDateString()})`] = 
            gs.score !== null ? gs.score : 'N/A';
        });

        return baseData;
      });

      // Workbook 생성
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // 열 너비 자동 조정
      const colWidths = {};
      const maxWidth = 50;
      
      XLSX.utils.book_append_sheet(wb, ws, "전체기록");
      
      // 파일 저장
      XLSX.writeFile(wb, "델마골프클럽_전체기록.xlsx");
    } catch (error) {
      console.error('Error creating Excel file:', error);
      alert('Excel 파일 생성 중 오류가 발생했습니다.');
    }
  };

  if (loading) return <div className="container">로딩 중...</div>;
  if (error) return <div className="container">에러: {error}</div>;

  return (
    <div className="container page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>📊 전체기록</h1>
        <button onClick={handleDownloadExcel} className="btn">
          📥 Excel 다운로드
        </button>
      </div>

      <div className="stats-table-container">
        <table className="stats-table">
          <thead>
            <tr>
              <th>#</th>
              <th className="sticky-header">선수</th>
              <th className="sticky-header-2">평균</th>
              <th className="sticky-header-3">경기수</th>
              {stats[0]?.gameScores.map(game => (
                <th key={game.gameId}>
                  {game.gameName}<br />
                  <span className="game-date">{new Date(game.gameDate).toLocaleDateString()}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((player, index) => (
              <tr key={player.name}>
                <td>{index + 1}</td>
                <td className="sticky-col">{player.name}</td>
                <td className="sticky-col-2 center">{player.avgScore}</td>
                <td className="sticky-col-3 center">{player.gamesPlayed}</td>
                {player.gameScores.map(score => (
                  <td key={score.gameId} className={`center ${score.score === null ? 'na' : ''}`}>
                    {score.score !== null ? score.score : 'N/A'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NavBar />
    </div>
  );
} 