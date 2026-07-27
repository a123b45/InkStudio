import React, { useState } from 'react';
import { X } from 'lucide-react';
import api from '../api';

interface NewGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  allTags: string[];
  allCategories: string[];
}

type GroupMethod = 'tags' | 'category' | 'bookName' | 'custom';

const METHOD_LABELS: Record<GroupMethod, string> = {
  tags: '按标签分组',
  category: '按分类分组',
  bookName: '按书名分组',
  custom: '自定义分组',
};

const NewGroupModal: React.FC<NewGroupModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  allTags,
  allCategories,
}) => {
  const [name, setName] = useState('');
  const [method, setMethod] = useState<GroupMethod>('tags');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [bookNameStr, setBookNameStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setName('');
    setMethod('tags');
    setSelectedTags([]);
    setSelectedCategory('');
    setBookNameStr('');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('请输入分组名称');
      return;
    }

    // Build config based on method
    let config: Record<string, any> = {};
    switch (method) {
      case 'tags':
        if (selectedTags.length === 0) {
          setError('请至少选择一个标签');
          return;
        }
        config = { tags: selectedTags };
        break;
      case 'category':
        if (!selectedCategory) {
          setError('请选择一个分类');
          return;
        }
        config = { categories: [selectedCategory] };
        break;
      case 'bookName':
        if (!bookNameStr.trim()) {
          setError('请输入书名关键词');
          return;
        }
        config = { bookName: bookNameStr.trim() };
        break;
      case 'custom':
        config = {};
        break;
    }

    setLoading(true);

    try {
      await api.post('/api/groups', {
        name: name.trim(),
        method,
        config,
      });

      resetForm();
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.message || '创建分组失败');
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>新建分组</h2>
          <button className="modal-close-btn" onClick={handleClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-msg">{error}</div>}

          {/* 分组名称 */}
          <div className="form-group">
            <label htmlFor="group-name">分组名称 *</label>
            <input
              id="group-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入分组名称"
              autoFocus
            />
          </div>

          {/* 分组方式 */}
          <div className="form-group">
            <label htmlFor="group-method">分组方式</label>
            <select
              id="group-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as GroupMethod)}
            >
              {(Object.entries(METHOD_LABELS) as [GroupMethod, string][]).map(
                ([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Dynamic config based on method */}
          {method === 'tags' && (
            <div className="form-group">
              <label>选择标签（可多选）</label>
              {allTags.length === 0 ? (
                <p className="form-hint">当前没有任何书籍标签，请先创建带标签的书籍</p>
              ) : (
                <div className="tag-select-list">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`tag-select-chip ${selectedTags.includes(tag) ? 'active' : ''}`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
              {selectedTags.length > 0 && (
                <p className="form-hint">已选 {selectedTags.length} 个标签</p>
              )}
            </div>
          )}

          {method === 'category' && (
            <div className="form-group">
              <label htmlFor="group-category">选择分类</label>
              <select
                id="group-category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">请选择分类</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          {method === 'bookName' && (
            <div className="form-group">
              <label htmlFor="group-bookname">书名关键词</label>
              <input
                id="group-bookname"
                type="text"
                value={bookNameStr}
                onChange={(e) => setBookNameStr(e.target.value)}
                placeholder="输入书名关键词进行模糊匹配"
              />
              <p className="form-hint">将自动匹配书名中包含该关键词的所有书籍</p>
            </div>
          )}

          {method === 'custom' && (
            <div className="form-group">
              <p className="form-hint">
                💡 自定义分组将创建一个空分组，你可以稍后通过右键菜单将书籍添加到分组中
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={handleClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '创建中...' : '创建分组'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewGroupModal;
