import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import {
  BookOpen,
  Cloud,
  FileText,
  Layers,
  PenLine,
  Shield,
  Sparkles,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import Login from './pages/Login';
import Register from './pages/Register';
import Books from './pages/Books';
import EditorPage from './pages/Editor';

const Brand = ({ dark = false, size = 'md' }: { dark?: boolean; size?: 'sm' | 'md' | 'lg' }) => (
  <Link to="/" className={`brand${dark ? ' brand--dark' : ''}`}>
    <span className={`brand-mark${size === 'sm' ? ' sm' : size === 'lg' ? ' lg' : ''}`}>墨</span>
    <span className="brand-text">
      <span className="brand-name">墨坊 InkStudio</span>
      <span className="brand-tagline">Enterprise Writing</span>
    </span>
  </Link>
);

/** 需要登录才能访问的路由 */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="auth-form-panel" style={{ minHeight: '100vh', width: '100%' }}>
        <p style={{ color: 'var(--text-muted)' }}>加载中...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
};

const Home = () => {
  const { user } = useAuth();

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <Brand />
        <div className="landing-nav-actions">
          {user ? (
            <Link to="/books" className="btn btn-primary">
              进入工作台 <ChevronRight size={16} />
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">登录</Link>
              <Link to="/register" className="btn btn-primary">免费注册</Link>
            </>
          )}
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1>
            专注创作，<em>专业码字</em>
          </h1>
          <p className="landing-hero-desc">
            墨坊 InkStudio 为企业与个人作者提供结构化写作环境——
            卷章管理、富文本编辑、写作插件与云端同步，让长篇创作井然有序。
          </p>
          <div className="landing-hero-actions">
            {user ? (
              <Link to="/books" className="btn btn-primary">
                进入我的书库 <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary">
                  开始使用 <ArrowRight size={16} />
                </Link>
                <Link to="/login" className="btn">已有账号，登录</Link>
              </>
            )}
          </div>
          <div className="landing-stats">
            <div>
              <div className="landing-stat-value">卷章</div>
              <div className="landing-stat-label">三级结构管理</div>
            </div>
            <div>
              <div className="landing-stat-value">插件</div>
              <div className="landing-stat-label">7 大写作辅助</div>
            </div>
            <div>
              <div className="landing-stat-value">云端</div>
              <div className="landing-stat-label">自动保存同步</div>
            </div>
          </div>
        </div>

        <div className="landing-hero-visual">
          <div className="landing-preview">
            <div className="landing-preview-title">第一章 · 序章</div>
            <p>　　晨光透过窗棂，落在案头未干的墨迹上。他提笔，思绪如泉涌，故事从这里开始……</p>
            <p>　　每一个字，都是通往另一个世界的门。</p>
          </div>
        </div>
      </section>

      <section className="landing-features">
        <h2 className="landing-section-title">为长篇创作而设计</h2>
        <p className="landing-section-desc">从书库管理到章节编辑，全流程覆盖小说写作场景</p>
        <div className="landing-features-grid">
          <div className="landing-feature-card">
            <div className="landing-feature-icon"><Layers size={22} /></div>
            <h3>卷章结构管理</h3>
            <p>书籍 → 卷 → 章三级架构，拖拽排序、批量导出，适合百万字长篇连载</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon"><PenLine size={22} /></div>
            <h3>专业码字编辑器</h3>
            <p>纸感排版、字体行距、查找替换，沉浸式写作体验，自动保存不丢稿</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon"><Sparkles size={22} /></div>
            <h3>写作插件工具箱</h3>
            <p>随机取名、人物卡片、关系图谱、时间线、地图定位，辅助世界观构建</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon"><BookOpen size={22} /></div>
            <h3>书库与分组</h3>
            <p>按分类、标签、书名智能分组，右键快捷操作，多本书籍一目了然</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon"><Cloud size={22} /></div>
            <h3>云端同步备份</h3>
            <p>一键同步书库数据，多端访问，创作成果安全存储在云端</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon"><Shield size={22} /></div>
            <h3>企业级数据隔离</h3>
            <p>JWT 身份认证，按用户隔离数据，每本书仅作者本人可访问与编辑</p>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <FileText size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        墨坊 InkStudio Enterprise · 专注小说创作的专业平台
      </footer>
    </div>
  );
};

const AppContent = () => (
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route
      path="/books"
      element={
        <ProtectedRoute>
          <Books />
        </ProtectedRoute>
      }
    />
    <Route
      path="/editor/:id"
      element={
        <ProtectedRoute>
          <EditorPage />
        </ProtectedRoute>
      }
    />
    <Route path="*" element={<Navigate to="/" />} />
  </Routes>
);

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
