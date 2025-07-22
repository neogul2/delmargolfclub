"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import NavBar from '@/components/NavBar';

// 팀 이름 생성 유틸리티
const getTeamName = (teamIndex: number): string => {
  const teamNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  return teamNames[teamIndex];
};

interface TeamPlayer {
  name: string;
  team: string;  // 'A' | 'B' | 'C' | 'D' | ... 형식으로 변경
}

export default function NewGamePage() {
  const [gameName, setGameName] = useState('');
  const [gameDate, setGameDate] = useState('');
  const [teamCount, setTeamCount] = useState(2);
  const router = useRouter();

  // 각 조별 플레이어 상태 관리
  const [players, setPlayers] = useState<TeamPlayer[][]>(() => 
    Array(teamCount).fill(null).map((_, groupIndex) => [
      { name: '', team: getTeamName(groupIndex * 2) },     // 첫 번째 플레이어 (첫 번째 팀)
      { name: '', team: getTeamName(groupIndex * 2) },     // 두 번째 플레이어 (첫 번째 팀)
      { name: '', team: getTeamName(groupIndex * 2 + 1) }, // 세 번째 플레이어 (두 번째 팀)
      { name: '', team: getTeamName(groupIndex * 2 + 1) }  // 네 번째 플레이어 (두 번째 팀)
    ])
  );

  // 조 수가 변경될 때 플레이어 배열 업데이트
  const handleTeamCountChange = (value: string) => {
    const newCount = Math.max(1, Math.min(10, parseInt(value) || 1)); // 1-10조 제한
    setTeamCount(newCount);
    
    setPlayers(prev => {
      const newPlayers = Array(newCount).fill(null).map((_, groupIndex) => {
        // 기존 조의 데이터는 유지
        if (groupIndex < prev.length) return prev[groupIndex];
        // 새로운 조는 빈 데이터로 초기화
        return [
          { name: '', team: getTeamName(groupIndex * 2) },     // 첫 번째 플레이어 (첫 번째 팀)
          { name: '', team: getTeamName(groupIndex * 2) },     // 두 번째 플레이어 (첫 번째 팀)
          { name: '', team: getTeamName(groupIndex * 2 + 1) }, // 세 번째 플레이어 (두 번째 팀)
          { name: '', team: getTeamName(groupIndex * 2 + 1) }  // 네 번째 플레이어 (두 번째 팀)
        ];
      });
      return newPlayers;
    });
  };

  const handlePlayerChange = (teamIndex: number, playerIndex: number, value: string) => {
    setPlayers(prev => {
      const newPlayers = [...prev];
      newPlayers[teamIndex] = [...newPlayers[teamIndex]];
      newPlayers[teamIndex][playerIndex] = {
        ...newPlayers[teamIndex][playerIndex],
        name: value
      };
      return newPlayers;
    });
  };

  const handleSubmit = async () => {
    try {
      // 1. 게임 생성
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .insert([
          {
            name: gameName,
            date: gameDate
          }
        ])
        .select()
        .single();

      if (gameError) throw gameError;

      // 2. 각 조별로 처리
      for (let teamIndex = 0; teamIndex < players.length; teamIndex++) {
        // 조 생성
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .insert([
            {
              name: `${teamIndex + 1}조`,
              game_id: gameData.id
            }
          ])
          .select()
          .single();

        if (teamError) throw teamError;

        // 해당 조의 플레이어들 처리
        for (const player of players[teamIndex]) {
          if (!player.name.trim()) continue;

          // 플레이어 생성 또는 조회
          let playerData;
          const { data: existingPlayer, error: findError } = await supabase
            .from('players')
            .select()
            .eq('name', player.name)
            .single();

          if (findError) {
            // 플레이어가 없으면 새로 생성
            const { data: newPlayer, error: createError } = await supabase
              .from('players')
              .insert([{ name: player.name }])
              .select()
              .single();

            if (createError) throw createError;
            playerData = newPlayer;
          } else {
            playerData = existingPlayer;
          }

          // 팀 플레이어 연결 (team 정보 포함)
          const { error: teamPlayerError } = await supabase
            .from('team_players')
            .insert([
              {
                team_id: teamData.id,
                player_id: playerData.id,
                team_name: player.team // team 정보를 team_players 테이블에 저장
              }
            ]);

          if (teamPlayerError) throw teamPlayerError;
        }
      }

      // 성공 시 리더보드로 이동
      router.push('/');
    } catch (error) {
      console.error('Error creating game:', error);
      alert('게임 생성 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="container page-container">
      <h1>새 경기 생성</h1>

      <div className="card">
        <div>
          <label>경기명</label>
          <input
            type="text"
            className="input"
            placeholder="예: 7월 정기 라운드"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
          />
        </div>

        <div>
          <label>날짜</label>
          <input
            type="date"
            className="input"
            value={gameDate}
            onChange={(e) => setGameDate(e.target.value)}
          />
        </div>

        <div>
          <label>조 수</label>
          <input
            type="number"
            className="input"
            min="1"
            max="5" // 최대 5조(10팀)까지 제한
            value={teamCount}
            onChange={(e) => handleTeamCountChange(e.target.value)}
          />
        </div>

        {/* 각 조별 플레이어 입력 */}
        {players.map((teamPlayers, teamIndex) => (
          <div key={teamIndex}>
            <h3>{teamIndex + 1}조</h3>
            {teamPlayers.map((player, playerIndex) => (
              <div key={playerIndex}>
                <label>
                  플레이어 {playerIndex + 1}{' '}
                  <span className={`team-${player.team.toLowerCase()}`}>
                    ({player.team}팀)
                  </span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder={`플레이어 ${playerIndex + 1} 이름`}
                  value={player.name}
                  onChange={(e) => handlePlayerChange(teamIndex, playerIndex, e.target.value)}
                />
              </div>
            ))}
          </div>
        ))}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button
            className="btn"
            style={{ flex: 1 }}
            onClick={handleSubmit}
          >
            경기 생성
          </button>
          <button
            className="btn btn-outline"
            style={{ flex: 1 }}
            onClick={() => router.push('/')}
          >
            취소
          </button>
        </div>
      </div>

      <NavBar />
    </div>
  );
} 