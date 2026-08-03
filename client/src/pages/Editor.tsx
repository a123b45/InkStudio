import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Descendant } from 'slate';
import api from '../api';
import SlateEditorComponent from '../components/SlateEditor';
import VolumeChapterSidebar, { ExportFormat } from '../components/VolumeChapterSidebar';
import PluginPanel from '../components/PluginPanel';
import VersionHistoryModal from '../components/VersionHistoryModal';
import BookSearchModal from '../components/BookSearchModal';
import WritingStatsPanel from '../components/WritingStatsPanel';
import {
  FileEdit, ChevronLeft, BookOpen, Search, Clock, TrendingUp, Eye,
} from 'lucide-react';
import {
  slateToText, countWords, downloadText, downloadMarkdown, downloadDocx,
  downloadPdf, downloadEpub, downloadBookBackup,
} from '../utils/exportUtils';
import { recordWordDelta } from '../utils/writingStats';

interface ChapterLite {
  _id: string;
  title: string;
  order: number;
  updatedAt: string;
  summary?: string;
}

interface Volume {
  _id: string;
  title: string;
  order: number;
  chapters: ChapterLite[];
}

const initialContent: Descendant[] = [{ type: 'paragraph', children: [{ text: '' }] }] as any;

const EditorPage = () => {
  const { id: bookId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [bookTitle, setBookTitle] = useState('');
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [expandedVolumes, setExpandedVolumes] = useState<string[]>([]);
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [chapterTitle, setChapterTitle] = useState('');
  const [content, setContent] = useState<Descendant[]>(initialContent);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedVolumeIds, setSelectedVolumeIds] = useState<string[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [bookWords, setBookWords] = useState(0);

  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showBookSearch, setShowBookSearch] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevWordsRef = useRef(0);
  const summaryTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const fetchVolumes = useCallback(async () => {
    const [bookRes, volRes, statsRes] = await Promise.all([
      api.get(`/api/books/${bookId}`),
      api.get(`/api/volumes?book=${bookId}`),
      api.get(`/api/books/${bookId}/stats`).catch(() => ({ data: { totalWords: 0 } })),
    ]);
    setBookTitle(bookRes.data.title);
    setVolumes(volRes.data);
    setBookWords(statsRes.data.totalWords || 0);
    return volRes.data as Volume[];
  }, [bookId]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const vols = await fetchVolumes();
        if (cancelled) return;
        if (vols.length > 0) setExpandedVolumes(vols.map((v) => v._id));
        if (vols.length > 0 && vols[0].chapters.length > 0) {
          const firstChapId = vols[0].chapters[0]._id;
          const { data } = await api.get(`/api/chapters/${firstChapId}`);
          if (cancelled) return;
          setCurrentChapterId(firstChapId);
          setChapterTitle(data.title);
          const c = data.content?.length ? data.content : initialContent;
          setContent(c);
          prevWordsRef.current = countWords(slateToText(c));
        }
      } catch {
        if (!cancelled) { alert('书籍未找到'); navigate('/books'); }
      }
      if (!cancelled) setLoading(false);
    };
    init();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  const handleSelectChapter = async (chapterId: string) => {
    if (chapterId === currentChapterId) return;
    try {
      const { data } = await api.get(`/api/chapters/${chapterId}`);
      setCurrentChapterId(chapterId);
      setChapterTitle(data.title);
      const c = data.content?.length ? data.content : initialContent;
      setContent(c);
      prevWordsRef.current = countWords(slateToText(c));
    } catch {
      console.error('加载章节失败');
    }
  };

  const saveChapter = useCallback(async (newTitle: string, newContent: Descendant[]) => {
    if (!currentChapterId) return;
    setSaving(true);
    try {
      await api.put(`/api/chapters/${currentChapterId}`, { title: newTitle, content: newContent });
      const newWords = countWords(slateToText(newContent as any[]));
      recordWordDelta(prevWordsRef.current, newWords);
      prevWordsRef.current = newWords;
      setLastSaved(new Date());
      fetchVolumes();
    } catch {
      console.error('保存失败');
    }
    setSaving(false);
  }, [currentChapterId, fetchVolumes]);

  const scheduleSave = useCallback((newTitle: string, newContent: Descendant[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveChapter(newTitle, newContent), 2000);
  }, [saveChapter]);

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  const countStats = useCallback((slateContent: Descendant[]) => {
    const text = slateToText(slateContent as any[]);
    const chars = text.replace(/\s/g, '').length;
    return { chars, words: countWords(text) };
  }, []);

  const stats = countStats(content);

  const fetchChaptersData = async (chapterIds?: string[]) => {
    const ids = chapterIds || (currentChapterId ? [currentChapterId] : []);
    return Promise.all(ids.map(async (chapId) => {
      const { data } = await api.get(`/api/chapters/${chapId}`);
      let volTitle = '';
      let chapTitle = data.title || '';
      for (const vol of volumes) {
        const found = vol.chapters.find((c) => c._id === chapId);
        if (found) { chapTitle = found.title; volTitle = vol.title; break; }
      }
      return { title: chapTitle, volumeTitle: volTitle, content: data.content || [] };
    }));
  };

  const handleExport = async (mode: 'merged' | 'separate', format: ExportFormat) => {
    try {
      if (format === 'backup') {
        const { data } = await api.get(`/api/books/${bookId}/backup`);
        await downloadBookBackup(bookTitle || 'backup', data);
        return;
      }

      if (format === 'epub') {
        const allChapters: { title: string; volumeTitle: string; content: any[] }[] = [];
        for (const vol of volumes) {
          for (const ch of vol.chapters) {
            const { data } = await api.get(`/api/chapters/${ch._id}`);
            allChapters.push({ title: ch.title, volumeTitle: vol.title, content: data.content || [] });
          }
        }
        await downloadEpub(bookTitle || 'book', allChapters);
        return;
      }

      const chapterIds = batchMode && selectedChapterIds.length > 0
        ? selectedChapterIds
        : currentChapterId ? [currentChapterId] : [];

      if (chapterIds.length === 0) { alert('请先选择章节'); return; }

      const chaptersData = await fetchChaptersData(chapterIds);

      if (mode === 'merged') {
        const primary = chaptersData[0]?.volumeTitle || bookTitle || '导出';
        if (format === 'txt') {
          downloadText(`${primary}合集`, chaptersData.map((ch) => `【${ch.volumeTitle} — ${ch.title}】\n${slateToText(ch.content)}`).join('\n\n\n'));
        } else if (format === 'md') {
          const mdText = chaptersData.map((ch) => `## ${ch.volumeTitle}\n\n# ${ch.title}\n\n${slateToText(ch.content)}`).join('\n\n---\n\n');
          const blob = new Blob([mdText], { type: 'text/markdown;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `${primary}.md`; a.click();
          URL.revokeObjectURL(url);
        } else if (format === 'docx') {
          const merged = chaptersData.map((ch) => [{ type: 'heading-one', children: [{ text: ch.title }] }, ...ch.content]).flat();
          await downloadDocx(primary, bookTitle, merged);
        } else if (format === 'pdf') {
          const text = chaptersData.map((ch) => `【${ch.title}】\n${slateToText(ch.content)}`).join('\n\n');
          downloadPdf(primary, [{ type: 'paragraph', children: [{ text }] }]);
        }
      } else {
        for (let i = 0; i < chaptersData.length; i++) {
          const ch = chaptersData[i];
          setTimeout(async () => {
            if (format === 'txt') downloadText(ch.title, slateToText(ch.content));
            else if (format === 'md') downloadMarkdown(ch.title, ch.content);
            else if (format === 'docx') await downloadDocx(ch.title, ch.title, ch.content);
            else if (format === 'pdf') downloadPdf(ch.title, ch.content);
          }, i * 300);
        }
      }
    } catch {
      alert('导出失败，请重试');
    }
  };

  const handleReorderVolumes = async (volumeIds: string[]) => {
    setVolumes((prev) => volumeIds.map((id) => prev.find((v) => v._id === id)).filter(Boolean) as Volume[]);
    try {
      await api.put('/api/volumes/reorder', { book: bookId, volumeIds });
    } catch {
      fetchVolumes();
    }
  };

  const handleUpdateSummary = (chapterId: string, summary: string) => {
    setVolumes((prev) => prev.map((v) => ({
      ...v,
      chapters: v.chapters.map((c) => c._id === chapterId ? { ...c, summary } : c),
    })));
    if (summaryTimers.current[chapterId]) clearTimeout(summaryTimers.current[chapterId]);
    summaryTimers.current[chapterId] = setTimeout(async () => {
      try {
        await api.put(`/api/chapters/${chapterId}`, { summary });
      } catch { /* */ }
    }, 800);
  };

  const handleRestoreVersion = (restoredContent: any[], restoredTitle: string) => {
    setContent(restoredContent);
    setChapterTitle(restoredTitle);
    prevWordsRef.current = countWords(slateToText(restoredContent));
  };

  if (loading) {
    return <div className="editor-full-layout"><div className="loading-container" style={{ flex: 1 }}>加载中...</div></div>;
  }

  return (
    <div className="editor-full-layout">
      <header className="app-topbar">
        <div className="app-topbar-left">
          <Link to="/books" className="btn btn-sm btn-ghost" title="返回书库"><ChevronLeft size={18} /> 书库</Link>
          <span className="app-topbar-divider" />
          <BookOpen size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span className="app-topbar-title">{bookTitle || '加载中...'}</span>
        </div>
        <div className="app-topbar-right editor-topbar-actions">
          <button className="btn btn-sm btn-ghost" onClick={() => setShowBookSearch(true)} title="全书搜索"><Search size={16} /></button>
          <button className="btn btn-sm btn-ghost" onClick={() => setShowStats(true)} title="写作统计"><TrendingUp size={16} /></button>
          {currentChapterId && (
            <button className="btn btn-sm btn-ghost" onClick={() => setShowVersionHistory(true)} title="版本历史"><Clock size={16} /></button>
          )}
          <Link
            to={currentChapterId ? `/read/${bookId}?chapter=${currentChapterId}` : `/read/${bookId}`}
            className="btn btn-sm btn-ghost"
            title="阅读模式（目录 + 只读预览）"
          >
            <Eye size={16} /> 阅读模式
          </Link>
        </div>
      </header>

      <div className="editor-body">
        <VolumeChapterSidebar
          volumes={volumes}
          selectedChapterId={currentChapterId}
          selectedVolumeIds={selectedVolumeIds}
          selectedChapterIds={selectedChapterIds}
          batchMode={batchMode}
          expandedVolumes={expandedVolumes}
          onToggleVolume={(volId) => setExpandedVolumes((p) => p.includes(volId) ? p.filter((id) => id !== volId) : [...p, volId])}
          onSelectChapter={handleSelectChapter}
          onNewVolume={async () => {
            const title = prompt('请输入卷名：', '新卷');
            if (!title?.trim()) return;
            try {
              await api.post('/api/volumes', { title: title.trim(), book: bookId });
              const vols = await fetchVolumes();
              if (vols.length > 0) setExpandedVolumes((p) => [...p, vols[vols.length - 1]._id]);
            } catch { alert('创建卷失败'); }
          }}
          onNewChapter={async () => {
            const targetVol = volumes.find((v) => expandedVolumes.includes(v._id)) || volumes[0];
            if (!targetVol) { alert('请先创建一个卷'); return; }
            if (!expandedVolumes.includes(targetVol._id)) setExpandedVolumes((p) => [...p, targetVol._id]);
            const title = prompt('请输入章名：', '新章');
            if (!title?.trim()) return;
            try {
              const { data } = await api.post('/api/chapters', { title: title.trim(), volume: targetVol._id });
              await fetchVolumes();
              await handleSelectChapter(data._id);
            } catch { alert('创建章节失败'); }
          }}
          onToggleBatchSelect={() => { setBatchMode(!batchMode); setSelectedVolumeIds([]); setSelectedChapterIds([]); }}
          onToggleVolumeSelect={(volId) => {
            setSelectedVolumeIds((prev) => {
              const isAdding = !prev.includes(volId);
              const vol = volumes.find((v) => v._id === volId);
              if (vol) {
                const chapIds = vol.chapters.map((c) => c._id);
                setSelectedChapterIds((prevC) => isAdding ? [...new Set([...prevC, ...chapIds])] : prevC.filter((c) => !chapIds.includes(c)));
              }
              return isAdding ? [...prev, volId] : prev.filter((x) => x !== volId);
            });
          }}
          onToggleChapterSelect={(id) => setSelectedChapterIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])}
          onExport={handleExport}
          onDeleteSelected={async () => {
            const volCount = selectedVolumeIds.length;
            const chapCount = selectedChapterIds.length;
            if (volCount === 0 && chapCount === 0) return;
            if (!confirm(`确定删除选中的 ${volCount} 卷和 ${chapCount} 章节吗？`)) return;
            try {
              if (volCount > 0) await api.delete('/api/volumes/batch', { data: { ids: selectedVolumeIds } });
              if (chapCount > 0) await api.delete('/api/chapters/batch', { data: { ids: selectedChapterIds } });
              if (chapCount > 0 && selectedChapterIds.includes(currentChapterId || '')) {
                setCurrentChapterId(null); setChapterTitle(''); setContent(initialContent);
              }
              setSelectedVolumeIds([]); setSelectedChapterIds([]);
              await fetchVolumes();
            } catch { alert('删除失败'); }
          }}
          onEditVolume={async (volId, newTitle) => { try { await api.put(`/api/volumes/${volId}`, { title: newTitle }); fetchVolumes(); } catch { alert('重命名卷失败'); } }}
          onEditChapter={async (chapId, newTitle) => { try { await api.put(`/api/chapters/${chapId}`, { title: newTitle }); if (chapId === currentChapterId) setChapterTitle(newTitle); fetchVolumes(); } catch { alert('重命名章节失败'); } }}
          onDeleteSingle={async (type, id) => {
            try {
              if (type === 'volume') await api.delete(`/api/volumes/${id}`);
              else {
                await api.delete(`/api/chapters/${id}`);
                if (id === currentChapterId) { setCurrentChapterId(null); setChapterTitle(''); setContent(initialContent); }
              }
              await fetchVolumes();
            } catch { alert(`删除${type === 'volume' ? '卷' : '章节'}失败`); }
          }}
          onReorderChapters={async (volumeId, chapterIds) => {
            setVolumes((prev) => prev.map((v) => {
              if (v._id !== volumeId) return v;
              const sorted = chapterIds.map((id) => v.chapters.find((c) => c._id === id)).filter(Boolean) as ChapterLite[];
              return { ...v, chapters: sorted };
            }));
            try { await api.put('/api/chapters/reorder', { volume: volumeId, chapterIds }); } catch { fetchVolumes(); }
          }}
          onReorderVolumes={handleReorderVolumes}
          onUpdateSummary={handleUpdateSummary}
        />

        <main className="editor-main-area">
          {currentChapterId ? (
            <>
              <div className="editor-header">
                <input className="title-input" value={chapterTitle}
                  onChange={(e) => { setChapterTitle(e.target.value); scheduleSave(e.target.value, content); }}
                  placeholder="输入章节标题..." />
                <div className="editor-status">
                  <span className="word-count">{stats.words.toLocaleString()} 词 · {stats.chars.toLocaleString()} 字</span>
                  {saving ? <span className="saving">保存中...</span> : lastSaved ? <span className="saved">已保存 {lastSaved.toLocaleTimeString('zh-CN')}</span> : null}
                  <button className="btn btn-primary btn-sm" onClick={() => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); saveChapter(chapterTitle, content); }}>立即保存</button>
                </div>
              </div>
              <div className="editor-canvas">
                <SlateEditorComponent key={currentChapterId} value={content}
                  onChange={(nc) => { setContent(nc); scheduleSave(chapterTitle, nc); }}
                  placeholder="开始书写你的灵感..." />
              </div>
              <div className="editor-statusbar">
                <span>{stats.words.toLocaleString()} 词</span>
                <span className="status-sep">|</span>
                <span>{stats.chars.toLocaleString()} 字</span>
                <span className="status-sep">|</span>
                <span>约 {Math.max(1, Math.ceil(stats.words / 300))} 分钟阅读</span>
                <span className="status-sep">|</span>
                <span>全书 {bookWords.toLocaleString()} 词</span>
                <span style={{ flex: 1 }} />
                <span>{bookTitle}</span>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon"><FileEdit size={48} /></div>
              <h3>{volumes.length === 0 ? '还没有卷和章节' : '请选择一个章节开始编辑'}</h3>
              <p>{volumes.length === 0 ? '点击左侧「＋ 卷」创建第一卷，然后添加章节' : '在左侧选择要编辑的章节'}</p>
            </div>
          )}
        </main>

        <PluginPanel currentChapterId={currentChapterId} chapterTitle={chapterTitle} />
      </div>

      <VersionHistoryModal chapterId={currentChapterId} isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)} onRestore={handleRestoreVersion} />
      <BookSearchModal bookId={bookId!} isOpen={showBookSearch}
        onClose={() => setShowBookSearch(false)} onSelectChapter={handleSelectChapter} />
      <WritingStatsPanel isOpen={showStats} onClose={() => setShowStats(false)} bookWords={bookWords} />
    </div>
  );
};

export default EditorPage;
