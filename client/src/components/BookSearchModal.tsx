import React, { useEffect, useState, useCallback } from 'react';
import { X, Search, FileText, Folder, Loader2, SearchX } from 'lucide-react';
import api from '../api';

interface SearchResult {
  chapterId: string;
  chapterTitle: string;
  volumeId: string;
  volumeTitle: string;
  matchInTitle: boolean;
  snippet: string;
}

interface BookSearchModalProps {
  bookId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectChapter: (chapterId: string) => void;
}

function highlightSnippet(snippet: string, query: string): React.ReactNode {
  if (!snippet || !query.trim()) return snippet;
  const q = query.trim();
  const lower = snippet.toLowerCase();
  const qLower = q.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return snippet;
  return (
    <>
      {snippet.slice(0, idx)}
      <mark className="search-highlight">{snippet.slice(idx, idx + q.length)}</mark>
      {snippet.slice(idx + q.length)}
    </>
  );
}

const BookSearchModal: React.FC<BookSearchModalProps> = ({
  bookId,
  isOpen,
  onClose,
  onSelectChapter,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSearched(false);
    }
  }, [isOpen]);

  const handleSearch = useCallback(async (q?: string) => {
    const term = (q ?? query).trim();
    if (!term) return;
    setSearching(true);
    setSearched(true);
    try {
      const { data } = await api.get(`/api/books/${bookId}/search`, { params: { q: term } });
      setResults(data.results || []);
    } catch {
      setResults([]);
    }
    setSearching(false);
  }, [bookId, query]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay feature-modal-overlay" onClick={onClose}>
      <div className="modal-card search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="feature-modal-header">
          <div className="feature-modal-title">
            <span className="feature-modal-icon search-icon"><Search size={18} /></span>
            <div>
              <h2>全书搜索</h2>
              <p className="feature-modal-subtitle">搜索章节标题与正文内容</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="关闭"><X size={16} /></button>
        </div>

        <div className="search-modal-searchbox">
          <Search size={18} className="search-modal-search-icon" />
          <input
            className="search-modal-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入关键词，搜索章节标题或正文..."
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            className="btn btn-primary search-modal-submit"
            onClick={() => handleSearch()}
            disabled={searching || !query.trim()}
          >
            {searching ? <><Loader2 size={16} className="spin-icon" /> 搜索中</> : '搜索'}
          </button>
        </div>

        <div className="search-modal-body">
          {searching && (
            <div className="search-modal-state">
              <Loader2 size={28} className="spin-icon search-state-icon" />
              <p>正在搜索全书内容...</p>
            </div>
          )}

          {!searching && !searched && (
            <div className="search-modal-state">
              <Search size={32} className="search-state-icon muted" />
              <p className="search-state-title">搜索你的作品</p>
              <p className="search-state-desc">支持搜索章节标题和正文，Enter 键快速搜索</p>
            </div>
          )}

          {!searching && searched && results.length === 0 && (
            <div className="search-modal-state">
              <SearchX size={32} className="search-state-icon muted" />
              <p className="search-state-title">未找到「{query}」</p>
              <p className="search-state-desc">试试更短的关键词，或检查拼写</p>
            </div>
          )}

          {!searching && results.length > 0 && (
            <>
              <div className="search-results-head">
                找到 <strong>{results.length}</strong> 处匹配
              </div>
              <div className="search-results-list">
                {results.map((r) => (
                  <button
                    key={r.chapterId}
                    className="search-result-card"
                    onClick={() => {
                      onSelectChapter(r.chapterId);
                      onClose();
                    }}
                  >
                    <span className="search-result-icon"><FileText size={16} /></span>
                    <div className="search-result-content">
                      <div className="search-result-path">
                        <Folder size={12} />
                        <span>{r.volumeTitle}</span>
                        <span className="search-path-sep">/</span>
                        <span className="search-chapter-name">{r.chapterTitle}</span>
                        {r.matchInTitle && <span className="search-badge">标题</span>}
                      </div>
                      {r.snippet && (
                        <p className="search-result-snippet">{highlightSnippet(r.snippet, query)}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookSearchModal;
