'use client';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
}

export default function PasswordModal({ isOpen, onClose, onConfirm, message }: PasswordModalProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = (e.currentTarget.elements.namedItem('password') as HTMLInputElement).value;
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '92130';
    
    if (password === adminPassword) {
      onConfirm();
      onClose();
    } else {
      alert('비밀번호가 올바르지 않습니다.');
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
          />
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" className="btn" style={{ flex: 1 }}>
              확인
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              style={{ flex: 1 }}
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 