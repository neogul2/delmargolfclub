"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NavBar from '@/components/NavBar';
import Image from 'next/image';

interface GamePhoto {
  id: string;
  photo_url: string;
  game: {
    id: string;
    name: string;
    date: string;
  };
}

export default function GalleryPage() {
  const [photos, setPhotos] = useState<GamePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: photosData, error } = await supabase
        .from('game_photos')
        .select(`
          id,
          photo_url,
          game:games!game_photos_game_id_fkey (
            id,
            name,
            date
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        handleError(error);
        return;
      }

      // Type assertion with proper data transformation
      const transformedPhotos = (photosData || []).map(photo => ({
        id: photo.id,
        photo_url: photo.photo_url,
        game: Array.isArray(photo.game) ? photo.game[0] : photo.game
      })) as GamePhoto[];

      setPhotos(transformedPhotos);
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

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
      } catch (error) {
        handleDownloadError(error instanceof Error ? error : new Error('Unknown error'));
      }
    }
  };

  const handleError = (error: Error) => {
    console.error('Error:', error.message);
    alert('오류가 발생했습니다. 다시 시도해주세요.');
  };

  const handleDownloadError = (error: Error) => {
    console.error('Download error:', error.message);
    alert('이미지 다운로드 중 오류가 발생했습니다.');
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
            <div key={photo.id} className="gallery-image-container">
              <Image
                src={photo.photo_url}
                alt={`${photo.game.name} 경기 사진`}
                width={300}
                height={200}
                className="gallery-image"
                onClick={(e) => handleImageClick(e, photo)}
                style={{ cursor: 'pointer', objectFit: 'cover' }}
              />
            </div>
          ))}
        </div>
      )}

      <NavBar />
    </div>
  );
} 