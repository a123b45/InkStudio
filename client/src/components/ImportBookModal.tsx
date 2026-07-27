import React, { useState, useRef } from 'react';
import { X, FileText, Upload, ChevronLeft, BookOpen, Layers } from 'lucide-react';
import api from '../api';
import {
  parseBookFile,
  chapterToSlateContent,
  formatImportLabel,
  detectImportFormat,
  type ParsedVolume,
  type ImportFileFormat,
} from '../utils/bookImportParser';

interface ImportBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

type ImportStep = 'source' | 'review';

const ImportBookModal: React.FC<ImportBookModalProps> = ({ isOpen, onClose, onImported }) => {
  const [step, setStep] = useState<ImportStep>('source');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('小说');
  const [tagsInput, setTagsInput] = useState('导入');
  const [coverUrl, setCoverUrl] = useState('');
  const [volumes, setVolumes] = useState<ParsedVolume[]>([]);
  const [parseStats, setParseStats] = useState('');
  const [sourceFileName, setSourceFileName] = useState('');
  const [sourceFormat, setSourceFormat] = useState<ImportFileFormat | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setStep('source');
    setTitle('');
    setDescription('');
    setCategory('小说');
    setTagsInput('导入');
    setCoverUrl('');
    setVolumes([]);
    setParseStats('');
    setSourceFileName('');
    setSourceFormat(null);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const applyParsedBook = (text: string, fileName: string) => {
    try {
      const parsed = parseBookFile(text, fileName);
      setTitle(parsed.title);
      setDescription(parsed.description);
      if (parsed.category) setCategory(parsed.category);
      if (parsed.tags?.length) setTagsInput(parsed.tags.join(', '));
      if (parsed.cover) setCoverUrl(parsed.cover);
      setVolumes(parsed.volumes);
      setSourceFormat(parsed.stats.format);

      const formatName = formatImportLabel(parsed.stats.format);
      const splitHint = parsed.stats.usedChapterSplit
        ? `已识别 ${parsed.stats.volumeCount} 卷、${parsed.stats.chapterCount} 章`
        : `已合并为 ${parsed.stats.chapterCount} 章`;
      setParseStats(`${formatName} · ${splitHint}`);

      setStep('review');
      setError('');
    } catch (err: any) {
      setError(err?.message || '解析文件失败');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!detectImportFormat(file.name)) {
      setError('请选择 .txt、.md 或 .json 文件');
      return;
    }

    setSourceFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text?.trim()) {
        setError('文件内容为空');
        return;
      }
      applyParsedBook(text, file.name);
    };
    reader.onerror = () => setError('读取文件失败，请确认文件编码为 UTF-8');
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const updateVolumeTitle = (volKey: string, newTitle: string) => {
    setVolumes((prev) =>
      prev.map((v) => (v.key === volKey ? { ...v, title: newTitle } : v))
    );
  };

  const updateChapterTitle = (volKey: string, chapKey: string, newTitle: string) => {
    setVolumes((prev) =>
      prev.map((v) =>
        v.key === volKey
          ? {
              ...v,
              chapters: v.chapters.map((c) =>
                c.key === chapKey ? { ...c, title: newTitle } : c
              ),
            }
          : v
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('请输入书籍名称');
      return;
    }

    if (volumes.length === 0) {
      setError('请先选择导入文件');
      return;
    }

    setLoading(true);

    try {
      const tags = tagsInput
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await api.post('/api/books/import-structure', {
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || '导入',
        tags,
        cover: coverUrl.trim(),
        volumes: volumes.map((vol) => ({
          title: vol.title.trim() || '正文',
          chapters: vol.chapters.map((ch) => ({
            title: ch.title.trim() || '未命名章节',
            content: chapterToSlateContent(ch),
          })),
        })),
      });

      resetForm();
      onImported();
    } catch (err: any) {
      setError(err?.response?.data?.message || '导入书籍失败');
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  const chapterTotal = volumes.reduce((n, v) => n + v.chapters.length, 0);

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card import-book-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{step === 'review' ? '确认导入信息' : '导入书籍'}</h2>
          <button type="button" className="modal-close-btn" onClick={handleClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-msg">{error}</div>}

          {step === 'source' && (
            <div className="import-txt-source">
              <div
                className="import-txt-dropzone"
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              >
                <Upload size={28} strokeWidth={1.5} />
                <p className="import-txt-drop-title">选择导入文件</p>
                <p className="import-txt-drop-hint">
                  支持 TXT、Markdown（.md）、JSON 格式
                </p>
                <div className="import-format-tags">
                  <span>.txt</span>
                  <span>.md</span>
                  <span>.json</span>
                </div>
                <p className="import-txt-drop-hint subtle">建议使用 UTF-8 编码</p>
              </div>
              <details className="import-format-help">
                <summary>格式说明</summary>
                <ul>
                  <li><strong>TXT</strong>：第X章、第X卷、Chapter 等标记</li>
                  <li><strong>Markdown</strong>：<code># 书名</code>、<code>## 章节</code>，或 YAML 前言区</li>
                  <li><strong>JSON</strong>：含 <code>title</code>、<code>volumes</code> 或 <code>chapters</code> 字段</li>
                </ul>
              </details>
              <p className="import-txt-footnote">
                想从零开始写？请使用「新建书籍」
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,.json,text/plain,application/json"
                onChange={handleImportFile}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {step === 'review' && (
            <>
              <div className="import-parse-banner">
                <FileText size={16} />
                <div>
                  <strong>{sourceFileName || '导入文件'}</strong>
                  <span>{parseStats}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setStep('source');
                    setVolumes([]);
                    setParseStats('');
                    setSourceFormat(null);
                  }}
                >
                  <ChevronLeft size={14} /> 重选文件
                </button>
              </div>

              <div className="form-group">
                <label htmlFor="import-title-review">书籍名称 *</label>
                <input
                  id="import-title-review"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="import-desc-review">书籍简介</label>
                <textarea
                  id="import-desc-review"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder={
                    sourceFormat === 'json'
                      ? '可从 JSON 自动提取，也可手动修改'
                      : '可从文件开头自动提取，也可手动修改'
                  }
                />
              </div>

              <MetaFields
                category={category}
                setCategory={setCategory}
                tagsInput={tagsInput}
                setTagsInput={setTagsInput}
                coverUrl={coverUrl}
                setCoverUrl={setCoverUrl}
              />

              <div className="form-group">
                <label>
                  <Layers size={14} /> 目录预览（{volumes.length} 卷 · {chapterTotal} 章）
                </label>
                <div className="import-outline-preview">
                  {volumes.map((vol) => (
                    <div key={vol.key} className="import-outline-volume">
                      <div className="import-outline-volume-head">
                        <BookOpen size={14} />
                        <input
                          type="text"
                          className="import-outline-input volume"
                          value={vol.title}
                          onChange={(e) => updateVolumeTitle(vol.key, e.target.value)}
                          aria-label="卷名"
                        />
                        <span className="import-outline-count">{vol.chapters.length} 章</span>
                      </div>
                      <ul className="import-outline-chapters">
                        {vol.chapters.map((ch) => (
                          <li key={ch.key}>
                            <input
                              type="text"
                              className="import-outline-input"
                              value={ch.title}
                              onChange={(e) =>
                                updateChapterTitle(vol.key, ch.key, e.target.value)
                              }
                              aria-label="章名"
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 'review' && (
            <div className="modal-actions">
              <button type="button" className="btn" onClick={handleClose}>
                取消
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? '导入中...' : '确认导入'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

const MetaFields: React.FC<{
  category: string;
  setCategory: (v: string) => void;
  tagsInput: string;
  setTagsInput: (v: string) => void;
  coverUrl: string;
  setCoverUrl: (v: string) => void;
}> = ({ category, setCategory, tagsInput, setTagsInput, coverUrl, setCoverUrl }) => (
  <>
    <div className="form-group">
      <label htmlFor="import-category">分类</label>
      <select
        id="import-category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        <option value="导入">导入</option>
        <option value="小说">小说</option>
        <option value="技术">技术</option>
        <option value="文学">文学</option>
        <option value="历史">历史</option>
        <option value="哲学">哲学</option>
        <option value="科学">科学</option>
        <option value="艺术">艺术</option>
        <option value="其他">其他</option>
      </select>
    </div>
    <div className="form-group">
      <label htmlFor="import-tags">标签</label>
      <input
        id="import-tags"
        type="text"
        value={tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
        placeholder="多个标签用逗号分隔"
      />
    </div>
    <div className="form-group">
      <label htmlFor="import-cover">封面图片 URL（可选）</label>
      <input
        id="import-cover"
        type="text"
        value={coverUrl}
        onChange={(e) => setCoverUrl(e.target.value)}
        placeholder="输入封面图片链接"
      />
    </div>
  </>
);

export default ImportBookModal;
