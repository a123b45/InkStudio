import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Mars, Venus, User } from 'lucide-react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();

  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Populate form from current user data
  useEffect(() => {
    if (user && isOpen) {
      setUsername(user.username || '');
      setGender((user as any).gender || '');
      setBio((user as any).bio || '');
      setAvatarPreview(user.avatar || '');
      setAvatarFile(null);
      setError('');
      setSuccess('');
    }
  }, [user, isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim() || username.trim().length < 2) {
      setError('昵称需要至少2个字符');
      return;
    }

    setLoading(true);

    try {
      // Upload avatar first if changed
      let avatarUrl: string | undefined;
      if (avatarFile) {
        const formData = new FormData();
        formData.append('cover', avatarFile);
        const uploadRes = await api.post('/api/upload/cover', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        avatarUrl = uploadRes.data.url;
      }

      // Update profile
      const updateData: Record<string, string> = {
        username: username.trim(),
        gender,
        bio: bio.trim(),
      };
      if (avatarUrl) {
        updateData.avatar = avatarUrl;
      }

      await api.put('/api/auth/profile', updateData);

      // Refresh user data in context
      const { data } = await api.get('/api/auth/me');
      updateProfile(data);

      setSuccess('资料已更新！');
      setTimeout(() => {
        setSuccess('');
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.message || '更新资料失败');
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card-compact" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>编辑资料</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-msg">{error}</div>}
          {success && (
            <div className="success-msg">{success}</div>
          )}

          {/* 更换头像 */}
          <div className="form-group">
            <label>更换头像</label>
            <div className="avatar-edit-area">
              <div
                className="avatar-edit-preview"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="头像预览" />
                ) : (
                  <div className="avatar-placeholder large">
                    {username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div className="avatar-edit-overlay">
                  <span><Camera size={16} /> 更换</span>
                </div>
              </div>
              <p className="avatar-edit-hint">点击头像更换图片</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {/* 昵称 */}
          <div className="form-group">
            <label htmlFor="profile-username">昵称</label>
            <input
              id="profile-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入昵称（2-30个字符）"
            />
          </div>

          {/* 性别 */}
          <div className="form-group">
            <label>性别</label>
            <div className="gender-options">
              {['男', '女', '其他'].map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`gender-btn ${gender === g ? 'active' : ''}`}
                  onClick={() => setGender(gender === g ? '' : g)}
                >
                  {g === '男' ? <Mars size={16} /> : g === '女' ? <Venus size={16} /> : <User size={16} />} {g}
                </button>
              ))}
            </div>
          </div>

          {/* 个人签名 */}
          <div className="form-group">
            <label htmlFor="profile-bio">个人签名</label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="写一句个性签名..."
              rows={3}
              maxLength={200}
            />
            <span className="char-count">{bio.length}/200</span>
          </div>

          {/* Actions */}
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

export default EditProfileModal;
