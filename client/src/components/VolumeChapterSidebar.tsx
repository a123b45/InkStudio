import React, { useState, useCallback } from 'react';
import {
  FolderPlus, FilePlus, Square, CheckSquare, Download, Archive, Files, Trash2,
  ChevronRight, Folder, File, GripVertical, Pencil, List, LayoutList,
} from 'lucide-react';

export type ExportFormat = 'txt' | 'md' | 'docx' | 'pdf' | 'epub' | 'backup';

interface Chapter {
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
  chapters: Chapter[];
}

interface VolumeChapterSidebarProps {
  volumes: Volume[];
  selectedChapterId: string | null;
  selectedVolumeIds: string[];
  selectedChapterIds: string[];
  batchMode: boolean;
  expandedVolumes: string[];
  onToggleVolume: (volId: string) => void;
  onSelectChapter: (chapterId: string) => void;
  onNewVolume: () => void;
  onNewChapter: () => void;
  onToggleBatchSelect: () => void;
  onToggleVolumeSelect: (volId: string) => void;
  onToggleChapterSelect: (chapId: string) => void;
  onExport: (mode: 'merged' | 'separate', format: ExportFormat) => void;
  onDeleteSelected: () => void;
  onEditVolume: (volId: string, title: string) => void;
  onEditChapter: (chapId: string, title: string) => void;
  onDeleteSingle: (type: 'volume' | 'chapter', id: string) => void;
  onReorderChapters: (volumeId: string, chapterIds: string[]) => void;
  onReorderVolumes: (volumeIds: string[]) => void;
  onUpdateSummary: (chapterId: string, summary: string) => void;
}

const EXPORT_OPTIONS: { format: ExportFormat; label: string; hint: string }[] = [
  { format: 'txt', label: 'TXT 文本', hint: '纯文本格式' },
  { format: 'md', label: 'Markdown', hint: '.md 格式' },
  { format: 'docx', label: 'Word 文档', hint: '.docx 格式' },
  { format: 'pdf', label: 'PDF', hint: '打印为 PDF' },
  { format: 'epub', label: 'EPUB 电子书', hint: '电子阅读器' },
  { format: 'backup', label: 'JSON 备份', hint: '完整结构备份' },
];

const VolumeChapterSidebar: React.FC<VolumeChapterSidebarProps> = ({
  volumes,
  selectedChapterId,
  selectedVolumeIds,
  selectedChapterIds,
  batchMode,
  expandedVolumes,
  onToggleVolume,
  onSelectChapter,
  onNewVolume,
  onNewChapter,
  onToggleBatchSelect,
  onToggleVolumeSelect,
  onToggleChapterSelect,
  onExport,
  onDeleteSelected,
  onEditVolume,
  onEditChapter,
  onDeleteSingle,
  onReorderChapters,
  onReorderVolumes,
  onUpdateSummary,
}) => {
  const [sidebarTab, setSidebarTab] = useState<'tree' | 'outline'>('tree');
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; type: 'volume' | 'chapter'; id: string; title: string;
  } | null>(null);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportMode, setExportMode] = useState<'merged' | 'separate'>('merged');

  const [draggedChapter, setDraggedChapter] = useState<{ id: string; volumeId: string } | null>(null);
  const [dragOverChapter, setDragOverChapter] = useState<string | null>(null);
  const [draggedVolume, setDraggedVolume] = useState<string | null>(null);
  const [dragOverVolume, setDragOverVolume] = useState<string | null>(null);

  const hasSelection = selectedVolumeIds.length > 0 || selectedChapterIds.length > 0;

  const handleContextMenu = (e: React.MouseEvent, type: 'volume' | 'chapter', id: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, id, title });
  };

  const handleChapterDragStart = useCallback((e: React.DragEvent, chapterId: string, volumeId: string) => {
    if (batchMode) return;
    e.dataTransfer.setData('text/plain', chapterId);
    setDraggedChapter({ id: chapterId, volumeId });
  }, [batchMode]);

  const handleChapterDrop = useCallback((e: React.DragEvent, vol: Volume, targetChapId: string) => {
    e.preventDefault();
    setDraggedChapter(null);
    setDragOverChapter(null);
    if (!draggedChapter || draggedChapter.id === targetChapId || draggedChapter.volumeId !== vol._id) return;

    const newOrder = vol.chapters.map((c) => c._id);
    const fromIdx = newOrder.indexOf(draggedChapter.id);
    const toIdx = newOrder.indexOf(targetChapId);
    if (fromIdx === -1 || toIdx === -1) return;
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggedChapter.id);
    onReorderChapters(vol._id, newOrder);
  }, [draggedChapter, onReorderChapters]);

  const handleVolumeDrop = useCallback((e: React.DragEvent, targetVolId: string) => {
    e.preventDefault();
    setDraggedVolume(null);
    setDragOverVolume(null);
    if (!draggedVolume || draggedVolume === targetVolId) return;

    const newOrder = volumes.map((v) => v._id);
    const fromIdx = newOrder.indexOf(draggedVolume);
    const toIdx = newOrder.indexOf(targetVolId);
    if (fromIdx === -1 || toIdx === -1) return;
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggedVolume);
    onReorderVolumes(newOrder);
  }, [draggedVolume, volumes, onReorderVolumes]);

  const openExport = (mode: 'merged' | 'separate') => {
    if (batchMode && selectedChapterIds.length > 0) {
      setExportMode(mode);
      setShowExportOptions(true);
    } else {
      setExportMode('merged');
      setShowExportOptions(true);
    }
  };

  return (
    <aside className="editor-sidebar">
      <div className="editor-sidebar-header">
        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab${sidebarTab === 'tree' ? ' active' : ''}`}
            onClick={() => setSidebarTab('tree')}
          >
            <List size={14} /> 目录
          </button>
          <button
            className={`sidebar-tab${sidebarTab === 'outline' ? ' active' : ''}`}
            onClick={() => setSidebarTab('outline')}
          >
            <LayoutList size={14} /> 大纲
          </button>
        </div>
        <div className="editor-sidebar-actions">
          <button className="editor-sidebar-btn" onClick={onNewVolume} title="新建卷"><FolderPlus size={16} /> 卷</button>
          <button className="editor-sidebar-btn" onClick={onNewChapter} title="新建章"><FilePlus size={16} /> 章</button>
        </div>
      </div>

      <div className="editor-sidebar-toolbar">
        <button className={`editor-sidebar-btn sm ${batchMode ? 'active' : ''}`} onClick={onToggleBatchSelect} title="批量选择">
          {batchMode ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
        <div className="export-btn-wrapper">
          <button className="editor-sidebar-btn sm" onClick={() => openExport('merged')} title="导出">
            <Download size={16} />
          </button>
          {showExportOptions && (
            <>
              <div className="export-options-backdrop" onClick={() => setShowExportOptions(false)} />
              <div className="export-options-popover export-options-wide">
                {batchMode && selectedChapterIds.length > 0 && (
                  <div className="export-mode-row">
                    <button className={`export-mode-btn${exportMode === 'merged' ? ' active' : ''}`} onClick={() => setExportMode('merged')}>
                      <Archive size={14} /> 合并
                    </button>
                    <button className={`export-mode-btn${exportMode === 'separate' ? ' active' : ''}`} onClick={() => setExportMode('separate')}>
                      <Files size={14} /> 分别
                    </button>
                  </div>
                )}
                {EXPORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.format}
                    className="export-option-btn"
                    onClick={() => {
                      setShowExportOptions(false);
                      onExport(exportMode, opt.format);
                    }}
                  >
                    {opt.label}
                    <span className="export-option-hint">{opt.hint}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          className={`editor-sidebar-btn sm ${(hasSelection || !batchMode) ? 'danger' : ''}`}
          onClick={() => {
            if (batchMode && hasSelection) onDeleteSelected();
            else if (!batchMode && selectedChapterId) {
              if (confirm('确定要删除当前章节吗？')) onDeleteSingle('chapter', selectedChapterId);
            }
          }}
          disabled={batchMode && !hasSelection}
          title={batchMode ? '删除选中' : '删除当前章节'}
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="editor-sidebar-tree">
        {volumes.length === 0 ? (
          <div className="editor-sidebar-empty">
            <p>暂无卷和章节</p>
            <p className="hint">点击上方按钮创建</p>
          </div>
        ) : sidebarTab === 'tree' ? (
          volumes.map((vol) => {
            const isExpanded = expandedVolumes.includes(vol._id);
            return (
              <div
                key={vol._id}
                className={`editor-tree-volume${draggedVolume === vol._id ? ' dragging' : ''}${dragOverVolume === vol._id ? ' drag-over' : ''}`}
                draggable={!batchMode}
                onDragStart={(e) => { if (!batchMode) { setDraggedVolume(vol._id); e.dataTransfer.effectAllowed = 'move'; } }}
                onDragOver={(e) => { e.preventDefault(); setDragOverVolume(vol._id); }}
                onDragLeave={() => setDragOverVolume(null)}
                onDrop={(e) => handleVolumeDrop(e, vol._id)}
                onDragEnd={() => { setDraggedVolume(null); setDragOverVolume(null); }}
              >
                <div
                  className={`editor-tree-volume-header ${selectedVolumeIds.includes(vol._id) ? 'selected' : ''}`}
                  onClick={() => batchMode ? onToggleVolumeSelect(vol._id) : onToggleVolume(vol._id)}
                  onContextMenu={(e) => handleContextMenu(e, 'volume', vol._id, vol.title)}
                >
                  {batchMode && (
                    <input type="checkbox" checked={selectedVolumeIds.includes(vol._id)}
                      onChange={() => onToggleVolumeSelect(vol._id)} onClick={(e) => e.stopPropagation()} className="tree-checkbox" />
                  )}
                  {!batchMode && <span className="drag-handle vol-drag" title="拖动排序卷"><GripVertical size={14} /></span>}
                  <span className={`tree-arrow ${isExpanded ? 'expanded' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleVolume(vol._id); }}>
                    <ChevronRight size={14} />
                  </span>
                  <span className="tree-icon"><Folder size={14} /></span>
                  <span className="tree-title">{vol.title}</span>
                  <span className="tree-count">{vol.chapters.length}</span>
                </div>
                {isExpanded && (
                  <div className="editor-tree-chapters">
                    {vol.chapters.length === 0 ? (
                      <p className="tree-empty-chapter">暂无章节</p>
                    ) : vol.chapters.map((chap) => (
                      <div
                        key={chap._id}
                        className={`editor-tree-chapter${selectedChapterId === chap._id ? ' active' : ''}${selectedChapterIds.includes(chap._id) ? ' selected' : ''}${draggedChapter?.id === chap._id ? ' dragging' : ''}${dragOverChapter === chap._id ? ' drag-over' : ''}`}
                        draggable={!batchMode}
                        onClick={() => batchMode ? onToggleChapterSelect(chap._id) : onSelectChapter(chap._id)}
                        onContextMenu={(e) => handleContextMenu(e, 'chapter', chap._id, chap.title)}
                        onDragStart={(e) => handleChapterDragStart(e, chap._id, vol._id)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverChapter(chap._id); }}
                        onDragLeave={() => setDragOverChapter(null)}
                        onDrop={(e) => handleChapterDrop(e, vol, chap._id)}
                        onDragEnd={() => { setDraggedChapter(null); setDragOverChapter(null); }}
                      >
                        {batchMode && (
                          <input type="checkbox" checked={selectedChapterIds.includes(chap._id)}
                            onChange={() => onToggleChapterSelect(chap._id)} onClick={(e) => e.stopPropagation()} className="tree-checkbox" />
                        )}
                        <span className="tree-chapter-icon"><File size={14} /></span>
                        <span className="tree-chapter-title">{chap.title}</span>
                        {!batchMode && <span className="drag-handle" title="拖动排序" onClick={(e) => e.stopPropagation()}><GripVertical size={14} /></span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="outline-view">
            {volumes.map((vol) => (
              <div key={vol._id} className="outline-vol">
                <div className="outline-vol-title">{vol.title}</div>
                {vol.chapters.map((chap) => (
                  <div key={chap._id} className={`outline-chapter${selectedChapterId === chap._id ? ' active' : ''}`}>
                    <button className="outline-chapter-title" onClick={() => onSelectChapter(chap._id)}>
                      {chap.title}
                    </button>
                    <textarea
                      className="outline-summary-input"
                      value={chap.summary || ''}
                      placeholder="章节摘要（一句话梗概）..."
                      rows={2}
                      onChange={(e) => onUpdateSummary(chap._id, e.target.value)}
                      onBlur={(e) => onUpdateSummary(chap._id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {contextMenu && (
        <>
          <div className="context-menu" style={{ position: 'fixed', left: Math.min(contextMenu.x, window.innerWidth - 180), top: Math.min(contextMenu.y, window.innerHeight - 120), zIndex: 3000 }}>
            <button className="context-menu-item" onClick={() => {
              const newTitle = prompt('请输入新名称：', contextMenu.title);
              if (newTitle?.trim()) {
                contextMenu.type === 'volume' ? onEditVolume(contextMenu.id, newTitle.trim()) : onEditChapter(contextMenu.id, newTitle.trim());
              }
              setContextMenu(null);
            }}><Pencil size={14} /> 重命名</button>
            <div className="context-menu-divider" />
            <button className="context-menu-item danger" onClick={() => {
              if (confirm(`确定要删除此${contextMenu.type === 'volume' ? '卷' : '章节'}吗？`)) onDeleteSingle(contextMenu.type, contextMenu.id);
              setContextMenu(null);
            }}><Trash2 size={14} /> 删除</button>
          </div>
          <div className="context-menu-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 2999 }}
            onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
        </>
      )}
    </aside>
  );
};

export default VolumeChapterSidebar;
