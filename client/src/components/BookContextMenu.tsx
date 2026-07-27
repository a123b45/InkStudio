import React, { useEffect, useRef, useCallback } from 'react';
import { Pencil, FolderPlus, Plus } from 'lucide-react';

interface Group {
  _id: string;
  name: string;
}

interface BookContextMenuProps {
  x: number;
  y: number;
  bookId: string;
  bookTitle: string;
  groups: Group[];
  onClose: () => void;
  onEditBook: (bookId: string) => void;
  onAddToGroup: (bookId: string, groupId: string) => void;
  onNewGroup: (bookId: string) => void;
}

const BookContextMenu: React.FC<BookContextMenuProps> = ({
  x,
  y,
  bookId,
  bookTitle,
  groups,
  onClose,
  onEditBook,
  onAddToGroup,
  onNewGroup,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showGroupSubmenu, setShowGroupSubmenu] = React.useState(false);

  // Click outside closes the whole menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const handleTriggerEnter = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setShowGroupSubmenu(true);
  }, []);

  const handleTriggerLeave = useCallback(() => {
    // Delay hiding — if the submenu gets mouseenter within 150ms, it cancels
    closeTimerRef.current = setTimeout(() => {
      setShowGroupSubmenu(false);
    }, 150);
  }, []);

  const handleSubmenuEnter = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handleSubmenuLeave = useCallback(() => {
    setShowGroupSubmenu(false);
  }, []);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 340);
  const adjustedY = Math.min(y, window.innerHeight - 300);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <div className="context-menu-header">{bookTitle}</div>
      <div className="context-menu-divider" />

      <button
        className="context-menu-item"
        onClick={() => {
          onClose();
          onEditBook(bookId);
        }}
      >
        <Pencil size={14} /> 编辑书籍
      </button>

      <div
        className="context-menu-item has-submenu"
        onMouseEnter={handleTriggerEnter}
        onMouseLeave={handleTriggerLeave}
      >
        <FolderPlus size={14} /> 添加到分组 ▸

        {showGroupSubmenu && (
          <div
            ref={submenuRef}
            className="context-submenu"
            onMouseEnter={handleSubmenuEnter}
            onMouseLeave={handleSubmenuLeave}
          >
            {groups.length > 0 ? (
              <>
                {groups.map((group) => (
                  <button
                    key={group._id}
                    className="context-menu-item"
                    onClick={() => {
                      onClose();
                      onAddToGroup(bookId, group._id);
                    }}
                  >
                    {group.name}
                  </button>
                ))}
                <div className="context-menu-divider" />
              </>
            ) : null}
            <button
              className="context-menu-item"
              onClick={() => {
                onClose();
                onNewGroup(bookId);
              }}
            >
              <Plus size={14} /> 新建分组
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookContextMenu;
