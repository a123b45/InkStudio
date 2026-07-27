import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../api';

interface Book {
  _id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  cover: string;
}

interface EditBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  book: Book | null;
}

const EditBookModal: React.FC<EditBookModalProps> = ({ isOpen, onClose, onSaved, book }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (book) {
      setTitle(book.title || '');
      setDescription(book.description || '');
      setCategory(book.category || '');
      setTagsInput((book.tags || []).join(', '));
      setError('');
    }
  }, [book]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('请输入书籍名称');
      return;
    }

    setLoading(true);

    try {
      const tags = tagsInput
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await api.put(`/api/books/${book!._id}`, {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        tags,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || '更新书籍失败');
    }
    setLoading(false);
  };

  if (!isOpen || !book) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>编辑书籍</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-msg">{error}</div>}

          <div className="form-group">
            <label htmlFor="edit-title">书籍名称 *</label>
            <input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入书籍名称"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-desc">书籍简介</label>
            <textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请输入书籍简介"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-category">分类</label>
            <select
              id="edit-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">请选择分类</option>
              <option value="小说">小说</option>
              <option value="技术">技术</option>
              <option value="文学">文学</option>
              <option value="历史">历史</option>
              <option value="哲学">哲学</option>
              <option value="科学">科学</option>
              <option value="艺术">艺术</option>
              <option value="其他">其他</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="edit-tags">标签</label>
            <input
              id="edit-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="多个标签用逗号分隔"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditBookModal;
