import React, { useState, useRef } from 'react';
import { X, Camera } from 'lucide-react';
import api from '../api';

interface NewBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const NewBookModal: React.FC<NewBookModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setTagsInput('');
    setCoverFile(null);
    setCoverPreview('');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('请输入书籍名称');
      return;
    }

    setLoading(true);

    try {
      // Upload cover first if selected
      let coverUrl = '';
      if (coverFile) {
        const formData = new FormData();
        formData.append('cover', coverFile);
        const uploadRes = await api.post('/api/upload/cover', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        coverUrl = uploadRes.data.url;
      }

      // Parse tags from comma-separated input
      const tags = tagsInput
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      // Create book
      await api.post('/api/books', {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        tags,
        cover: coverUrl,
      });

      resetForm();
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.message || '创建书籍失败');
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>新建书籍</h2>
          <button className="modal-close-btn" onClick={handleClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-msg">{error}</div>}

          {/* 封面 */}
          <div className="form-group">
            <label>封面</label>
            <div className="cover-upload-area" onClick={() => fileInputRef.current?.click()}>
              {coverPreview ? (
                <img src={coverPreview} alt="封面预览" className="cover-preview" />
              ) : (
                <div className="cover-upload-placeholder">
                  <span className="cover-upload-icon"><Camera size={20} /></span>
                  <span>点击上传封面图片</span>
                  <span className="cover-upload-hint">支持 JPG、PNG、GIF、WebP</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {/* 书籍名称 */}
          <div className="form-group">
            <label htmlFor="book-title">书籍名称 *</label>
            <input
              id="book-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入书籍名称"
              autoFocus
            />
          </div>

          {/* 书籍简介 */}
          <div className="form-group">
            <label htmlFor="book-desc">书籍简介</label>
            <textarea
              id="book-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请输入书籍简介"
              rows={4}
            />
          </div>

          {/* 分类 */}
          <div className="form-group">
            <label htmlFor="book-category">分类</label>
            <select
              id="book-category"
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

          {/* 标签 */}
          <div className="form-group">
            <label htmlFor="book-tags">标签</label>
            <input
              id="book-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="多个标签用逗号分隔，如：编程, JavaScript, Web"
            />
          </div>

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={handleClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '创建中...' : '创建书籍'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewBookModal;
