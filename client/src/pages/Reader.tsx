import React, { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import { slateToText } from '../utils/exportUtils';
import { BookOpen, ChevronLeft, Moon, Sun, Eye } from 'lucide-react';

interface ChapterLite {
  _id: string;
  title: string;
  order: number;
}

interface Volume {
  _id: string;
  title: string;
  order: number;
  chapters: ChapterLite[];
}

const ReaderPage = () => {
  const { id: bookId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialChapterId = searchParams.get('chapter');

  const [book, setBook] = useState<{ title: string; description?: string } | null>(null);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [chapterTitle, setChapterTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);

  const loadChapter = async (chapterId: string) => {
    const { data } = await api.get(`/api/chapters/${chapterId}`);
    setCurrentChapterId(chapterId);
    setChapterTitle(data.title);
    setContent(slateToText(data.content || []));
  };

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const [bookRes, volRes] = await Promise.all([
          api.get(`/api/books/${bookId}`),
          api.get(`/api/volumes?book=${bookId}`),
        ]);
        if (cancelled) return;
        setBook(bookRes.data);
        setVolumes(volRes.data);

        const allChapters = volRes.data.flatMap((v: Volume) => v.chapters);
        const targetId =
          initialChapterId && allChapters.some((c: ChapterLite) => c._id === initialChapterId)
            ? initialChapterId
            : allChapters[0]?._id;

        if (targetId) await loadChapter(targetId);
      } catch {
        if (!cancelled) setBook(null);
      }
      if (!cancelled) setLoading(false);
    };
    init();
    return () => { cancelled = true; };
  }, [bookId, initialChapterId]);

  if (loading) {
    return <div className="reader-page"><div className="loading-container">加载中...</div></div>;
  }

  if (!book) {
    return (
      <div className="reader-page">
        <div className="empty-state">
          <h3>书籍未找到</h3>
          <Link to="/books" className="btn btn-primary">返回书库</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`reader-page${dark ? ' reader-dark' : ''}`}>
      <header className="reader-header">
        <Link to="/" className="brand brand--topbar" title="返回首页">
          <span className="brand-mark sm">墨</span>
          <span className="brand-text">
            <span className="brand-name">墨坊</span>
            <span className="brand-tagline">InkStudio</span>
          </span>
        </Link>
        <Link to={`/editor/${bookId}`} className="btn btn-sm btn-ghost">
          <ChevronLeft size={16} /> 返回编辑
        </Link>
        <span className="reader-book-title">
          <BookOpen size={16} /> {book.title}
          <span className="reader-mode-badge"><Eye size={12} /> 阅读模式</span>
        </span>
        <button className="btn btn-sm btn-ghost" onClick={() => setDark(!dark)} title="切换主题">
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </header>

      <div className="reader-body">
        <aside className="reader-sidebar">
          <p className="editor-sidebar-label">目录</p>
          {volumes.map((vol) => (
            <div key={vol._id} className="reader-vol">
              <div className="reader-vol-title">{vol.title}</div>
              {vol.chapters.map((ch) => (
                <button
                  key={ch._id}
                  className={`reader-chapter${currentChapterId === ch._id ? ' active' : ''}`}
                  onClick={() => loadChapter(ch._id)}
                >
                  {ch.title}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <main className="reader-content reader-readonly">
          {currentChapterId ? (
            <>
              <h2 className="reader-chapter-heading">{chapterTitle}</h2>
              {content.split('\n\n').filter(Boolean).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {!content.trim() && <p className="reader-empty-chapter">本章暂无内容</p>}
            </>
          ) : (
            <div className="empty-state"><p>请选择章节阅读</p></div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ReaderPage;
