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
  const [showSettings, setShowSettings] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [settings, setSettings] = useState({
    hiddenPlayers: new Set<string>(),
    hiddenGames: new Set<string>()
  });

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

  // 설정 적용 함수
  const applySettings = (newSettings: { hiddenPlayers: Set<string>; hiddenGames: Set<string> }) => {
    setSettings(newSettings);
    setShowSettings(false);
  };

  // 비밀번호 확인
  const handlePasswordSubmit = () => {
    if (password === '92130') {
      setShowSettings(true);
      setShowPasswordModal(false);
      setPassword('');
      setPasswordError('');
    } else {
      setPasswordError('비밀번호가 올바르지 않습니다.');
    }
  };

  // 선수 토글 함수
  const togglePlayer = (playerName: string) => {
    const newHiddenPlayers = new Set(settings.hiddenPlayers);
    if (newHiddenPlayers.has(playerName)) {
      newHiddenPlayers.delete(playerName);
    } else {
      newHiddenPlayers.add(playerName);
    }
    setSettings(prev => ({ ...prev, hiddenPlayers: newHiddenPlayers }));
  };

  // 경기 토글 함수
  const toggleGame = (gameDate: string) => {
    const newHiddenGames = new Set(settings.hiddenGames);
    if (newHiddenGames.has(gameDate)) {
      newHiddenGames.delete(gameDate);
    } else {
      newHiddenGames.add(gameDate);
    }
    setSettings(prev => ({ ...prev, hiddenGames: newHiddenGames }));
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

  // 필터링된 데이터 계산
  const filteredStats = stats.filter(player => !settings.hiddenPlayers.has(player.name));
  const filteredGameDates = sortedGameDates.filter(gameDate => !settings.hiddenGames.has(gameDate));

  return (
    <div className="container page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>전체기록</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setShowPasswordModal(true)} className="btn btn-outline">
            설정
          </button>
          <button onClick={downloadExcel} className="btn">
            Excel 다운로드
          </button>
        </div>
      </div>

      {/* 비밀번호 모달 */}
      {showPasswordModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            minWidth: '300px'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>비밀번호 입력</h3>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              style={{
                width: '100%',
                padding: '0.5rem',
                marginBottom: '1rem',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            />
            {passwordError && (
              <div style={{ color: 'red', marginBottom: '1rem' }}>{passwordError}</div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowPasswordModal(false)} className="btn btn-outline">
                취소
              </button>
              <button onClick={handlePasswordSubmit} className="btn">
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 설정 모달 */}
      {showSettings && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            minWidth: '400px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>표시 설정</h3>
            
            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>선수 선택</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem' }}>
                {stats.map(player => (
                  <label key={player.name} style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!settings.hiddenPlayers.has(player.name)}
                      onChange={() => togglePlayer(player.name)}
                      style={{ marginRight: '0.5rem' }}
                    />
                    {player.name}
                  </label>
                ))}
              </div>
            </div>
            
            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>경기 선택</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>
                {sortedGameDates.map(gameDate => (
                  <label key={gameDate} style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!settings.hiddenGames.has(gameDate)}
                      onChange={() => toggleGame(gameDate)}
                      style={{ marginRight: '0.5rem' }}
                    />
                    {gameDate}
                  </label>
                ))}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSettings(false)} className="btn btn-outline">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="stats-table-container">
        <table className="stats-table">
          <thead>
            <tr>
              <th>#</th>
              <th>선수</th>
              <th>평균</th>
              <th>경기수</th>
              {filteredGameDates.map(gameDate => {
                // 경기명과 날짜를 분리하여 줄바꿈 형식으로 표시
                const match = gameDate.match(/^(.+?) \((.+)\)$/);
                const gameName = match ? match[1] : gameDate;
                const gameDateOnly = match ? match[2] : '';
                
                return (
                  <th key={gameDate} className="game-date">
                    {gameName}
                    {gameDateOnly && `\n${gameDateOnly}`}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredStats.map((player, index) => (
              <tr key={player.name}>
                <td>{index + 1}</td>
                <td>{player.name}</td>
                <td>{player.average.toFixed(1)}</td>
                <td>{player.gamesPlayed}</td>
                {filteredGameDates.map(gameDate => {
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