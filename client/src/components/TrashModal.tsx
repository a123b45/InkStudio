import React, { useEffect, useState } from 'react';
import { X, Trash2, RotateCcw } from 'lucide-react';
import api from '../api';

interface TrashBook {
  _id: string;
  title: string;
  category: string;
  deletedAt: string;
}

interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored: () => void;
}

const TrashModal: React.FC<TrashModalProps> = ({ isOpen, onClose, onRestored }) => {
  const [books, setBooks] = useState<TrashBook[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/trash');
      setBooks(data);
    } catch {
      setBooks([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) fetchTrash();
  }, [isOpen]);

  const handleRestore = async (id: string) => {
    try {
      await api.post(`/api/trash/restore/book/${id}`);
      setBooks((prev) => prev.filter((b) => b._id !== id));
      onRestored();
    } catch {
      alert('恢复失败');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm('永久删除后无法恢复，确定吗？')) return;
    try {
      await api.delete(`/api/trash/book/${id}`);
      setBooks((prev) => prev.filter((b) => b._id !== id));
    } catch {
      alert('删除失败');
    }
  };

  const handleEmpty = async () => {
    if (!confirm('确定清空回收站？此操作不可撤销。')) return;
    try {
      await api.delete('/api/trash/empty');
      setBooks([]);
    } catch {
      alert('清空失败');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><Trash2 size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />回收站</h2>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        {loading ? (
          <p style={{ padding: '1rem', color: 'var(--text-muted)' }}>加载中...</p>
        ) : books.length === 0 ? (
          <p style={{ padding: '1rem', color: 'var(--text-muted)' }}>回收站为空</p>
        ) : (
          <>
            <div className="trash-actions">
              <button className="btn btn-sm danger" onClick={handleEmpty}>清空回收站</button>
            </div>
            <div className="version-list">
              {books.map((b) => (
                <div key={b._id} className="version-item">
                  <div className="version-info">
                    <strong>{b.title}</strong>
                    <span className="version-meta">
                      {b.category || '未分类'} · 删除于 {new Date(b.deletedAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-sm" onClick={() => handleRestore(b._id)}>
                      <RotateCcw size={14} /> 恢复
                    </button>
                    <button className="btn btn-sm danger" onClick={() => handlePermanentDelete(b._id)}>
                      永久删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TrashModal;
