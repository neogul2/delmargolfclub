"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import NavBar from "@/components/NavBar";
import Image from 'next/image';
import Link from "next/link";

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

interface LeaderboardPlayer {
  id: string;
  name: string;
  teamName: string;
  scores: {
    hole_number: number;
    score: number;
  }[];
}

interface GamePhoto {
  id: string;
  game_id: string;
  photo_url: string;
  created_at: string;
}

interface GameData {
  id: string;
  name: string;
  date: string;
  teams: {
    id: string;
    name: string;
    team_players: {
      id: string;
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
  const [games, setGames] = useState<Game[]>([]);
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
        
        const gamesWithScores = (gamesData || []) as GameData[];
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

  const getAllPlayers = (game: Game): LeaderboardPlayer[] => {
    return game.teams.flatMap(team => 
      team.team_players.map(tp => ({
        id: tp.player.id,
        name: tp.player.name,
        teamName: team.name,
        scores: tp.scores
      }))
    );
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
              <table>
                <thead>
                  <tr>
                    <th>순위</th>
                    <th>플레이어</th>
                    <th>조</th>
                    <th>Through</th>
                    <th>핸디캡</th>
                  </tr>
                </thead>
                <tbody>
                  {getAllPlayers(games.find(g => g.id === selectedGame)!)
                    .sort((a, b) => calculateTotal(a.scores) - calculateTotal(b.scores))
                    .map((player, index) => (
                      <tr key={player.id}>
                        <td>{index + 1}</td>
                        <td>{player.name}</td>
                        <td>{player.teamName}</td>
                        <td>{getCompletedHoles(player.scores)}</td>
                        <td className="handicap-score">
                          {calculateTotal(player.scores)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <NavBar />
    </div>
  );
}
