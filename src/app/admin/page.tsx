"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NavBar from '@/components/NavBar';
import PasswordModal from '@/components/PasswordModal';
import Link from 'next/link';

interface Game {
  id: string;
  name: string;
  date: string;
  created_at: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(true);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [editForm, setEditForm] = useState({ name: '', date: '' });
  const [error, setError] = useState<string | null>(null);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('games')
        .select('id, name, date, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGames(data || []);
    } catch (error) {
      console.error('Error fetching games:', error);
      setError(error instanceof Error ? error.message : '경기 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchGames();
    }
  }, [isAuthenticated, fetchGames]);

  const handlePasswordConfirm = () => {
    setIsAuthenticated(true);
    setShowPasswordModal(false);
  };

  const handleEdit = (game: Game) => {
    setEditingGame(game);
    setEditForm({ name: game.name, date: game.date });
  };

  const handleSaveEdit = async () => {
    if (!editingGame) return;

    try {
      const { error } = await supabase
        .from('games')
        .update({
          name: editForm.name,
          date: editForm.date
        })
        .eq('id', editingGame.id);

      if (error) throw error;
      
      alert('경기 정보가 수정되었습니다.');
      setEditingGame(null);
      fetchGames();
    } catch (error) {
      console.error('Error updating game:', error);
      alert('경기 정보 수정에 실패했습니다.');
    }
  };

  const handleDelete = async (gameId: string, gameName: string) => {
    if (!confirm(`"${gameName}" 경기를 정말 삭제하시겠습니까?\n\n주의: 이 작업은 되돌릴 수 없으며, 관련된 모든 데이터(팀, 플레이어, 점수, 사진)가 함께 삭제됩니다.`)) {
      return;
    }

    try {
      // 1. 점수 삭제
      await supabase.from('scores').delete().eq('game_id', gameId);
      
      // 2. 게임 사진 삭제
      await supabase.from('game_photos').delete().eq('game_id', gameId);
      
      // 3. 팀 플레이어 연결 삭제
      const { data: teams } = await supabase
        .from('teams')
        .select('id')
        .eq('game_id', gameId);
      
      if (teams) {
        for (const team of teams) {
          await supabase.from('team_players').delete().eq('team_id', team.id);
        }
      }
      
      // 4. 팀 삭제
      await supabase.from('teams').delete().eq('game_id', gameId);
      
      // 5. 경기 삭제
      const { error } = await supabase.from('games').delete().eq('id', gameId);
      
      if (error) throw error;
      
      alert('경기가 성공적으로 삭제되었습니다.');
      fetchGames();
    } catch (error) {
      console.error('Error deleting game:', error);
      alert('경기 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="container page-container">
      {!isAuthenticated ? (
        <PasswordModal
          isOpen={showPasswordModal}
          onClose={() => {
            setShowPasswordModal(false);
            window.location.href = '/';
          }}
          onConfirm={handlePasswordConfirm}
          message="관리자 권한이 필요합니다. 비밀번호를 입력하세요."
        />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h1 style={{ margin: 0 }}>🔧 경기 관리</h1>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Link href="/new-game" className="btn">
                ➕ 새 경기 생성
              </Link>
              <button
                className="btn btn-outline"
                onClick={() => {
                  setIsAuthenticated(false);
                  window.location.href = '/';
                }}
              >
                로그아웃
              </button>
            </div>
          </div>

          {error && (
            <div className="card error">
              <p>{error}</p>
            </div>
          )}

          {loading ? (
            <div className="card">
              <p>로딩 중...</p>
            </div>
          ) : (
            <div className="card">
              <h2>경기 목록</h2>
              {games.length === 0 ? (
                <p>등록된 경기가 없습니다.</p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>경기명</th>
                        <th>날짜</th>
                        <th>생성일</th>
                        <th>액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {games.map(game => (
                        <tr key={game.id}>
                          <td>{game.name}</td>
                          <td>{new Date(game.date).toLocaleDateString()}</td>
                          <td>{new Date(game.created_at).toLocaleDateString()}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button 
                                className="btn btn-small"
                                onClick={() => handleEdit(game)}
                              >
                                수정
                              </button>
                              <button 
                                className="btn btn-small btn-danger"
                                onClick={() => handleDelete(game.id, game.name)}
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {editingGame && (
            <div className="modal-overlay">
              <div className="modal-content">
                <h3>경기 정보 수정</h3>
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <div style={{ marginBottom: '0.5rem' }}>경기명</div>
                    <input
                      className="input"
                      value={editForm.name}
                      onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="경기명"
                    />
                  </label>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <div style={{ marginBottom: '0.5rem' }}>날짜</div>
                    <input
                      className="input"
                      type="date"
                      value={editForm.date}
                      onChange={e => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    className="btn" 
                    onClick={handleSaveEdit}
                    style={{ flex: 1 }}
                  >
                    저장
                  </button>
                  <button 
                    className="btn btn-outline" 
                    onClick={() => setEditingGame(null)}
                    style={{ flex: 1 }}
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}

          <NavBar />
        </>
      )}
    </div>
  );
} 