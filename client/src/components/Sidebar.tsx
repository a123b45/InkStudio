import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import EditProfileModal from './EditProfileModal';
import BookContextMenu from './BookContextMenu';
import { ChevronRight, Plus, Tag, FolderOpen, Search, List, BookOpen, Pencil, LogOut } from 'lucide-react';
import { resolveAssetUrl } from '../utils/assetUrl';

interface Book {
  _id: string;
  title: string;
  category: string;
}

interface Group {
  _id: string;
  name: string;
  method: string;
  books: Book[];
}

interface SidebarProps {
  books: Book[];
  groups: Group[];
  selectedCategory: string;
  expandedGroups: string[];
  onSelectCategory: (category: string) => void;
  onSelectBook: (id: string) => void;
  selectedBookId: string | null;
  onToggleGroup: (groupId: string) => void;
  onEditBook: (bookId: string) => void;
  onAddToGroup: (bookId: string, groupId: string) => void;
  onNewGroupForBook: (bookId: string) => void;
  onNewGroup: () => void;
  onNewBook: () => void;
}

const CATEGORIES = ['全部', '小说', '技术', '文学', '历史', '哲学', '科学', '艺术', '其他'];

const Sidebar: React.FC<SidebarProps> = ({
  books,
  groups,
  selectedCategory,
  expandedGroups,
  onSelectCategory,
  onSelectBook,
  selectedBookId,
  onToggleGroup,
  onEditBook,
  onAddToGroup,
  onNewGroupForBook,
  onNewGroup,
  onNewBook,
}) => {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [groupsCollapsed, setGroupsCollapsed] = useState(false);
  const [booksCollapsed, setBooksCollapsed] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    bookId: string;
    bookTitle: string;
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBookContextMenu = (
    e: React.MouseEvent,
    bookId: string,
    bookTitle: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, bookId, bookTitle });
  };

  const filteredBooks =
    selectedCategory === '全部' || selectedCategory === ''
      ? books
      : books.filter((b) => b.category === selectedCategory);

  return (
    <>
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <Link to="/" className="brand" title="返回首页">
            <span className="brand-mark sm">墨</span>
            <span className="brand-text">
              <span className="brand-name">墨坊</span>
              <span className="brand-tagline">InkStudio</span>
            </span>
          </Link>
        </div>

        {/* User avatar and name area */}
        <div className="sidebar-user" ref={dropdownRef}>
          <div
            className="sidebar-avatar clickable"
            onClick={() => setShowDropdown(!showDropdown)}
            title="点击查看选项"
          >
            {user?.avatar ? (
              <img src={resolveAssetUrl(user.avatar)} alt={user.username} />
            ) : (
              <div className="avatar-placeholder">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>
          <div
            className="sidebar-user-info"
            onClick={() => setShowDropdown(!showDropdown)}
            style={{ cursor: 'pointer' }}
          >
            <span className="sidebar-username">{user?.username || '用户'}</span>
            {(user as any)?.bio && (
              <span className="sidebar-user-bio">{(user as any).bio}</span>
            )}
          </div>

          {/* Dropdown menu */}
          {showDropdown && (
            <div className="sidebar-dropdown">
              <button
                className="dropdown-item"
                onClick={() => {
                  setShowDropdown(false);
                  setShowEditProfile(true);
                }}
              >
                <Pencil size={14} /> 编辑资料
              </button>
              <div className="dropdown-divider" />
              <button
                className="dropdown-item danger"
                onClick={() => {
                  setShowDropdown(false);
                  logout();
                }}
              >
                <LogOut size={14} /> 退出登录
              </button>
            </div>
          )}
        </div>

        <div className="sidebar-body">
        {/* Category navigation */}
        <nav className="sidebar-nav">
          <p className="sidebar-section-title">分类</p>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`sidebar-nav-item ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => onSelectCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </nav>

        {/* Groups section */}
        <div className="sidebar-groups">
          <div
            className="sidebar-section-header clickable"
            onClick={() => setGroupsCollapsed(!groupsCollapsed)}
          >
            <span className={`section-arrow ${!groupsCollapsed ? 'expanded' : ''}`}><ChevronRight size={14} /></span>
            <p className="sidebar-section-title">分组列表</p>
            {groups.length > 0 && (
              <span className="sidebar-count">{groups.length}</span>
            )}
            <button
              className="sidebar-add-btn"
              onClick={(e) => {
                e.stopPropagation();
                onNewGroup();
              }}
              title="新建分组"
            >
              <Plus size={16} />
            </button>
          </div>

          {!groupsCollapsed && (
            <>
              {groups.length === 0 ? (
                <p className="sidebar-empty">暂无分组</p>
              ) : (
                <div className="sidebar-group-list">
              {groups.map((group) => {
                const isExpanded = expandedGroups.includes(group._id);
                return (
                  <div key={group._id} className="sidebar-group">
                    <button
                      className="sidebar-group-header"
                      onClick={() => onToggleGroup(group._id)}
                    >
                      <span
                        className={`group-arrow ${isExpanded ? 'expanded' : ''}`}
                      >
                        <ChevronRight size={14} />
                      </span>
                      <span className="group-icon">
                        {group.method === 'tags'
                          ? <Tag size={14} />
                          : group.method === 'category'
                          ? <FolderOpen size={14} />
                          : group.method === 'bookName'
                          ? <Search size={14} />
                          : <List size={14} />}
                      </span>
                      <span className="group-name">{group.name}</span>
                      <span className="group-count">{group.books.length}</span>
                    </button>

                    {isExpanded && (
                      <div className="sidebar-group-books">
                        {group.books.length === 0 ? (
                          <p className="sidebar-empty">该分组暂无书籍</p>
                        ) : (
                          (group.books as Book[]).map((book) => (
                            <div
                              key={book._id}
                              className={`sidebar-book-item ${selectedBookId === book._id ? 'active' : ''}`}
                              onClick={() => onSelectBook(book._id)}
                              onContextMenu={(e) =>
                                handleBookContextMenu(e, book._id, book.title)
                              }
                            >
                              <span className="book-item-icon"><BookOpen size={14} /></span>
                              <span className="book-item-title">{book.title}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
              )}
            </>
          )}
        </div>

        {/* Book list (all books) */}
        <div className="sidebar-books">
          <div
            className="sidebar-section-header clickable"
            onClick={() => setBooksCollapsed(!booksCollapsed)}
          >
            <span className={`section-arrow ${!booksCollapsed ? 'expanded' : ''}`}><ChevronRight size={14} /></span>
            <p className="sidebar-section-title">书籍列表</p>
            {filteredBooks.length > 0 && (
              <span className="sidebar-count">{filteredBooks.length}</span>
            )}
            <button
              className="sidebar-add-btn"
              onClick={(e) => {
                e.stopPropagation();
                onNewBook();
              }}
              title="新建书籍"
            >
              <Plus size={16} />
            </button>
          </div>

          {!booksCollapsed && (
            <>
              {filteredBooks.length === 0 ? (
                <p className="sidebar-empty">暂无书籍</p>
              ) : (
                <ul className="sidebar-book-list">
                  {filteredBooks.map((book) => (
                    <li
                      key={book._id}
                      className={`sidebar-book-item ${selectedBookId === book._id ? 'active' : ''}`}
                      onClick={() => onSelectBook(book._id)}
                      onContextMenu={(e) =>
                        handleBookContextMenu(e, book._id, book.title)
                      }
                    >
                      <span className="book-item-icon"><BookOpen size={14} /></span>
                      <span className="book-item-title">{book.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        </div>
      </aside>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={showEditProfile}
        onClose={() => setShowEditProfile(false)}
      />

      {/* Context Menu */}
      {contextMenu && (
        <BookContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          bookId={contextMenu.bookId}
          bookTitle={contextMenu.bookTitle}
          groups={groups.map((g) => ({ _id: g._id, name: g.name }))}
          onClose={() => setContextMenu(null)}
          onEditBook={(bookId) => {
            setContextMenu(null);
            onEditBook(bookId);
          }}
          onAddToGroup={(bookId, groupId) => {
            setContextMenu(null);
            onAddToGroup(bookId, groupId);
          }}
          onNewGroup={(bookId) => {
            setContextMenu(null);
            onNewGroupForBook(bookId);
          }}
        />
      )}
    </>
  );
};

export default Sidebar;
