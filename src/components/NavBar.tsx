'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="nav-bar">
      <Link
        href="/"
        className={`nav-link ${pathname === '/' ? 'active' : ''}`}
      >
        🏠 리더보드
      </Link>
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
        📷 갤러리
      </Link>
      <Link
        href="/admin"
        className={`nav-link ${pathname === '/admin' ? 'active' : ''}`}
      >
        🔧 관리
      </Link>
    </nav>
  );
} 