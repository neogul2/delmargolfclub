"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import NavBar from "@/components/NavBar";
import PasswordModal from "@/components/PasswordModal";
import Link from 'next/link';

interface PlayerInput {
  name: string;
}

export default function NewGamePage() {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [teamCount, setTeamCount] = useState(1);
  const [players, setPlayers] = useState<PlayerInput[][]>([Array(4).fill({ name: '' })]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const handleTeamCountChange = (count: number) => {
    setTeamCount(count);
    setPlayers(Array.from({ length: count }, () => Array(4).fill({ name: "" })));
  };

  const handlePlayerChange = (teamIdx: number, playerIdx: number, value: string) => {
    setPlayers((prev) => {
      const copy = prev.map(team => team.map(player => ({...player})));
      copy[teamIdx][playerIdx] = { name: value };
      return copy;
    });
  };

  const handleSubmitClick = (e: React.FormEvent) => {
    e.preventDefault();
    setShowPasswordModal(true);
  };

  const validatePlayers = () => {
    let hasError = false;
    for (let i = 0; i < teamCount; i++) {
      for (let j = 0; j < 4; j++) {
        if (!players[i][j].name.trim()) {
          setError(`팀 ${i + 1}의 플레이어 ${j + 1} 이름을 입력해주세요.`);
          hasError = true;
          break;
        }
      }
      if (hasError) break;
    }
    return hasError;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const hasError = validatePlayers();
    if (hasError) return;
    
    setLoading(true);
    try {
      // 1. 경기 생성
      const { data: game, error: gameError } = await supabase
        .from("games")
        .insert([{ name, date }])
        .select()
        .single();

      if (gameError) throw gameError;
      if (!game) throw new Error("경기 생성 실패");

      // 2. 조/플레이어 생성
      for (let i = 0; i < teamCount; i++) {
        const { data: team, error: teamError } = await supabase
          .from("teams")
          .insert([{ game_id: game.id, name: `${i + 1}조` }])
          .select()
          .single();

        if (teamError) throw teamError;
        if (!team) continue;

        for (let j = 0; j < 4; j++) {
          const playerName = players[i][j].name.trim();
          if (!playerName) continue;

          // 플레이어 생성 또는 기존 플레이어 찾기
          let { data: player, error: playerError } = await supabase
            .from("players")
            .select("*")
            .eq("name", playerName)
            .single();

          if (playerError) {
            // 없으면 새로 생성
            const { data: newPlayer, error: newPlayerError } = await supabase
              .from("players")
              .insert([{ name: playerName }])
              .select()
              .single();

            if (newPlayerError) throw newPlayerError;
            player = newPlayer;
          }

          // 조-플레이어 연결
          const { error: teamPlayerError } = await supabase
            .from("team_players")
            .insert({ team_id: team.id, player_id: player.id });

          if (teamPlayerError) throw teamPlayerError;
        }
      }
      setSuccess(true);
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleError = (error: Error) => {
    console.error('Error:', error.message);
    setError(error.message);
  };

  return (
    <div className="container page-container">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>새 경기 생성</h1>
      </div>

      {error && (
        <div className="card error">
          <p>{error}</p>
        </div>
      )}

      {success ? (
        <div className="card success">
          <h2>🎉 경기 생성 완료!</h2>
          <p>새로운 경기가 성공적으로 생성되었습니다.</p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <Link href="/" className="btn btn-secondary">
              취소
            </Link>
            <button 
              className="btn btn-outline"
              onClick={() => {
                setSuccess(false);
                setName("");
                setDate("");
                setTeamCount(1);
                setPlayers([Array(4).fill({ name: "" })]);
              }}
            >
              새 경기 추가
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmitClick}>
          <div className="card">
            <div style={{ marginBottom: '1.5rem' }}>
              <label>
                <div style={{ marginBottom: '0.5rem' }}>경기명</div>
                <input
                  className="input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="예: 7월 정기 라운드"
                  required
                />
              </label>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label>
                <div style={{ marginBottom: '0.5rem' }}>날짜</div>
                <input
                  className="input"
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                />
              </label>
            </div>

            <div>
              <label>
                <div style={{ marginBottom: '0.5rem' }}>조 수</div>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={10}
                  value={teamCount}
                  onChange={e => handleTeamCountChange(Number(e.target.value))}
                  required
                />
              </label>
            </div>
          </div>

          {Array.from({ length: teamCount }).map((_, i) => (
            <div key={i} className="card">
              <h3 style={{ marginBottom: '1rem' }}>{i + 1}조</h3>
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} style={{ marginBottom: '1rem' }}>
                  <div style={{ marginBottom: '0.5rem' }}>플레이어 {j + 1}</div>
                  <input
                    className="input"
                    value={players[i][j].name}
                    onChange={e => handlePlayerChange(i, j, e.target.value)}
                    placeholder={`플레이어 ${j + 1} 이름`}
                  />
                </div>
              ))}
            </div>
          ))}

          <button type="submit" className="btn" disabled={loading} style={{ width: '100%' }}>
            {loading ? "생성 중..." : "경기 생성"}
          </button>
        </form>
      )}

      <NavBar />

      <PasswordModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
        }}
        onConfirm={handleSubmit}
        message="새 경기를 생성하려면 비밀번호를 입력하세요."
      />
    </div>
  );
} 