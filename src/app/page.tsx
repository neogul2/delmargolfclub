"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import NavBar from "@/components/NavBar";
import Image from 'next/image';
import Link from "next/link";

// 데이터 타입 정의 수정
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
  teamName: string;  // 1조, 2조 등
  team: string;      // A팀, B팀 등
  scores: Score[];
}

interface GamePhoto {
  id: string;
  game_id: string;
  photo_url: string;
  created_at: string;
}

interface ScoreStat {
  name: string;
  albatross: number[];  // -3 이하
  eagles: number[];     // -2
  birdies: number[];    // -1
  pars: number[];       // 0
  bogeys: number[];     // +1
  doubleBogeys: number[]; // +2 이상
  albatrossCount: number;
  eagleCount: number;
  birdieCount: number;
  parCount: number;
  bogeyCount: number;
  doubleBogeyCount: number;
}

// 팀 이름 생성 유틸리티 (new-game/page.tsx와 동일)
const getTeamNames = (): string[] => ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

// 업다운 게임 점수 계산 함수 추가
const calculateUpDownScore = (teamAScores: number[], teamBScores: number[]): { aScore: number, bScore: number } => {
  const validTeamAScores = teamAScores.filter(score => score !== null && score !== undefined);
  const validTeamBScores = teamBScores.filter(score => score !== null && score !== undefined);

  if (validTeamAScores.length === 0 || validTeamBScores.length === 0) {
    return { aScore: 0, bScore: 0 };
  }

  let aScore = 0;
  let bScore = 0;

  // 최저점 비교 (낮은 점수가 승리)
  const minA = Math.min(...validTeamAScores);
  const minB = Math.min(...validTeamBScores);
  if (minA < minB) aScore += 1;
  if (minB < minA) bScore += 1;
  
  // 최고점 비교 (낮은 점수가 승리)
  const maxA = Math.max(...validTeamAScores);
  const maxB = Math.max(...validTeamBScores);
  if (maxA < maxB) aScore += 1;
  if (maxB < maxA) bScore += 1;

  return { aScore, bScore };
};

interface SupabasePlayer {
  id: string;
  name: string;
}

interface SupabaseScore {
  hole_number: number;
  score: number;
}

interface SupabaseTeamPlayer {
  id: string;
  team_name: string;
  player: SupabasePlayer;
  scores: SupabaseScore[];
}

interface SupabaseTeam {
  id: string;
  name: string;
  team_players: SupabaseTeamPlayer[];
}

interface SupabaseGame {
  id: string;
  name: string;
  date: string;
  teams: SupabaseTeam[];
}

interface RawGameData {
  id: string;
  name: string;
  date: string;
  teams: {
    id: string;
    name: string;
    team_players: {
      id: string;
      team_name: string;
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

export default function Home() {
  const [games, setGames] = useState<GameData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [gamePhotos, setGamePhotos] = useState<{ [key: string]: GamePhoto[] }>({});

  // 게임의 사진 가져오기
  const fetchGamePhotos = async (gameId: string) => {
    try {
      const { data, error } = await supabase
        .from("game_photos")
        .select("*")
        .eq("game_id", gameId);

      if (error) throw error;
      setGamePhotos(prev => ({
        ...prev,
        [gameId]: data || []
      }));
    } catch (err) {
      console.error('Error fetching game photos:', err);
    }
  };

  // 게임이 선택될 때마다 사진 가져오기
  useEffect(() => {
    if (selectedGame) {
      fetchGamePhotos(selectedGame);
    }
  }, [selectedGame]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedGame) {
      alert('경기를 선택해주세요.');
      return;
    }

    // Check if there are already 2 photos for this game
    if (gamePhotos[selectedGame]?.length >= 2) {
      alert('한 경기당 최대 2장의 사진만 업로드할 수 있습니다.');
      return;
    }

    setUploadLoading(true);
    try {
      const { data: existingPhotos } = await supabase
        .from('game_photos')
        .select('id')
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
        const { data: gamesData, error } = await supabase
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

        const rawGames = (gamesData as unknown) as RawGameData[];
        const gamesWithScores = rawGames.map(game => ({
          id: game.id,
          name: game.name,
          date: game.date,
          teams: game.teams.map(team => ({
            id: team.id,
            name: team.name,
            team_players: team.team_players.map(tp => ({
              id: tp.id,
              team_name: tp.team_name,
              player: tp.player,
              scores: tp.scores
            }))
          }))
        }));

        setGames(gamesWithScores);
        
        if (gamesWithScores.length > 0) {
          setSelectedGame(gamesWithScores[0].id);
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error('Error:', error.message);
        } else {
          console.error('An unknown error occurred');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, []);

  const calculateTotal = (scores: { hole_number: number; score: number }[] = []): number => {
    return scores.reduce((sum, s) => sum + s.score, 0);
  };

  const getCompletedHoles = (scores: { hole_number: number; score: number }[] = []): string => {
    const completedHoles = scores.length;
    return `${completedHoles}/18`;
  };

  const getAllPlayers = (game: GameData): LeaderboardPlayer[] => {
    return game.teams.flatMap(team => 
      team.team_players.map(tp => {
        // 점수 배열 생성 (18홀)
        const scoreArray = Array(18).fill(null);
        // 기존 점수 입력
        tp.scores.forEach(s => {
          if (s.hole_number >= 1 && s.hole_number <= 18) {
            scoreArray[s.hole_number - 1] = s.score;
          }
        });
        // 실제 입력된 점수만 필터링
        const validScores = scoreArray
          .map((score, index) => ({
            hole_number: index + 1,
            score: score
          }))
          .filter(s => s.score !== null && s.score !== undefined);

        return {
          id: tp.player.id,
          name: tp.player.name,
          teamName: team.name,
          team: tp.team_name || '',
          scores: validScores
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
        .filter(([_, score]) => score <= -3)
        .map(([hole]) => parseInt(hole));
      
      const eagles = Object.entries(latestScores)
        .filter(([_, score]) => score === -2)
        .map(([hole]) => parseInt(hole));
      
      const birdies = Object.entries(latestScores)
        .filter(([_, score]) => score === -1)
        .map(([hole]) => parseInt(hole));
      
      const pars = Object.entries(latestScores)
        .filter(([_, score]) => score === 0)
        .map(([hole]) => parseInt(hole));
      
      const bogeys = Object.entries(latestScores)
        .filter(([_, score]) => score === 1)
        .map(([hole]) => parseInt(hole));
      
      const doubleBogeys = Object.entries(latestScores)
        .filter(([_, score]) => score >= 2)
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
        <h1 style={{ margin: 0 }}>⛳️ Delmar Men&apos;s Golf Club</h1>
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
          {selectedGame && gamePhotos[selectedGame]?.length > 0 && (
            <div className="game-photos">
              {gamePhotos[selectedGame]?.map((photo) => (
                <div key={photo.id} className="game-photo">
                  <Image
                    src={photo.photo_url}
                    alt={`${selectedGame} 경기 사진`}
                    width={200}
                    height={150}
                    className="rounded shadow"
                    style={{ objectFit: 'cover' }}
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

              {/* 팀 점수 표시 */}
              <div style={{ marginBottom: '2rem' }}>
                <h3>팀 점수</h3>
                <table>
                  <thead>
                    <tr>
                      <th>팀</th>
                      <th>선수</th>
                      <th>총점</th>
                      <th>업다운</th>
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

                        // 업다운 점수 계산
                        let upDownTotal = 0;
                        if (team) {
                          const groupNumber = team.name.replace(/[^0-9]/g, '');
                          const oppositeTeamName = teamName === 'A' ? 'B' : 
                                                 teamName === 'B' ? 'A' :
                                                 teamName === 'C' ? 'D' : 'C';

                          // 각 홀별로 점수 계산
                          for (let hole = 0; hole < 18; hole++) {
                            const teamScores = team.team_players
                              .filter(tp => tp.team_name === teamName)
                              .map(tp => tp.scores.find(s => s.hole_number === hole + 1)?.score)
                              .filter(score => score !== null && score !== undefined) as number[];

                            const oppositeTeamScores = team.team_players
                              .filter(tp => tp.team_name === oppositeTeamName)
                              .map(tp => tp.scores.find(s => s.hole_number === hole + 1)?.score)
                              .filter(score => score !== null && score !== undefined) as number[];

                            if (teamName === 'A' || teamName === 'C') {
                              upDownTotal += calculateUpDownScore(teamScores, oppositeTeamScores).aScore;
                            } else {
                              upDownTotal += calculateUpDownScore(oppositeTeamScores, teamScores).bScore;
                            }
                          }
                        }
                        
                        return (
                          <tr key={teamName}>
                            <td className={`team-${teamName.toLowerCase()}`}>{teamName}</td>
                            <td>{playerNames}</td>
                            <td>{teamTotal}</td>
                            <td>{upDownTotal}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* 개인 점수 표시 */}
              <h3>개인 점수</h3>
              <table>
                <thead>
                  <tr>
                    <th>순위</th>
                    <th>플레이어</th>
                    <th>조</th>
                    <th>팀</th>
                    <th>Through</th>
                    <th>핸디캡</th>
                  </tr>
                </thead>
                <tbody>
                  {getAllPlayers(games.find(g => g.id === selectedGame)!)
                    .sort((a, b) => calculateTotal(a.scores) - calculateTotal(b.scores))
                    .map((player, index) => {
                      const groupNumber = player.teamName.replace(/[^0-9]/g, '');
                      return (
                        <tr key={player.id}>
                          <td>{index + 1}</td>
                          <td>{player.name}</td>
                          <td>{groupNumber}</td>
                          <td className={`team-${player.team.toLowerCase()}`}>{player.team}</td>
                          <td>{getCompletedHoles(player.scores)}</td>
                          <td className="handicap-score">
                            {calculateTotal(player.scores)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              {/* 스코어 현황 요약 */}
              <div style={{ 
                marginTop: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                fontSize: '0.9rem',
                color: '#4a5568'
              }}>
                {(() => {
                  const stats = getScoreStats(getAllPlayers(games.find(g => g.id === selectedGame)!));
                  
                  // 각 타입별로 플레이어 정보를 객체로 변환하고 개수로 정렬
                  const formatSummary = (players: { name: string; count: number; holes: number[] }[]): string => {
                    return players
                      .sort((a, b) => b.count - a.count)
                      .map(p => `${p.name} ${p.count}개 (Hole ${p.holes.join(', ')})`)
                      .join(', ');
                  };

                  const summaries = {
                    albatross: stats
                      .filter(s => s.albatrossCount > 0)
                      .map(s => ({ 
                        name: s.name, 
                        count: s.albatrossCount, 
                        holes: s.albatross 
                      })),
                    eagle: stats
                      .filter(s => s.eagleCount > 0)
                      .map(s => ({ 
                        name: s.name, 
                        count: s.eagleCount, 
                        holes: s.eagles 
                      })),
                    birdie: stats
                      .filter(s => s.birdieCount > 0)
                      .map(s => ({ 
                        name: s.name, 
                        count: s.birdieCount, 
                        holes: s.birdies 
                      })),
                    par: stats
                      .filter(s => s.parCount > 0)
                      .map(s => ({ 
                        name: s.name, 
                        count: s.parCount, 
                        holes: s.pars 
                      })),
                    bogey: stats
                      .filter(s => s.bogeyCount > 0)
                      .map(s => ({ 
                        name: s.name, 
                        count: s.bogeyCount, 
                        holes: s.bogeys 
                      }))
                  };

                  return (
                    <>
                      {summaries.albatross.length > 0 && (
                        <div>알바트로스: {formatSummary(summaries.albatross)}</div>
                      )}
                      {summaries.eagle.length > 0 && (
                        <div>이글: {formatSummary(summaries.eagle)}</div>
                      )}
                      {summaries.birdie.length > 0 && (
                        <div>버디: {formatSummary(summaries.birdie)}</div>
                      )}
                      {summaries.par.length > 0 && (
                        <div>파: {formatSummary(summaries.par)}</div>
                      )}
                      {summaries.bogey.length > 0 && (
                        <div>보기: {formatSummary(summaries.bogey)}</div>
                      )}
                    </>
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
