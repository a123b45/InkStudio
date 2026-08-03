import React, { useEffect, useState } from 'react';
import { X, RotateCcw, Clock } from 'lucide-react';
import api from '../api';

interface Version {
  _id: string;
  title: string;
  wordCount: number;
  createdAt: string;
}

interface VersionHistoryModalProps {
  chapterId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRestore: (content: any[], title: string) => void;
}

const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  chapterId,
  isOpen,
  onClose,
  onRestore,
}) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !chapterId) return;
    setLoading(true);
    api.get(`/api/chapters/${chapterId}/versions`)
      .then(({ data }) => setVersions(data))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, [isOpen, chapterId]);

  const handleRestore = async (versionId: string) => {
    if (!chapterId || !confirm('确定要恢复到此版本吗？当前内容会先保存为历史版本。')) return;
    setRestoring(versionId);
    try {
      const { data } = await api.post(`/api/chapters/${chapterId}/versions/${versionId}/restore`);
      onRestore(data.content, data.title);
      onClose();
    } catch {
      alert('恢复失败');
    }
    setRestoring(null);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><Clock size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />版本历史</h2>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>

        {loading ? (
          <p style={{ padding: '1rem', color: 'var(--text-muted)' }}>加载中...</p>
        ) : versions.length === 0 ? (
          <p style={{ padding: '1rem', color: 'var(--text-muted)' }}>暂无历史版本（保存章节后会自动创建快照）</p>
        ) : (
          <div className="version-list">
            {versions.map((v) => (
              <div key={v._id} className="version-item">
                <div className="version-info">
                  <strong>{v.title}</strong>
                  <span className="version-meta">
                    {new Date(v.createdAt).toLocaleString('zh-CN')} · {v.wordCount.toLocaleString()} 词
                  </span>
                </div>
                <button
                  className="btn btn-sm"
                  disabled={restoring === v._id}
                  onClick={() => handleRestore(v._id)}
                >
                  <RotateCcw size={14} /> {restoring === v._id ? '恢复中...' : '恢复'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VersionHistoryModal;
