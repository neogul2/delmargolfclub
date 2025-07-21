'use client';

import { useState } from 'react';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
}

export default function PasswordModal({ isOpen, onClose, onConfirm, message }: PasswordModalProps) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = (e.currentTarget.elements.namedItem('password') as HTMLInputElement).value;
    
    setLoading(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error('API response not ok');
      }

      const result = await response.json();

      if (result.success) {
        onConfirm();
        onClose();
      } else {
        alert(result.message || '비밀번호가 올바르지 않습니다.');
      }
    } catch (error) {
      console.error('Password verification error:', error);
      
      // 개발 환경에서 API가 작동하지 않을 때의 fallback
      console.log('API 오류 발생, 로컬 검증으로 대체');
      if (password === '92130') {
        onConfirm();
        onClose();
      } else {
        alert('비밀번호가 올바르지 않습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>{message}</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            name="password"
            className="input"
            placeholder="비밀번호를 입력하세요"
            autoFocus
            required
            disabled={loading}
          />
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" className="btn" style={{ flex: 1 }} disabled={loading}>
              {loading ? '확인 중...' : '확인'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              style={{ flex: 1 }}
              disabled={loading}
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 