import React, { useState } from 'react';
import BookContextMenu from './BookContextMenu';
import { Library, BookOpen, ChevronRight } from 'lucide-react';
import { resolveAssetUrl } from '../utils/assetUrl';

interface Book {
  _id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  cover: string;
  updatedAt: string;
  createdAt: string;
}

interface Group {
  _id: string;
  name: string;
}

interface BookGridProps {
  books: Book[];
  groups: Group[];
  onSelectBook: (id: string) => void;
  onDeleteBook: (id: string) => void;
  onEditBook: (bookId: string) => void;
  onAddToGroup: (bookId: string, groupId: string) => void;
  onNewGroupForBook: (bookId: string) => void;
}

const BookGrid: React.FC<BookGridProps> = ({
  books,
  groups,
  onSelectBook,
  onDeleteBook,
  onEditBook,
  onAddToGroup,
  onNewGroupForBook,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    bookId: string;
    bookTitle: string;
  } | null>(null);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('zh-CN');

  const handleContextMenu = (
    e: React.MouseEvent,
    bookId: string,
    bookTitle: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, bookId, bookTitle });
  };

  if (books.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><Library size={48} /></div>
        <h3>还没有书籍</h3>
        <p>点击上方按钮创建、导入或同步书籍</p>
      </div>
    );
  }

  return (
    <>
      <div className="book-grid">
        {books.map((book) => (
          <div
            className="book-card"
            key={book._id}
            onClick={() => onSelectBook(book._id)}
            onContextMenu={(e) => handleContextMenu(e, book._id, book.title)}
          >
            {/* Cover */}
            <div className="book-card-cover">
              {book.cover ? (
                <img src={resolveAssetUrl(book.cover)} alt={book.title} />
              ) : (
                <div className="cover-placeholder">
                  <span><BookOpen size={24} /></span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="book-card-body">
              <h3 className="book-card-title">{book.title}</h3>
              <p className="book-card-desc">
                {book.description
                  ? book.description.length > 80
                    ? book.description.slice(0, 80) + '...'
                    : book.description
                  : '暂无简介'}
              </p>

              {/* Meta */}
              <div className="book-card-meta">
                {book.category && (
                  <span className="book-category-tag">{book.category}</span>
                )}
                {book.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="book-tag">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="book-card-footer">
                <span className="book-card-date">{formatDate(book.updatedAt)}</span>
                <span className="book-card-open">
                  开始写作 <ChevronRight size={14} />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <BookContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          bookId={contextMenu.bookId}
          bookTitle={contextMenu.bookTitle}
          groups={groups}
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

export default BookGrid;
