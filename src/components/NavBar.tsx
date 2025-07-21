'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface NavBarProps {
  gameId?: string;
}

export default function NavBar({ gameId }: NavBarProps) {
  const pathname = usePathname();

  return (
    <nav className="nav-bar">
      <Link 
        href="/" 
        className={`nav-link ${pathname === '/' ? 'active' : ''}`}
      >
        🏠 리더보드
      </Link>
      {gameId && (
        <Link 
          href={`/game/${gameId}`} 
          className={`nav-link ${pathname.startsWith('/game/') ? 'active' : ''}`}
        >
          ✏️ 점수입력
        </Link>
      )}
      <Link 
        href="/new-game" 
        className={`nav-link ${pathname === '/new-game' ? 'active' : ''}`}
      >
        ➕ 새 경기
      </Link>
      <Link 
        href="/stats" 
        className={`nav-link ${pathname === '/stats' ? 'active' : ''}`}
      >
        📊 전체기록
      </Link>
      <Link 
        href="/gallery" 
        className={`nav-link ${pathname === '/gallery' ? 'active' : ''}`}
      >
        📸 갤러리
      </Link>
    </nav>
  );
} 