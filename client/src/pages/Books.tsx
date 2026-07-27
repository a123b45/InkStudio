import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import Sidebar from '../components/Sidebar';
import BookGrid from '../components/BookGrid';
import { RefreshCw, Download, Plus } from 'lucide-react';
import NewBookModal from '../components/NewBookModal';
import ImportBookModal from '../components/ImportBookModal';
import NewGroupModal from '../components/NewGroupModal';
import EditBookModal from '../components/EditBookModal';

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
  method: string;
  config: any;
  books: Book[];
  updatedAt: string;
}

const Books = () => {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Modal states
  const [showNewModal, setShowNewModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [editBookTarget, setEditBookTarget] = useState<Book | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchBooks = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (selectedCategory !== '全部' && selectedCategory !== '') {
        params.category = selectedCategory;
      }
      const { data } = await api.get('/api/books', { params });
      setBooks(data);
    } catch {
      console.error('获取书籍列表失败');
    }
    setLoading(false);
  }, [selectedCategory]);

  const fetchGroups = useCallback(async () => {
    try {
      const { data } = await api.get('/api/groups');
      setGroups(data);
    } catch {
      console.error('获取分组列表失败');
    }
  }, []);

  useEffect(() => {
    fetchBooks();
    fetchGroups();
  }, [fetchBooks, fetchGroups]);

  const refreshAll = () => {
    fetchBooks();
    fetchGroups();
  };

  const handleSelectBook = (id: string) => {
    setSelectedBookId(id);
    window.open(`/editor/${id}`, '_blank');
  };

  const handleDeleteBook = async (id: string) => {
    if (!confirm('确定要删除这本书吗？')) return;
    try {
      await api.delete(`/api/books/${id}`);
      setBooks(books.filter((b) => b._id !== id));
      // Refresh groups since book may have been in groups
      fetchGroups();
    } catch {
      alert('删除书籍失败');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post('/api/books/sync', {
        lastSync: null,
      });
      setBooks(data.books);
      alert(`同步完成！共 ${data.count} 本书籍`);
    } catch {
      alert('同步失败，请重试');
    }
    setSyncing(false);
  };

  // Group handlers
  const handleToggleGroup = (groupId: string) => {
    setExpandedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleEditBook = (bookId: string) => {
    const book = books.find((b) => b._id === bookId);
    if (book) {
      setEditBookTarget(book);
    }
  };

  const handleAddToGroup = async (bookId: string, groupId: string) => {
    try {
      await api.put(`/api/groups/${groupId}/books/${bookId}`);
      fetchGroups();
    } catch {
      alert('添加到分组失败');
    }
  };

  const handleNewGroupForBook = (bookId: string) => {
    // Open new group modal — the book will need to be manually added
    // after group creation, or we can auto-add the book to the new custom group
    setShowNewGroupModal(true);
    // Store the bookId so when group is created we add the book to it
    sessionStorage.setItem('pendingGroupBookId', bookId);
  };

  const handleGroupCreated = async () => {
    setShowNewGroupModal(false);
    fetchGroups();

    // If a book was pending to be added to a new group
    const pendingBookId = sessionStorage.getItem('pendingGroupBookId');
    if (pendingBookId) {
      sessionStorage.removeItem('pendingGroupBookId');
      // The newest group is the one we just created — add the book to it
      try {
        const { data } = await api.get('/api/groups');
        if (data.length > 0) {
          const newest = data[0]; // sorted by updatedAt desc
          await api.put(`/api/groups/${newest._id}/books/${pendingBookId}`);
          fetchGroups();
        }
      } catch {
        // Non-critical — user can add manually
      }
    }
  };

  // Compute all tags and categories from books for the NewGroupModal
  const allTags = [...new Set(books.flatMap((b) => b.tags).filter(Boolean))];
  const allCategories = [
    ...new Set(books.map((b) => b.category).filter(Boolean)),
  ];

  // Display books filtered by the currently selected category
  const filteredBooks =
    selectedCategory === '全部' || selectedCategory === ''
      ? books
      : books.filter((b) => b.category === selectedCategory);

  // Map groups for BookContextMenu (only need _id and name)
  const groupsForMenu = groups.map((g) => ({ _id: g._id, name: g.name }));

  if (loading) {
    return (
      <div className="app-layout">
        <Sidebar
          books={[]}
          groups={[]}
          selectedCategory={selectedCategory}
          expandedGroups={[]}
          onSelectCategory={setSelectedCategory}
          onSelectBook={handleSelectBook}
          selectedBookId={null}
          onToggleGroup={handleToggleGroup}
          onEditBook={handleEditBook}
          onAddToGroup={handleAddToGroup}
          onNewGroupForBook={handleNewGroupForBook}
          onNewGroup={() => setShowNewGroupModal(true)}
          onNewBook={() => setShowNewModal(true)}
        />
        <main className="main-content">
          <div className="loading-container">加载中...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Left Sidebar */}
      <Sidebar
        books={books}
        groups={groups}
        selectedCategory={selectedCategory}
        expandedGroups={expandedGroups}
        onSelectCategory={setSelectedCategory}
        onSelectBook={handleSelectBook}
        selectedBookId={selectedBookId}
        onToggleGroup={handleToggleGroup}
        onEditBook={handleEditBook}
        onAddToGroup={handleAddToGroup}
        onNewGroupForBook={handleNewGroupForBook}
        onNewGroup={() => setShowNewGroupModal(true)}
        onNewBook={() => setShowNewModal(true)}
      />

      {/* Main Content */}
      <main className="main-content">
        {/* Toolbar */}
        <div className="main-toolbar">
          <div className="toolbar-left">
            <h1 className="page-title">
              {selectedCategory === '全部' ? '我的书库' : selectedCategory}
            </h1>
            <span className="book-count">{filteredBooks.length} 本</span>
          </div>
          <div className="toolbar-actions">
            <button
              className="btn"
              onClick={handleSync}
              disabled={syncing}
              title="同步书籍数据"
            >
              {syncing ? <><RefreshCw size={16} className="spin-icon" /> 同步中...</> : <><RefreshCw size={16} /> 同步书籍</>}
            </button>
            <button
              className="btn"
              onClick={() => setShowImportModal(true)}
              title="从 TXT / Markdown / JSON 导入书籍"
            >
              <Download size={16} /> 导入书籍
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setShowNewModal(true)}
            >
              <Plus size={16} /> 新建书籍
            </button>
          </div>
        </div>

        {/* Book Grid */}
        <BookGrid
          books={filteredBooks}
          groups={groupsForMenu}
          onSelectBook={handleSelectBook}
          onDeleteBook={handleDeleteBook}
          onEditBook={handleEditBook}
          onAddToGroup={handleAddToGroup}
          onNewGroupForBook={handleNewGroupForBook}
        />
      </main>

      {/* Modals */}
      <NewBookModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={() => {
          setShowNewModal(false);
          refreshAll();
        }}
      />

      <ImportBookModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={() => {
          setShowImportModal(false);
          refreshAll();
        }}
      />

      <NewGroupModal
        isOpen={showNewGroupModal}
        onClose={() => {
          setShowNewGroupModal(false);
          sessionStorage.removeItem('pendingGroupBookId');
        }}
        onCreated={handleGroupCreated}
        allTags={allTags}
        allCategories={allCategories}
      />

      <EditBookModal
        isOpen={!!editBookTarget}
        onClose={() => setEditBookTarget(null)}
        onSaved={refreshAll}
        book={editBookTarget}
      />
    </div>
  );
};

export default Books;
