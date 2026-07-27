import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Descendant } from 'slate';
import api from '../api';
import SlateEditorComponent from '../components/SlateEditor';
import { FileEdit, ChevronLeft, BookOpen } from 'lucide-react';
import VolumeChapterSidebar from '../components/VolumeChapterSidebar';
import PluginPanel from '../components/PluginPanel';

interface ChapterLite {
  _id: string;
  title: string;
  order: number;
  updatedAt: string;
}

interface Volume {
  _id: string;
  title: string;
  order: number;
  chapters: ChapterLite[];
}

const initialContent: Descendant[] = [
  { type: 'paragraph', children: [{ text: '' }] },
] as any;

const EditorPage = () => {
  const { id: bookId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Book
  const [bookTitle, setBookTitle] = useState('');

  // Volumes
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [expandedVolumes, setExpandedVolumes] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Current chapter editing
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  const [chapterTitle, setChapterTitle] = useState('');
  const [content, setContent] = useState<Descendant[]>(initialContent);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedVolumeIds, setSelectedVolumeIds] = useState<string[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Data loading (no side effects) ───
  const fetchVolumes = useCallback(async () => {
    const [bookRes, volRes] = await Promise.all([
      api.get(`/api/books/${bookId}`),
      api.get(`/api/volumes?book=${bookId}`),
    ]);
    setBookTitle(bookRes.data.title);
    setVolumes(volRes.data);
    return volRes.data as Volume[];
  }, [bookId]);

  // ─── Initial load (auto-expand + auto-select, runs once) ───
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const vols = await fetchVolumes();
        if (cancelled) return;

        // Expand all volumes on first load
        if (vols.length > 0) {
          setExpandedVolumes(vols.map((v: Volume) => v._id));
        }

        // Auto-select first chapter of first volume
        if (vols.length > 0) {
          const firstVol = vols[0];
          if (firstVol.chapters.length > 0) {
            const firstChapId = firstVol.chapters[0]._id;
            const { data } = await api.get(`/api/chapters/${firstChapId}`);
            if (cancelled) return;
            setCurrentChapterId(firstChapId);
            setChapterTitle(data.title);
            setContent(data.content?.length ? data.content : initialContent);
          }
        }
        setInitialized(true);
      } catch {
        if (!cancelled) {
          alert('书籍未找到');
          navigate('/books');
        }
      }
      if (!cancelled) setLoading(false);
    };
    init();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  // ─── Select a chapter — load its content ───
  const handleSelectChapter = async (chapterId: string) => {
    if (chapterId === currentChapterId) return;
    try {
      const { data } = await api.get(`/api/chapters/${chapterId}`);
      setCurrentChapterId(chapterId);
      setChapterTitle(data.title);
      setContent(data.content?.length ? data.content : initialContent);
    } catch {
      console.error('加载章节失败');
    }
  };

  // ─── Save current chapter ───
  const saveChapter = useCallback(async (newTitle: string, newContent: Descendant[]) => {
    if (!currentChapterId) return;
    setSaving(true);
    try {
      await api.put(`/api/chapters/${currentChapterId}`, {
        title: newTitle,
        content: newContent,
      });
      setLastSaved(new Date());
      // Silently refresh sidebar titles
      fetchVolumes();
    } catch {
      console.error('保存失败');
    }
    setSaving(false);
  }, [currentChapterId, fetchVolumes]);

  // Auto-save (2s debounce)
  const scheduleSave = useCallback((newTitle: string, newContent: Descendant[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveChapter(newTitle, newContent);
    }, 2000);
  }, [saveChapter]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ─── Sidebar handlers ───
  const handleToggleVolume = (volId: string) => {
    setExpandedVolumes((prev) =>
      prev.includes(volId) ? prev.filter((id) => id !== volId) : [...prev, volId]
    );
  };

  const handleNewVolume = async () => {
    const title = prompt('请输入卷名：', '新卷');
    if (!title || !title.trim()) return;
    try {
      await api.post('/api/volumes', { title: title.trim(), book: bookId });
      const vols = await fetchVolumes();
      // Expand the new volume (last one)
      if (vols.length > 0) {
        const newVol = vols[vols.length - 1];
        setExpandedVolumes((prev) => [...prev, newVol._id]);
      }
    } catch {
      alert('创建卷失败');
    }
  };

  const handleNewChapter = async () => {
    // Find target volume: first expanded, otherwise the first volume
    const targetVol =
      volumes.find((v) => expandedVolumes.includes(v._id)) || volumes[0];

    if (!targetVol) {
      alert('请先创建一个卷');
      return;
    }

    // Ensure target volume is expanded
    if (!expandedVolumes.includes(targetVol._id)) {
      setExpandedVolumes((prev) => [...prev, targetVol._id]);
    }

    const title = prompt('请输入章名：', '新章');
    if (!title || !title.trim()) return;

    try {
      const { data } = await api.post('/api/chapters', {
        title: title.trim(),
        volume: targetVol._id,
      });

      // Refresh sidebar — keeps expanded state
      await fetchVolumes();

      // Select the newly created chapter
      await handleSelectChapter(data._id);
    } catch {
      alert('创建章节失败');
    }
  };

  const handleToggleBatchSelect = () => {
    setBatchMode(!batchMode);
    setSelectedVolumeIds([]);
    setSelectedChapterIds([]);
  };

  const handleDeleteSelected = async () => {
    const volCount = selectedVolumeIds.length;
    const chapCount = selectedChapterIds.length;
    if (volCount === 0 && chapCount === 0) return;

    const msg = [];
    if (volCount > 0) msg.push(`${volCount} 个卷`);
    if (chapCount > 0) msg.push(`${chapCount} 个章节`);
    if (!confirm(`确定要删除选中的 ${msg.join(' 和 ')} 吗？此操作不可撤销。`)) return;

    try {
      if (volCount > 0) {
        await api.delete('/api/volumes/batch', { data: { ids: selectedVolumeIds } });
      }
      if (chapCount > 0) {
        await api.delete('/api/chapters/batch', { data: { ids: selectedChapterIds } });
      }
      setSelectedVolumeIds([]);
      setSelectedChapterIds([]);

      // If current chapter was deleted, clear editor
      if (chapCount > 0 && selectedChapterIds.includes(currentChapterId || '')) {
        setCurrentChapterId(null);
        setChapterTitle('');
        setContent(initialContent);
      }
      await fetchVolumes();
    } catch {
      alert('删除失败');
    }
  };

  // Word & character counting
  const countStats = useCallback((slateContent: Descendant[]) => {
    const text = slateContent
      .map((node: any) => (node.children || []).map((c: any) => c.text || '').join(''))
      .join('');
    // Chinese: each character ≈ 1 word; English: split by whitespace
    const chineseChars = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
    const englishWords = text.replace(/[一-鿿㐀-䶿]/g, ' ').split(/\s+/).filter(Boolean).length;
    return {
      chars: text.replace(/\s/g, '').length,
      words: chineseChars + englishWords,
    };
  }, []);

  const stats = countStats(content);

  // Helper: convert Slate content array to plain text
  const slateToText = (slateContent: any[]): string => {
    return slateContent
      .map((node) => {
        if (node.type === 'paragraph' || !node.type) {
          return (node.children || []).map((c: any) => c.text || '').join('');
        }
        if (node.type && typeof node.type === 'string') {
          // Heading etc — just extract text
          return (node.children || []).map((c: any) => c.text || '').join('');
        }
        return '';
      })
      .join('\n\n');
  };

  // Trigger download of a text file
  const downloadTxt = (filename: string, text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async (mode: 'merged' | 'separate') => {
    // ── Batch mode: export selected chapters ──
    if (batchMode && selectedChapterIds.length > 0) {
      try {
        // Fetch all selected chapters content
        const chaptersData = await Promise.all(
          selectedChapterIds.map(async (chapId) => {
            const { data } = await api.get(`/api/chapters/${chapId}`);
            let volTitle = '';
            let chapTitle = data.title || '';
            for (const vol of volumes) {
              const found = vol.chapters.find((c) => c._id === chapId);
              if (found) {
                chapTitle = found.title;
                volTitle = vol.title;
                break;
              }
            }
            return { title: chapTitle, volumeTitle: volTitle, text: slateToText(data.content || []) };
          })
        );

        if (mode === 'merged') {
          // Determine the primary volume name for file naming
          const primaryVol = chaptersData[0]?.volumeTitle || bookTitle || '导出';
          const merged = chaptersData
            .map((ch) => `【${ch.volumeTitle} — ${ch.title}】\n${ch.text}`)
            .join('\n\n\n');
          downloadTxt(`${primaryVol}合集`, merged);
        } else {
          for (let i = 0; i < chaptersData.length; i++) {
            setTimeout(() => {
              downloadTxt(chaptersData[i].title, chaptersData[i].text);
            }, i * 200);
          }
        }
      } catch {
        alert('导出失败，请重试');
      }
      return;
    }

    // ── Normal mode: export current chapter ──
    if (!currentChapterId) {
      alert('请先选择一个章节');
      return;
    }
    const text = slateToText(content as any[]);
    downloadTxt(chapterTitle || '章节', text);
  };

  const handleReorderChapters = async (volumeId: string, chapterIds: string[]) => {
    // Optimistically reorder locally
    setVolumes((prev) =>
      prev.map((v) => {
        if (v._id !== volumeId) return v;
        const sorted = chapterIds
          .map((id) => v.chapters.find((c) => c._id === id))
          .filter(Boolean) as ChapterLite[];
        return { ...v, chapters: sorted };
      })
    );
    // Persist to server
    try {
      await api.put('/api/chapters/reorder', { volume: volumeId, chapterIds });
    } catch {
      fetchVolumes(); // Revert on failure
    }
  };

  const handleEditVolume = async (volId: string, newTitle: string) => {
    try {
      await api.put(`/api/volumes/${volId}`, { title: newTitle });
      fetchVolumes();
    } catch {
      alert('重命名卷失败');
    }
  };

  const handleEditChapter = async (chapId: string, newTitle: string) => {
    try {
      await api.put(`/api/chapters/${chapId}`, { title: newTitle });
      if (chapId === currentChapterId) setChapterTitle(newTitle);
      fetchVolumes();
    } catch {
      alert('重命名章节失败');
    }
  };

  const handleDeleteSingle = async (type: 'volume' | 'chapter', id: string) => {
    try {
      if (type === 'volume') {
        await api.delete(`/api/volumes/${id}`);
      } else {
        await api.delete(`/api/chapters/${id}`);
        // If deleted the current chapter, clear editor
        if (id === currentChapterId) {
          setCurrentChapterId(null);
          setChapterTitle('');
          setContent(initialContent);
        }
      }
      await fetchVolumes();
    } catch {
      alert(`删除${type === 'volume' ? '卷' : '章节'}失败`);
    }
  };

  // ─── Editor handlers ───
  const handleChapterTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setChapterTitle(newTitle);
    scheduleSave(newTitle, content);
  };

  const handleContentChange = (newContent: Descendant[]) => {
    setContent(newContent);
    scheduleSave(chapterTitle, newContent);
  };

  const handleSaveNow = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveChapter(chapterTitle, content);
  };

  if (loading) {
    return (
      <div className="editor-full-layout">
        <div className="loading-container" style={{ flex: 1 }}>加载中...</div>
      </div>
    );
  }

  return (
    <div className="editor-full-layout">
      {/* App top bar */}
      <header className="app-topbar">
        <div className="app-topbar-left">
          <Link to="/books" className="btn btn-sm btn-ghost" title="返回书库">
            <ChevronLeft size={18} /> 书库
          </Link>
          <span className="app-topbar-divider" />
          <BookOpen size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span className="app-topbar-title">{bookTitle || '加载中...'}</span>
        </div>
        <div className="app-topbar-right">
          <Link to="/" className="brand" style={{ transform: 'scale(0.9)', transformOrigin: 'right center' }}>
            <span className="brand-mark sm">墨</span>
            <span className="brand-text">
              <span className="brand-name" style={{ fontSize: '0.875rem' }}>墨坊</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="editor-body">
      {/* Left Sidebar — Volumes & Chapters */}
      <VolumeChapterSidebar
          volumes={volumes}
          selectedChapterId={currentChapterId}
          selectedVolumeIds={selectedVolumeIds}
          selectedChapterIds={selectedChapterIds}
          batchMode={batchMode}
          expandedVolumes={expandedVolumes}
          onToggleVolume={handleToggleVolume}
          onSelectChapter={handleSelectChapter}
          onNewVolume={handleNewVolume}
          onNewChapter={handleNewChapter}
          onToggleBatchSelect={handleToggleBatchSelect}
          onToggleVolumeSelect={(volId) => {
            setSelectedVolumeIds((prev) => {
              const isAdding = !prev.includes(volId);
              const vol = volumes.find((v) => v._id === volId);
              if (vol) {
                const chapIds = vol.chapters.map((c) => c._id);
                setSelectedChapterIds((prevC) =>
                  isAdding
                    ? [...new Set([...prevC, ...chapIds])]
                    : prevC.filter((c) => !chapIds.includes(c))
                );
              }
              return isAdding ? [...prev, volId] : prev.filter((x) => x !== volId);
            });
          }}
          onToggleChapterSelect={(id) =>
            setSelectedChapterIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            )
          }
          onExport={handleExport}
          onDeleteSelected={handleDeleteSelected}
          onEditVolume={handleEditVolume}
          onEditChapter={handleEditChapter}
          onDeleteSingle={handleDeleteSingle}
          onReorderChapters={handleReorderChapters}
        />

      {/* Main Editor Area */}
      <main className="editor-main-area">
        {currentChapterId ? (
          <>
            <div className="editor-header">
              <input
                className="title-input"
                value={chapterTitle}
                onChange={handleChapterTitleChange}
                placeholder="输入章节标题..."
              />
              <div className="editor-status">
                <span className="word-count">
                  {stats.words.toLocaleString()} 词 · {stats.chars.toLocaleString()} 字
                </span>
                {saving ? (
                  <span className="saving">保存中...</span>
                ) : lastSaved ? (
                  <span className="saved">
                    已保存 {lastSaved.toLocaleTimeString('zh-CN')}
                  </span>
                ) : null}
                <button className="btn btn-primary btn-sm" onClick={handleSaveNow}>
                  立即保存
                </button>
              </div>
            </div>

            <div className="editor-canvas">
              <SlateEditorComponent
                key={currentChapterId}
                value={content}
                onChange={handleContentChange}
                placeholder="开始书写你的灵感..."
              />
            </div>

            {/* Bottom status bar */}
            <div className="editor-statusbar">
              <span>{stats.words.toLocaleString()} 词</span>
              <span className="status-sep">|</span>
              <span>{stats.chars.toLocaleString()} 字</span>
              <span className="status-sep">|</span>
              <span>约 {Math.max(1, Math.ceil(stats.words / 300))} 分钟阅读</span>
              <span style={{ flex: 1 }} />
              <span>{bookTitle}</span>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon"><FileEdit size={48} /></div>
            <h3>{volumes.length === 0 ? '还没有卷和章节' : '请选择一个章节开始编辑'}</h3>
            <p>
              {volumes.length === 0
                ? '点击左侧「＋ 卷」创建第一卷，然后添加章节'
                : '在左侧选择要编辑的章节'}
            </p>
          </div>
        )}
      </main>

      {/* Right Plugin Panel */}
      <PluginPanel currentChapterId={currentChapterId} chapterTitle={chapterTitle} />
      </div>
    </div>
  );
};

export default EditorPage;
