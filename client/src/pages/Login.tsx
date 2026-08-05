import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Layers, PenLine, Shield } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/books');
    } catch (err: any) {
      setError(err.response?.data?.message || '登录失败');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <span className="brand-mark lg">墨</span>
          <h2 className="auth-brand-title">墨坊 InkStudio</h2>
          <p className="auth-brand-desc">
            个人小说创作平台，为作者提供专业的卷章管理与沉浸式码字体验。
          </p>
          <ul className="auth-features-list">
            <li>
              <span className="auth-feature-icon"><Layers size={16} /></span>
              卷 · 章结构化写作管理
            </li>
            <li>
              <span className="auth-feature-icon"><PenLine size={16} /></span>
              纸感排版，专注码字体验
            </li>
            <li>
              <span className="auth-feature-icon"><Shield size={16} /></span>
              云端存储，数据安全隔离
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
            <h1>欢迎回来</h1>
            <p>登录您的墨坊账号，继续创作</p>
          </div>
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={handleSubmit}>
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
              placeholder="请输入密码"
              autoComplete="current-password"
            />
            <button type="submit" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
          <p className="auth-link">
            还没有账号？<Link to="/register">免费注册</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
