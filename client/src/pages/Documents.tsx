import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Plus } from 'lucide-react';

interface Doc {
  _id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
}

const Documents = () => {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchDocs = async () => {
    try {
      const { data } = await api.get('/api/documents');
      setDocs(data);
    } catch {
      console.error('获取文档列表失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const createDoc = async () => {
    try {
      const { data } = await api.post('/api/documents', {
        title: '未命名文档',
      });
      navigate(`/editor/${data._id}`);
    } catch {
      alert('创建文档失败');
    }
  };

  const deleteDoc = async (id: string) => {
    if (!confirm('确定要删除这篇文档吗？')) return;
    try {
      await api.delete(`/api/documents/${id}`);
      setDocs(docs.filter((d) => d._id !== id));
    } catch {
      alert('删除文档失败');
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('zh-CN');

  if (loading) return <div className="container">加载中...</div>;

  return (
    <div className="container">
      <div className="docs-header">
        <h1>我的文档</h1>
        <button className="btn btn-primary" onClick={createDoc}>
          <Plus size={16} /> 新建文档
        </button>
      </div>

      {docs.length === 0 ? (
        <div className="empty-state">
          <p>还没有文档，点击上方按钮创建第一篇吧！</p>
        </div>
      ) : (
        <div className="docs-list">
          {docs.map((doc) => (
            <div className="doc-card" key={doc._id}>
              <div className="doc-info">
                <h3
                  className="doc-title"
                  onClick={() => navigate(`/editor/${doc._id}`)}
                >
                  {doc.title}
                </h3>
                <span className="doc-date">更新于 {formatDate(doc.updatedAt)}</span>
              </div>
              <div className="doc-actions">
                <button
                  className="btn btn-sm"
                  onClick={() => navigate(`/editor/${doc._id}`)}
                >
                  编辑
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => deleteDoc(doc._id)}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Documents;
