import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PenTool, User } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <PenTool size={20} /> 文档编辑器
      </Link>
      <div className="navbar-links">
        {user ? (
          <>
            <Link to="/documents">我的文档</Link>
            <span className="navbar-user"><User size={16} /> {user.username}</span>
            <button className="btn btn-sm" onClick={handleLogout}>
              退出登录
            </button>
          </>
        ) : (
          <>
            <Link to="/login">登录</Link>
            <Link to="/register">注册</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
