import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Cloud, Sparkles } from 'lucide-react';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(username, email, password);
      navigate('/books');
    } catch (err: any) {
      setError(err.response?.data?.message || '注册失败');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <span className="brand-mark lg">墨</span>
          <h2 className="auth-brand-title">开启创作之旅</h2>
          <p className="auth-brand-desc">
            注册墨坊账号，免费使用全部写作功能——从第一本书到百万字长篇，我们与你同行。
          </p>
          <ul className="auth-features-list">
            <li>
              <span className="auth-feature-icon"><BookOpen size={16} /></span>
              无限书籍，卷章自由组织
            </li>
            <li>
              <span className="auth-feature-icon"><Sparkles size={16} /></span>
              7 大写作插件开箱即用
            </li>
            <li>
              <span className="auth-feature-icon"><Cloud size={16} /></span>
              自动保存，云端同步备份
            </li>
          </ul>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <span className="brand-mark sm">墨</span>
            <span>墨坊 InkStudio</span>
          </div>
          <div className="auth-card-header">
            <h1>创建账号</h1>
            <p>填写信息，立即开始码字</p>
          </div>
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={handleSubmit}>
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="您的笔名或昵称"
              autoComplete="username"
            />
            <label>邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@company.com"
              autoComplete="email"
            />
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="至少 6 位密码"
              autoComplete="new-password"
            />
            <button type="submit" disabled={loading}>
              {loading ? '注册中...' : '注册并开始创作'}
            </button>
          </form>
          <p className="auth-link">
            已有账号？<Link to="/login">去登录</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
