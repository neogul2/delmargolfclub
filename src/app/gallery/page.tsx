"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NavBar from '@/components/NavBar';
import Image from 'next/image';
import PasswordModal from '@/components/PasswordModal';

interface GamePhoto {
  id: string;
  game_id: string;
  photo_url: string;
  created_at: string;
  game: {
    name: string;
    date: string;
  };
}

export default function GalleryPage() {
  const [photos, setPhotos] = useState<GamePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  const fetchPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('game_photos')
        .select(`
          *,
          game:games (
            name,
            date
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPhotos(data || []);
    } catch (error) {
      console.error('Error fetching photos:', error);
      setError(error instanceof Error ? error.message : '사진을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, []);

  const handleDownload = async (photo: GamePhoto) => {
    try {
      // 파일 이름 생성
      const fileName = `${photo.game.name}_${new Date(photo.game.date).toLocaleDateString()}.jpg`;
      
      // 이미지 URL에서 파일 다운로드
      const response = await fetch(photo.photo_url);
      const blob = await response.blob();
      
      // 다운로드 링크 생성 및 클릭
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading photo:', error);
      alert('사진 다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteClick = (photoId: string) => {
    setSelectedPhotoId(photoId);
    setShowPasswordModal(true);
  };

  const handleDelete = async () => {
    if (!selectedPhotoId) return;

    try {
      // 1. 먼저 Supabase Storage에서 파일 삭제
      const photo = photos.find(p => p.id === selectedPhotoId);
      if (!photo) throw new Error('사진을 찾을 수 없습니다.');

      const photoPath = photo.photo_url.split('/').pop();
      if (!photoPath) throw new Error('파일 경로를 찾을 수 없습니다.');

      const { error: storageError } = await supabase.storage
        .from('game-photos')
        .remove([photoPath]);

      if (storageError) throw storageError;

      // 2. 데이터베이스에서 레코드 삭제
      const { error: dbError } = await supabase
        .from('game_photos')
        .delete()
        .eq('id', selectedPhotoId);

      if (dbError) throw dbError;

      // 3. UI 업데이트
      setPhotos(photos.filter(p => p.id !== selectedPhotoId));
      setSelectedPhotoId(null);
      alert('사진이 삭제되었습니다.');
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert(error instanceof Error ? error.message : '사진 삭제 중 오류가 발생했습니다.');
    }
  };

  if (loading) return <div className="container">로딩 중...</div>;
  if (error) return <div className="container">에러: {error}</div>;

  return (
    <div className="container page-container">
      <h1>갤러리</h1>

      <div className="gallery-grid">
        {photos.length === 0 ? (
          <div className="card">
            <p>아직 업로드된 사진이 없습니다.</p>
          </div>
        ) : (
          photos.map((photo) => (
            <div key={photo.id} className="gallery-item card">
              <div className="gallery-image-container">
                <Image
                  src={photo.photo_url}
                  alt={`${photo.game.name} 경기 사진`}
                  width={300}
                  height={200}
                  className="gallery-image"
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div className="gallery-info">
                <h3>{photo.game.name}</h3>
                <p>{new Date(photo.game.date).toLocaleDateString()}</p>
                <div className="gallery-actions">
                  <button 
                    className="btn btn-small"
                    onClick={() => handleDownload(photo)}
                  >
                    다운로드
                  </button>
                  <button 
                    className="btn btn-small btn-danger"
                    onClick={() => handleDeleteClick(photo.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <PasswordModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setSelectedPhotoId(null);
        }}
        onConfirm={handleDelete}
        message="사진을 삭제하려면 비밀번호를 입력하세요."
      />

      <NavBar />
    </div>
  );
} 