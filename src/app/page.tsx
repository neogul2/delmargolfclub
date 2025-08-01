"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import NavBar from "@/components/NavBar";
import Image from 'next/image';
import Link from "next/link";

// 기본 타입 정의
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

interface GameData {
  id: string;
  name: string;
  date: string;
  teams: Team[];
}

interface LeaderboardPlayer {
  id: string;
  name: string;
  teamName: string;
  team: string;
  scores: Score[];
}

interface ScoreStat {
  name: string;
  albatross: number[];
  eagles: number[];
  birdies: number[];
  pars: number[];
  bogeys: number[];
  doubleBogeys: number[];
  albatrossCount: number;
  eagleCount: number;
  birdieCount: number;
  parCount: number;
  bogeyCount: number;
  doubleBogeyCount: number;
}

interface GamePhoto {
  id: string;
  game_id: string;
  photo_url: string;
  created_at: string;
}

interface RawGameData {
  id: string | number;
  name: string;
  date: string;
  teams: RawTeamData[];
}

interface RawTeamData {
  id: string | number;
  name: string;
  team_players: RawTeamPlayerData[];
}

interface RawTeamPlayerData {
  id: string | number;
  team_name: string;
  player: Player;
  scores: RawScoreData[];
}

interface RawScoreData {
  hole_number: number;
  score: number;
}

// 업다운 게임 점수 계산 함수
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

export default function Home() {
  const [games, setGames] = useState<GameData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [gamePhotos, setGamePhotos] = useState<GamePhoto[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [upDownScores, setUpDownScores] = useState<{[key: string]: number}>({});
  const [playerAverages, setPlayerAverages] = useState<{[key: string]: number}>({});

  // 게임의 사진 가져오기
  const fetchGamePhotos = async (gameId: string) => {
    try {
      const { data, error } = await supabase
        .from('game_photos')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching photos:', error);
        return;
      }

      setGamePhotos(data || []);
    } catch (error) {
      console.error('Error fetching photos:', error);
    }
  };

  // 게임이 선택될 때마다 사진 가져오기
  useEffect(() => {
    if (selectedGame) {
      fetchGamePhotos(selectedGame);
      fetchUpDownScores(selectedGame);
      fetchPlayerAverages(); // 게임 선택 시 평균 계산
    }
  }, [selectedGame]);

  // 업다운 점수 가져오기
  const fetchUpDownScores = async (gameId: string) => {
    try {
      const { data, error } = await supabase
        .from('updown_scores')
        .select('team_name, score')
        .eq('game_id', gameId);

      if (error) {
        console.error('Error fetching updown scores:', error);
        return;
      }

      const scoresMap: {[key: string]: number} = {};
      data?.forEach(item => {
        scoresMap[item.team_name] = item.score;
      });

      setUpDownScores(scoresMap);
    } catch (error) {
      console.error('Error fetching updown scores:', error);
    }
  };

  // 전체기록 페이지와 동일한 방식으로 평균 계산
  const fetchPlayerAverages = async () => {
    try {
      // 먼저 localStorage에서 필터링된 평균을 확인
      const storedAverages = localStorage.getItem('filteredPlayerAverages');
      if (storedAverages) {
        const parsedAverages = JSON.parse(storedAverages);
        setPlayerAverages(parsedAverages);
        return; // 필터링된 평균이 있으면 그것을 사용
      }

      // 필터링된 평균이 없으면 기존 방식으로 계산
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

      const playerStatsMap = new Map<string, { totalScore: number; gamesPlayed: number }>();

      (playersData as any[])?.forEach((tp) => {
        const player = tp.player;
        const game = tp.team.game;
        if (!player || !game) return;

        // 중복된 홀 번호 제거하고 유니크한 점수만 사용
        const uniqueScores = tp.scores.reduce((acc: { [key: number]: number }, score: any) => {
          if (score.score !== null && score.score !== undefined) {
            acc[score.hole_number] = score.score;
          }
          return acc;
        }, {});

        const totalScore = Object.values(uniqueScores).reduce((sum: number, score: any) => sum + (score as number), 0);
        const completedHoles = Object.keys(uniqueScores).length;
        
        // 정확히 18홀이 완료된 게임만 포함
        if (completedHoles !== 18) {
          return;
        }

        if (!playerStatsMap.has(player.name)) {
          playerStatsMap.set(player.name, { totalScore: 0, gamesPlayed: 0 });
        }

        const playerStats = playerStatsMap.get(player.name)!;
        playerStats.totalScore += totalScore;
        playerStats.gamesPlayed += 1;
      });

      const averages: {[key: string]: number} = {};
      playerStatsMap.forEach((stats, playerName) => {
        if (stats.gamesPlayed > 0) {
          averages[playerName] = stats.totalScore / stats.gamesPlayed;
        }
      });

      setPlayerAverages(averages);
    } catch (error) {
      console.error('Error fetching player averages:', error);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedGame) return;

    setUploadLoading(true);
    try {
      // Check existing photos
      const { data: existingPhotos } = await supabase
        .from('game_photos')
        .select('*')
        .eq('game_id', selectedGame);

      if (existingPhotos && existingPhotos.length >= 2) {
        alert('한 경기당 최대 2장의 사진만 업로드할 수 있습니다.');
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedGame}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('game-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('game-photos')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('game_photos')
        .insert([
          {
            game_id: selectedGame,
            photo_url: publicUrl
          }
        ]);

      if (dbError) throw dbError;

      // Refresh photos
      fetchGamePhotos(selectedGame);
      alert('사진이 업로드되었습니다.');
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert(error instanceof Error ? error.message : '사진 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploadLoading(false);
    }
  };

  useEffect(() => {
    const fetchGames = async () => {
      setLoading(true);
      try {
        const { data: rawData, error } = await supabase
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
          .order('date', { ascending: false });

        if (error) {
          console.error('Error fetching games:', error);
          return;
        }

        if (!rawData) {
          setGames([]);
          return;
        }

        const transformedGames = rawData.map((game: RawGameData) => ({
          id: String(game.id || ''),
          name: String(game.name || ''),
          date: String(game.date || ''),
          teams: Array.isArray(game.teams) ? game.teams.map((team: RawTeamData) => ({
            id: String(team.id || ''),
            name: String(team.name || ''),
            team_players: Array.isArray(team.team_players) ? team.team_players.map((tp: RawTeamPlayerData) => ({
              id: String(tp.id || ''),
              team_name: String(tp.team_name || ''),
              player: {
                id: String(tp.player?.id || ''),
                name: String(tp.player?.name || '')
              },
              scores: Array.isArray(tp.scores) ? tp.scores.map((s: RawScoreData) => ({
                hole_number: Number(s.hole_number || 0),
                score: Number(s.score || 0)
              })) : []
            })) : []
          })) : []
        }));

        setGames(transformedGames);
        
        // 첫 번째 게임을 자동으로 선택
        if (transformedGames.length > 0 && !selectedGame) {
          setSelectedGame(transformedGames[0].id);
        }
      } catch (error) {
        console.error('Error fetching games:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, []); // 빈 의존성 배열로 변경

  if (loading) {
    return <div className="container">로딩 중...</div>;
  }

  const calculateTotal = (scores: { hole_number: number; score: number }[] = []): number => {
    return scores.reduce((total, score) => total + score.score, 0);
  };

  const getCompletedHoles = (scores: { hole_number: number; score: number }[] = []): string => {
    return scores.length > 0 ? `${scores.length}홀` : '0홀';
  };

  // 핸디와 평균 대비 증감을 표시하는 함수
  const getHandicapWithChange = (playerName: string, currentHandicap: number): string => {
    const average = playerAverages[playerName];
    if (!average) {
      return currentHandicap.toString();
    }
    
    const difference = currentHandicap - average;
    if (difference === 0) {
      return `${currentHandicap}(0)`;
    } else if (difference > 0) {
      return `${currentHandicap}(+${difference})`;
    } else {
      return `${currentHandicap}(${difference})`;
    }
  };

  // 핸디 증감에 따른 스타일을 반환하는 함수
  const getHandicapStyle = (playerName: string, currentHandicap: number) => {
    const average = playerAverages[playerName];
    if (!average) {
      return {};
    }
    
    const difference = currentHandicap - average;
    if (difference === 0) {
      return {};
    } else if (difference > 0) {
      return { color: '#e53e3e', backgroundColor: '#fed7d7' }; // 파스텔톤 빨간색
    } else {
      return { color: '#3182ce', backgroundColor: '#bee3f8' }; // 파스텔톤 파란색
    }
  };

  // 플레이어의 평균 점수 계산 함수
  const getPlayerAverage = (playerName: string): string => {
    try {
      // 모든 게임에서 해당 플레이어의 점수 수집
      const playerScores: number[] = [];
      
      games.forEach(game => {
        const player = getAllPlayers(game).find(p => p.name === playerName);
        if (player && player.scores.length === 18) { // 18홀 완료된 게임만
          const totalScore = calculateTotal(player.scores);
          playerScores.push(totalScore);
        }
      });
      
      if (playerScores.length === 0) {
        return 'N/A';
      }
      
      const average = playerScores.reduce((sum, score) => sum + score, 0) / playerScores.length;
      return average.toFixed(1);
    } catch (error) {
      return 'N/A';
    }
  };

  const getAllPlayers = (game: GameData): LeaderboardPlayer[] => {
    return game.teams.flatMap(team =>
      team.team_players.map(tp => {
        // 각 홀별로 가장 최근의 스코어만 사용
        const validScores = tp.scores.reduce((acc, curr) => {
          acc[curr.hole_number] = curr;
          return acc;
        }, {} as { [key: number]: Score });

        return {
          id: tp.player.id,
          name: tp.player.name,
          teamName: team.name,
          team: tp.team_name || '',
          scores: Object.values(validScores)
        };
      })
    );
  };

  const getScoreStats = (players: LeaderboardPlayer[]): ScoreStat[] => {
    return players.map(player => {
      // 각 홀별로 가장 최근의 스코어만 사용
      const latestScores = player.scores.reduce((acc, curr) => {
        acc[curr.hole_number] = curr.score;
        return acc;
      }, {} as { [key: number]: number });

      // 스코어별로 홀 분류
      const albatross = Object.entries(latestScores)
        .filter(([, score]) => score <= -3)
        .map(([hole]) => parseInt(hole));
      
      const eagles = Object.entries(latestScores)
        .filter(([, score]) => score === -2)
        .map(([hole]) => parseInt(hole));
      
      const birdies = Object.entries(latestScores)
        .filter(([, score]) => score === -1)
        .map(([hole]) => parseInt(hole));
      
      const pars = Object.entries(latestScores)
        .filter(([, score]) => score === 0)
        .map(([hole]) => parseInt(hole));
      
      const bogeys = Object.entries(latestScores)
        .filter(([, score]) => score === 1)
        .map(([hole]) => parseInt(hole));
      
      const doubleBogeys = Object.entries(latestScores)
        .filter(([, score]) => score >= 2)
        .map(([hole]) => parseInt(hole));

      return {
        name: player.name,
        albatross,
        eagles,
        birdies,
        pars,
        bogeys,
        doubleBogeys,
        albatrossCount: albatross.length,
        eagleCount: eagles.length,
        birdieCount: birdies.length,
        parCount: pars.length,
        bogeyCount: bogeys.length,
        doubleBogeyCount: doubleBogeys.length
      };
    });
  };

  return (
    <div className="container page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>⛳️ Delmar Men&apos;s Golf Club</h1>
      </div>

      {loading ? (
        <div className="card">
          <p>로딩 중...</p>
        </div>
      ) : games.length === 0 ? (
        <div className="card">
          <p>아직 등록된 경기가 없습니다.</p>
          <p>새 경기를 생성해보세요!</p>
        </div>
      ) : (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <select 
              className="input" 
              value={selectedGame || ''} 
              onChange={(e) => setSelectedGame(e.target.value)}
              style={{ margin: 0, flex: 1 }}
            >
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name} ({new Date(game.date).toLocaleDateString()})
                </option>
              ))}
            </select>
            <label className="btn btn-outline" style={{ margin: 0, cursor: 'pointer' }}>
              {uploadLoading ? "업로드 중..." : "📸 사진 업로드"}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                disabled={uploadLoading}
              />
            </label>
          </div>

          {/* 현재 게임의 사진 표시 */}
          {selectedGame && gamePhotos.length > 0 && (
            <div className="game-photos" style={{ marginBottom: '2rem' }}>
              {gamePhotos?.map((photo) => (
                <div key={photo.id} className="game-photo">
                  <Image
                    src={photo.photo_url}
                    alt={`${selectedGame} 경기 사진`}
                    width={200}
                    height={150}
                    className="rounded shadow"
                    style={{ objectFit: 'cover' }}
                    unoptimized
                  />
                </div>
              ))}
            </div>
          )}

          {selectedGame && games.find(g => g.id === selectedGame) && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>리더보드</h2>
                <Link 
                  href={`/game/${selectedGame}`} 
                  className="btn"
                  style={{ padding: '0.5rem' }}
                >
                  점수입력
                </Link>
              </div>

              {/* 개인 점수 표시 (가장 위로) */}
              <div style={{ marginBottom: '2rem' }}>
                <h3>개인 점수</h3>
                <div className="table-container">
                  <table style={{ fontSize: '0.95rem', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '0.6rem', width: '8%' }}>순위</th>
                        <th style={{ padding: '0.6rem', width: '20%' }}>플레이어</th>
                        <th style={{ padding: '0.6rem', width: '8%' }}>조</th>
                        <th style={{ padding: '0.6rem', width: '12%' }}>팀</th>
                        <th style={{ padding: '0.6rem', width: '15%' }}>Through</th>
                        <th style={{ padding: '0.6rem', width: '15%' }}>핸디(증감)</th>
                        <th style={{ padding: '0.6rem', width: '12%' }}>평균</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getAllPlayers(games.find(g => g.id === selectedGame)!)
                        .sort((a, b) => calculateTotal(a.scores) - calculateTotal(b.scores))
                        .map((player, index) => {
                          const groupNumber = player.teamName.replace(/[^0-9]/g, '');
                          return (
                            <tr key={player.id}>
                              <td style={{ padding: '0.6rem' }}>{index + 1}</td>
                              <td style={{ padding: '0.6rem' }}>{player.name}</td>
                              <td style={{ padding: '0.6rem' }}>{groupNumber}</td>
                              <td className={`team-${player.team.toLowerCase()}`} style={{ padding: '0.6rem' }}>{player.team}</td>
                              <td style={{ padding: '0.6rem' }}>{getCompletedHoles(player.scores)}</td>
                              <td style={{ padding: '0.6rem', ...getHandicapStyle(player.name, calculateTotal(player.scores)) }}>{getHandicapWithChange(player.name, calculateTotal(player.scores))}</td>
                              <td style={{ padding: '0.6rem' }}>{playerAverages[player.name] ? playerAverages[player.name].toFixed(1) : 'N/A'}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 팀 점수 표시 */}
              <div style={{ marginBottom: '2rem' }}>
                <h3>팀 점수</h3>
                <div className="table-container">
                  <table style={{ fontSize: '0.95rem', width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '0.6rem', width: '15%' }}>팀</th>
                        <th style={{ padding: '0.6rem', width: '45%' }}>선수</th>
                        <th style={{ padding: '0.6rem', width: '20%' }}>총점</th>
                        <th style={{ padding: '0.6rem', width: '20%' }}>업다운</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(new Set(getAllPlayers(games.find(g => g.id === selectedGame)!).map(p => p.team)))
                        .sort()
                        .map(teamName => {
                          const game = games.find(g => g.id === selectedGame)!;
                          const team = game.teams.find(t => 
                            t.team_players.some(tp => tp.team_name === teamName)
                          );
                          
                          // 팀 플레이어와 점수 정보
                          const teamPlayers = getAllPlayers(game).filter(p => p.team === teamName);
                          const playerNames = teamPlayers.map(p => p.name).join(', ');
                          const teamTotal = teamPlayers.reduce((sum, p) => sum + calculateTotal(p.scores), 0);

                          // 업다운 점수는 저장된 값 사용
                          
                          return (
                            <tr key={teamName}>
                              <td className={`team-${teamName.toLowerCase()}`} style={{ padding: '0.6rem' }}>{teamName}</td>
                              <td style={{ padding: '0.6rem' }}>{playerNames}</td>
                              <td style={{ padding: '0.6rem' }}>{teamTotal}</td>
                              <td style={{ padding: '0.6rem' }}>{upDownScores[teamName] || 0}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 스코어 현황 요약 (EBPB) */}
              <div style={{ 
                marginTop: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                fontSize: '0.9rem',
                color: '#4a5568'
              }}>
                <h3>🦅🐦⛳️🏌️ 현황</h3>
                {(() => {
                  const stats = getScoreStats(getAllPlayers(games.find(g => g.id === selectedGame)!));
                  
                  // 각 타입별로 플레이어 정보를 객체로 변환하고 개수로 정렬
                  const formatSummary = (players: { name: string; count: number; holes: number[] }[]): string => {
                    return players
                      .sort((a, b) => b.count - a.count)
                      .map(p => `- ${p.name} ${p.count}개 (Hole ${p.holes.join(', ')})`)
                      .join('\n');
                  };

                  const summaries = {
                    albatross: stats
                      .filter(s => s.albatrossCount > 0)
                      .map(s => ({ 
                        name: s.name, 
                        count: s.albatrossCount, 
                        holes: s.albatross 
                      })),
                    eagles: stats
                      .filter(s => s.eagleCount > 0)
                      .map(s => ({ 
                        name: s.name, 
                        count: s.eagleCount, 
                        holes: s.eagles 
                      })),
                    birdies: stats
                      .filter(s => s.birdieCount > 0)
                      .map(s => ({ 
                        name: s.name, 
                        count: s.birdieCount, 
                        holes: s.birdies 
                      })),
                    pars: stats
                      .filter(s => s.parCount > 0)
                      .map(s => ({ 
                        name: s.name, 
                        count: s.parCount, 
                        holes: s.pars 
                      })),
                    bogeys: stats
                      .filter(s => s.bogeyCount > 0)
                      .map(s => ({ 
                        name: s.name, 
                        count: s.bogeyCount, 
                        holes: s.bogeys 
                      }))
                  };

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {summaries.albatross.length > 0 && (
                        <div>
                          <strong>알바트로스</strong>
                          <div style={{ marginLeft: '1rem', whiteSpace: 'pre-line' }}>
                            {formatSummary(summaries.albatross)}
                          </div>
                        </div>
                      )}
                      {summaries.eagles.length > 0 && (
                        <div>
                          <strong>이글</strong>
                          <div style={{ marginLeft: '1rem', whiteSpace: 'pre-line' }}>
                            {formatSummary(summaries.eagles)}
                          </div>
                        </div>
                      )}
                      {summaries.birdies.length > 0 && (
                        <div>
                          <strong>버디</strong>
                          <div style={{ marginLeft: '1rem', whiteSpace: 'pre-line' }}>
                            {formatSummary(summaries.birdies)}
                          </div>
                        </div>
                      )}
                      {summaries.pars.length > 0 && (
                        <div>
                          <strong>파</strong>
                          <div style={{ marginLeft: '1rem', whiteSpace: 'pre-line' }}>
                            {formatSummary(summaries.pars)}
                          </div>
                        </div>
                      )}
                      {summaries.bogeys.length > 0 && (
                        <div>
                          <strong>보기</strong>
                          <div style={{ marginLeft: '1rem', whiteSpace: 'pre-line' }}>
                            {formatSummary(summaries.bogeys)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}
      
      <NavBar />
    </div>
  );
}
