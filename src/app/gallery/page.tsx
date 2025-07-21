"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NavBar from '@/components/NavBar';

interface Game {
  id: string;
  name: string;
  date: string;
}

interface GamePhoto {
  id: string;
  game_id: string;
  photo_url: string;
  created_at: string;
  game: Game;
}

export default function Gallery() {
  const [photos, setPhotos] = useState<GamePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('game_photos')
          .select(`
            *,
            game:games (
              id,
              name,
              date
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPhotos(data || []);
      } catch (err: any) {
        console.error('Error fetching photos:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPhotos();
  }, []);

  const handleImageClick = async (e: React.MouseEvent<HTMLImageElement>, photo: GamePhoto) => {
    if (confirm('이미지를 다운로드하시겠습니까?')) {
      try {
        // 이미지 URL에서 파일 이름 추출
        const fileName = `${photo.game.name}_${new Date(photo.game.date).toLocaleDateString()}.jpg`;
        
        // 이미지 다운로드
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
      } catch (err) {
        console.error('Error downloading image:', err);
        alert('이미지 다운로드 중 오류가 발생했습니다.');
      }
    }
  };

  return (
    <div className="container page-container">
      <h1>📸 갤러리</h1>

      {error && (
        <div className="card error">
          <p>사진을 불러오는데 실패했습니다: {error}</p>
          <button 
            className="btn" 
            onClick={() => window.location.reload()}
            style={{ marginTop: '1rem' }}
          >
            다시 시도
          </button>
        </div>
      )}

      {loading ? (
        <div className="card">
          <p>로딩 중...</p>
        </div>
      ) : photos.length === 0 ? (
        <div className="card">
          <p>아직 업로드된 사진이 없습니다.</p>
        </div>
      ) : (
        <div className="gallery-grid">
          {photos.map((photo) => (
            <div key={photo.id} className="gallery-item card">
              <img 
                src={photo.photo_url} 
                alt={`${photo.game.name} 경기 사진`} 
                className="gallery-image"
                onClick={(e) => handleImageClick(e, photo)}
                style={{ cursor: 'pointer' }}
              />
              <div className="gallery-info">
                <h3>{photo.game.name}</h3>
                <p>{new Date(photo.game.date).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <NavBar />
    </div>
  );
} 