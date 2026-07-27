import React, { useState, useCallback } from 'react';
import { FolderPlus, FilePlus, Square, CheckSquare, Download, Archive, Files, Trash2, ChevronRight, Folder, File, GripVertical, Pencil } from 'lucide-react';

interface Chapter {
  _id: string;
  title: string;
  order: number;
  updatedAt: string;
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
  onExport: (mode: 'merged' | 'separate') => void;
  onDeleteSelected: () => void;
  onEditVolume: (volId: string, title: string) => void;
  onEditChapter: (chapId: string, title: string) => void;
  onDeleteSingle: (type: 'volume' | 'chapter', id: string) => void;
  onReorderChapters: (volumeId: string, chapterIds: string[]) => void;
}

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
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; type: 'volume' | 'chapter'; id: string; title: string;
  } | null>(null);
  const [showExportOptions, setShowExportOptions] = useState(false);

  // Drag state
  const [draggedChapter, setDraggedChapter] = useState<{ id: string; volumeId: string } | null>(null);
  const [dragOverChapter, setDragOverChapter] = useState<string | null>(null);

  const hasSelection = selectedVolumeIds.length > 0 || selectedChapterIds.length > 0;

  const handleContextMenu = (
    e: React.MouseEvent,
    type: 'volume' | 'chapter',
    id: string,
    title: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, id, title });
  };

  // ─── Drag & Drop handlers ───
  const handleDragStart = useCallback((e: React.DragEvent, chapterId: string, volumeId: string) => {
    if (batchMode) return;
    e.dataTransfer.setData('text/plain', chapterId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedChapter({ id: chapterId, volumeId });
  }, [batchMode]);

  const handleDragOver = useCallback((e: React.DragEvent, chapterId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverChapter(chapterId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverChapter(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, vol: Volume, targetChapId: string) => {
    e.preventDefault();
    setDraggedChapter(null);
    setDragOverChapter(null);

    if (!draggedChapter || draggedChapter.id === targetChapId) return;
    if (draggedChapter.volumeId !== vol._id) return; // Only reorder within same volume

    const newOrder = vol.chapters.map((c) => c._id);
    const fromIdx = newOrder.indexOf(draggedChapter.id);
    const toIdx = newOrder.indexOf(targetChapId);
    if (fromIdx === -1 || toIdx === -1) return;

    // Remove from old position and insert at new position
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggedChapter.id);

    onReorderChapters(vol._id, newOrder);
  }, [draggedChapter, onReorderChapters]);

  const handleDragEnd = useCallback(() => {
    setDraggedChapter(null);
    setDragOverChapter(null);
  }, []);

  return (
    <aside className="editor-sidebar">
      {/* Header actions */}
      <div className="editor-sidebar-header">
        <p className="editor-sidebar-label">目录结构</p>
        <div className="editor-sidebar-actions">
          <button className="editor-sidebar-btn" onClick={onNewVolume} title="新建卷">
            <FolderPlus size={16} /> 卷
          </button>
          <button className="editor-sidebar-btn" onClick={onNewChapter} title="新建章">
            <FilePlus size={16} /> 章
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="editor-sidebar-toolbar">
        <button
          className={`editor-sidebar-btn sm ${batchMode ? 'active' : ''}`}
          onClick={onToggleBatchSelect}
          title="批量选择"
        >
          {batchMode ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
        <div className="export-btn-wrapper">
          <button
            className="editor-sidebar-btn sm"
            onClick={() => {
              if (batchMode && selectedChapterIds.length > 0) {
                setShowExportOptions(!showExportOptions);
              } else {
                onExport('merged');
              }
            }}
            title="导出"
          >
            <Download size={16} />
          </button>
          {showExportOptions && (
            <>
              <div
                className="export-options-backdrop"
                onClick={() => setShowExportOptions(false)}
              />
              <div className="export-options-popover">
                <button
                  className="export-option-btn"
                  onClick={() => {
                    setShowExportOptions(false);
                    onExport('merged');
                  }}
                >
                  <Archive size={16} /> 合并导出
                  <span className="export-option-hint">合并为一个文件</span>
                </button>
                <button
                  className="export-option-btn"
                  onClick={() => {
                    setShowExportOptions(false);
                    onExport('separate');
                  }}
                >
                  <Files size={16} /> 分别导出
                  <span className="export-option-hint">每个章节独立文件</span>
                </button>
              </div>
            </>
          )}
        </div>
        <button
          className={`editor-sidebar-btn sm ${(hasSelection || !batchMode) ? 'danger' : ''}`}
          onClick={() => {
            if (batchMode && hasSelection) {
              onDeleteSelected();
            } else if (!batchMode && selectedChapterId) {
              if (confirm('确定要删除当前章节吗？此操作不可撤销。')) {
                onDeleteSingle('chapter', selectedChapterId);
              }
            }
          }}
          disabled={batchMode && !hasSelection}
          title={batchMode ? '删除选中' : '删除当前章节'}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Volume & Chapter tree */}
      <div className="editor-sidebar-tree">
        {volumes.length === 0 ? (
          <div className="editor-sidebar-empty">
            <p>暂无卷和章节</p>
            <p className="hint">点击上方按钮创建</p>
          </div>
        ) : (
          volumes.map((vol) => {
            const isExpanded = expandedVolumes.includes(vol._id);
            return (
              <div key={vol._id} className="editor-tree-volume">
                {/* Volume header */}
                <div
                  className={`editor-tree-volume-header ${selectedVolumeIds.includes(vol._id) ? 'selected' : ''}`}
                  onClick={() => {
                    if (batchMode) {
                      onToggleVolumeSelect(vol._id);
                    } else {
                      onToggleVolume(vol._id);
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, 'volume', vol._id, vol.title)}
                >
                  {batchMode && (
                    <input
                      type="checkbox"
                      checked={selectedVolumeIds.includes(vol._id)}
                      onChange={() => onToggleVolumeSelect(vol._id)}
                      onClick={(e) => e.stopPropagation()}
                      className="tree-checkbox"
                    />
                  )}
                  <span
                    className={`tree-arrow ${isExpanded ? 'expanded' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVolume(vol._id);
                    }}
                  ><ChevronRight size={14} /></span>
                  <span className="tree-icon"><Folder size={14} /></span>
                  <span className="tree-title">{vol.title}</span>
                  <span className="tree-count">{vol.chapters.length}</span>
                </div>

                {/* Chapters */}
                {isExpanded && (
                  <div className="editor-tree-chapters">
                    {vol.chapters.length === 0 ? (
                      <p className="tree-empty-chapter">暂无章节</p>
                    ) : (
                      vol.chapters.map((chap) => (
                        <div
                          key={chap._id}
                          className={
                            `editor-tree-chapter${selectedChapterId === chap._id ? ' active' : ''}${selectedChapterIds.includes(chap._id) ? ' selected' : ''}${draggedChapter?.id === chap._id ? ' dragging' : ''}${dragOverChapter === chap._id ? ' drag-over' : ''}`
                          }
                          draggable={!batchMode}
                          onClick={() => {
                            if (batchMode) {
                              onToggleChapterSelect(chap._id);
                            } else {
                              onSelectChapter(chap._id);
                            }
                          }}
                          onContextMenu={(e) => handleContextMenu(e, 'chapter', chap._id, chap.title)}
                          onDragStart={(e) => handleDragStart(e, chap._id, vol._id)}
                          onDragOver={(e) => handleDragOver(e, chap._id)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, vol, chap._id)}
                          onDragEnd={handleDragEnd}
                        >
                          {batchMode && (
                            <input
                              type="checkbox"
                              checked={selectedChapterIds.includes(chap._id)}
                              onChange={() => onToggleChapterSelect(chap._id)}
                              onClick={(e) => e.stopPropagation()}
                              className="tree-checkbox"
                            />
                          )}
                          <span className="tree-chapter-icon"><File size={14} /></span>
                          <span className="tree-chapter-title">{chap.title}</span>
                          {/* Drag handle */}
                          {!batchMode && (
                            <span
                              className="drag-handle"
                              title="拖动排序"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GripVertical size={14} />
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            left: Math.min(contextMenu.x, window.innerWidth - 180),
            top: Math.min(contextMenu.y, window.innerHeight - 120),
            zIndex: 3000,
          }}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              const newTitle = prompt('请输入新名称：', contextMenu.title);
              if (newTitle && newTitle.trim()) {
                if (contextMenu.type === 'volume') {
                  onEditVolume(contextMenu.id, newTitle.trim());
                } else {
                  onEditChapter(contextMenu.id, newTitle.trim());
                }
              }
              setContextMenu(null);
            }}
          >
            <Pencil size={14} /> 重命名
          </button>
          <div className="context-menu-divider" />
          <button
            className="context-menu-item danger"
            onClick={() => {
              if (confirm(`确定要删除此${contextMenu.type === 'volume' ? '卷' : '章节'}吗？此操作不可撤销。`)) {
                onDeleteSingle(contextMenu.type, contextMenu.id);
              }
              setContextMenu(null);
            }}
          >
            <Trash2 size={14} /> 删除
          </button>
        </div>
      )}

      {/* Click outside closes context menu */}
      {contextMenu && (
        <div
          className="context-menu-backdrop"
          style={{ position: 'fixed', inset: 0, zIndex: 2999 }}
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
        />
      )}
    </aside>
  );
};

export default VolumeChapterSidebar;
