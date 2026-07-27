import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { createEditor, Descendant, Editor, Transforms, Text, Node, Range } from 'slate';
import { Slate, Editable, withReact, useSlate, RenderElementProps, RenderLeafProps, ReactEditor } from 'slate-react';
import { withHistory } from 'slate-history';
import isHotkey from 'is-hotkey';
import { Bold, Italic, Underline, Undo2, Redo2, Copy, Scissors, ClipboardPaste, SeparatorHorizontal, Brackets, RotateCcw, Search, ChevronUp, ChevronDown, X } from 'lucide-react';

/* ── Constants ── */
const HOTKEYS: Record<string, string> = {
  'mod+b': 'bold',
  'mod+i': 'italic',
  'mod+u': 'underline',
};
const LIST_TYPES = ['numbered-list', 'bulleted-list'];
const FONT_FAMILIES = ['思源宋体', '黑体', '楷体', '仿宋', '微软雅黑', 'Arial', 'Times New Roman', 'Georgia'];
const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '28', '32', '36', '48'];
const LINE_HEIGHTS = [
  { label: '1 倍', value: '1.5' },
  { label: '1.5 倍', value: '2' },
  { label: '2 倍', value: '2.5' },
  { label: '2.5 倍', value: '3' },
];

const DEFAULT_LINE_HEIGHT = '1.5';

/** 解析段落行距（块属性 > 全局偏好 > 默认） */
const resolveLineHeight = (el: any): number => {
  const raw = el?.lineHeight ?? savedFormatting.lineHeight ?? DEFAULT_LINE_HEIGHT;
  return Number(raw) || Number(DEFAULT_LINE_HEIGHT);
};

/** 段落下间距随行距同比缩放 */
const paragraphSpacing = (lineHeight: number): string =>
  `${Math.max(0.15, (lineHeight - 1) * 0.45 + 0.2)}em`;

// Module-level formatting preferences — persists across chapter switches
const savedFormatting: Record<string, any> = {};

/* ── Helpers ── */

// Apply or remove a mark on the ENTIRE document by temporarily selecting all text
const applyMarkGlobally = (editor: Editor, format: string, value: any) => {
  // Persist preference for cross-chapter consistency
  if (value === undefined || value === false) {
    delete savedFormatting[format];
  } else {
    savedFormatting[format] = value;
  }
  const saved = editor.selection;
  Transforms.select(editor, {
    anchor: Editor.start(editor, []),
    focus: Editor.end(editor, []),
  });
  if (value === undefined || value === false) {
    Editor.removeMark(editor, format);
  } else {
    Editor.addMark(editor, format, value);
  }
  if (saved) {
    Transforms.select(editor, saved);
  } else {
    Transforms.collapse(editor, { edge: 'end' });
  }
};

// Check if a mark exists anywhere in the document
const isMarkActiveGlobally = (editor: Editor, format: string): boolean => {
  for (const [node] of Editor.nodes(editor, { match: n => Text.isText(n), mode: 'all' })) {
    if ((node as any)[format]) return true;
  }
  return false;
};

// Get a mark value from the first text node (reflects global document state)
const getGlobalMarkValue = (editor: Editor, format: string): string => {
  for (const [node] of Editor.nodes(editor, { match: n => Text.isText(n), mode: 'all' })) {
    const val = (node as any)[format];
    if (val) return val;
  }
  return '';
};

// Get a block property from the first block node (reflects global document state)
const getGlobalBlockProp = (editor: Editor, prop: string): string => {
  for (const [node] of Editor.nodes(editor, { match: n => 'type' in n, mode: 'all' })) {
    const val = (node as any)[prop];
    if (val) return val;
  }
  return '';
};

// Apply a block property to ALL block nodes globally
const applyBlockPropGlobally = (editor: Editor, prop: string, value: any) => {
  // Persist preference for cross-chapter consistency
  if (value === undefined) {
    delete savedFormatting[prop];
  } else {
    savedFormatting[prop] = value;
  }
  const paths = Array.from(
    Editor.nodes(editor, { match: n => 'type' in n, mode: 'all' })
  ).map(([, p]) => [...p]);

  for (let i = paths.length - 1; i >= 0; i--) {
    if (value === undefined) {
      Transforms.unsetNodes(editor, prop, { at: paths[i] });
    } else {
      Transforms.setNodes(editor, { [prop]: value } as any, { at: paths[i] });
    }
  }
};

const toggleMarkGlobally = (editor: Editor, format: string) => {
  const active = isMarkActiveGlobally(editor, format);
  applyMarkGlobally(editor, format, active ? undefined : true);
};

/* ── Search helpers ── */
const findMatches = (editor: Editor, searchText: string): Range[] => {
  if (!searchText.trim()) return [];
  const matches: Range[] = [];
  const lower = searchText.toLowerCase();
  for (const [node, path] of Editor.nodes(editor, { at: [], match: (n) => Text.isText(n) })) {
    const text = (node as any).text || '';
    const lowerText = text.toLowerCase();
    let idx = 0;
    while ((idx = lowerText.indexOf(lower, idx)) !== -1) {
      matches.push({
        anchor: { path, offset: idx },
        focus: { path, offset: idx + searchText.length },
      });
      idx += searchText.length;
    }
  }
  return matches;
};

const highlightMatches = (editor: Editor, searchText: string): Range[] => {
  return findMatches(editor, searchText);
};

/* ── Element & Leaf renderers ── */
const Element = ({ attributes, children, element }: RenderElementProps) => {
  const el = element as any;
  const style: React.CSSProperties = {};
  if (el.align) style.textAlign = el.align;

  const lh = resolveLineHeight(el);
  style.lineHeight = lh;

  const blockType = el.type || 'paragraph';
  const isTextBlock = ['paragraph', 'heading-one', 'heading-two', 'block-quote', 'list-item'].includes(blockType);
  if (isTextBlock) {
    style.marginTop = 0;
    style.marginBottom = paragraphSpacing(lh);
  }

  switch (el.type) {
    case 'heading-one': return <h1 style={style} {...attributes}>{children}</h1>;
    case 'heading-two': return <h2 style={style} {...attributes}>{children}</h2>;
    case 'block-quote': return <blockquote style={style} {...attributes}>{children}</blockquote>;
    case 'bulleted-list': return <ul style={style} {...attributes}>{children}</ul>;
    case 'numbered-list': return <ol style={style} {...attributes}>{children}</ol>;
    case 'list-item': return <li style={style} {...attributes}>{children}</li>;
    case 'divider': return <hr style={style} {...attributes} contentEditable={false} />;
    default: return <p style={style} {...attributes}>{children}</p>;
  }
};

const Leaf = ({ attributes, children, leaf }: RenderLeafProps) => {
  const l = leaf as any;
  const style: React.CSSProperties = {};
  if (l.fontFamily) style.fontFamily = l.fontFamily;
  if (l.fontSize) style.fontSize = `${l.fontSize}px`;
  if (l.color) style.color = l.color;
  if (l.bgColor) style.backgroundColor = l.bgColor;

  if (l.bold) children = <strong>{children}</strong>;
  if (l.italic) children = <em>{children}</em>;
  if (l.underline) children = <u>{children}</u>;
  if (l.code) children = <code>{children}</code>;
  if (l.strikethrough) children = <del>{children}</del>;

  const wrapped = Object.keys(style).length > 0
    ? <span style={style}>{children}</span>
    : children;

  if (l.searchHighlight) {
    const bg = l.currentHighlight ? '#fca5a5' : '#fde68a';
    const outline = l.currentHighlight ? '2px solid #ef4444' : 'none';
    return <mark style={{ backgroundColor: bg, color: '#000', borderRadius: '2px', outline }} {...attributes}>{wrapped}</mark>;
  }
  return <span {...attributes}>{wrapped}</span>;
};

/* ── Toolbar Buttons ── */
const ToolbarBtn = ({ active, onMouseDown, title, children }: {
  active?: boolean; onMouseDown: (e: React.MouseEvent) => void; title: string; children: React.ReactNode;
}) => (
  <button className={`toolbar-btn${active ? ' active' : ''}`} onMouseDown={onMouseDown} title={title}>{children}</button>
);

const HeadingBtn = ({ type, label, title }: { type: string; label: string; title: string }) => {
  const ed = useSlate();
  let active = false;
  for (const [node] of Editor.nodes(ed, { match: n => 'type' in n, mode: 'all' })) {
    if ((node as any).type === type) { active = true; break; }
  }
  return (
    <ToolbarBtn
      active={active}
      onMouseDown={e => {
        e.preventDefault();
        const newType = active ? 'paragraph' : type;
        const saved = ed.selection;
        for (const [node, path] of Editor.nodes(ed, { match: n => 'type' in n, mode: 'all' })) {
          Transforms.setNodes(ed, { type: newType } as any, { at: path });
        }
        if (saved) Transforms.select(ed, saved);
      }}
      title={title}
    >{label}</ToolbarBtn>
  );
};

const BoldBtn = () => {
  const ed = useSlate();
  return (
    <ToolbarBtn
      active={isMarkActiveGlobally(ed, 'bold')}
      onMouseDown={e => { e.preventDefault(); toggleMarkGlobally(ed, 'bold'); }}
      title="加粗"
    ><Bold size={16} /></ToolbarBtn>
  );
};
const ItalicBtn = () => {
  const ed = useSlate();
  return (
    <ToolbarBtn
      active={isMarkActiveGlobally(ed, 'italic')}
      onMouseDown={e => { e.preventDefault(); toggleMarkGlobally(ed, 'italic'); }}
      title="斜体"
    ><Italic size={16} /></ToolbarBtn>
  );
};
const UnderlineBtn = () => {
  const ed = useSlate();
  return (
    <ToolbarBtn
      active={isMarkActiveGlobally(ed, 'underline')}
      onMouseDown={e => { e.preventDefault(); toggleMarkGlobally(ed, 'underline'); }}
      title="下划线"
    ><Underline size={16} /></ToolbarBtn>
  );
};
const UndoBtn = () => { const ed = useSlate(); return <ToolbarBtn onMouseDown={e => { e.preventDefault(); (ed as any).undo(); }} title="撤销"><Undo2 size={16} /></ToolbarBtn>; };
const RedoBtn = () => { const ed = useSlate(); return <ToolbarBtn onMouseDown={e => { e.preventDefault(); (ed as any).redo(); }} title="重做"><Redo2 size={16} /></ToolbarBtn>; };
const PAGE_BG_COLORS = [
  { color: '#FAF9DE', label: '象牙白' },
  { color: '#C7EDCC', label: '浅草绿' },
  { color: '#DDEEFF', label: '淡天蓝' },
  { color: '#FAFAF5', label: '米白' },
  { color: '#2C2C34', label: '暗夜黑' },
];

const BgColorBtn: React.FC<{ value: string; onChange: (c: string) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as HTMLElement)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const activeColor = PAGE_BG_COLORS.find(c => c.color === value);

  return (
    <span className={`bgcolor-btn-wrapper${open ? ' open' : ''}`} ref={wrapperRef}>
      <ToolbarBtn
        active={!!value}
        onMouseDown={e => { e.preventDefault(); setOpen(!open); }}
        title="页面背景色"
      >
        <span className="bgcolor-indicator" style={{ backgroundColor: value || '#ffffff', border: value ? '1px solid #999' : '1px dashed #ccc' }} />
      </ToolbarBtn>
      <span className="bgcolor-dropdown">
        <button
          className="bgcolor-option bgcolor-none"
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onChange(''); setOpen(false); }}
        >
          默认（无背景）
        </button>
        {PAGE_BG_COLORS.map(c => (
          <button
            key={c.color}
            className={`bgcolor-option${value === c.color ? ' active' : ''}`}
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              onChange(value === c.color ? '' : c.color);
              setOpen(false);
            }}
          >
            <span className="bgcolor-swatch" style={{ backgroundColor: c.color }} />
            <span className="bgcolor-label">{c.label}</span>
            <span className="bgcolor-hex">{c.color}</span>
          </button>
        ))}
      </span>
    </span>
  );
};

const CopyBtn = () => <ToolbarBtn onMouseDown={e => { e.preventDefault(); try { document.execCommand('copy'); } catch { /* */ } }} title="复制"><Copy size={16} /></ToolbarBtn>;
const CutBtn = () => <ToolbarBtn onMouseDown={e => { e.preventDefault(); try { document.execCommand('cut'); } catch { /* */ } }} title="剪切"><Scissors size={16} /></ToolbarBtn>;
const PasteBtn = () => {
  const ed = useSlate();
  const handlePasteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        ReactEditor.focus(ed as any);
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (i > 0) ed.insertBreak();
          Transforms.insertText(ed, lines[i]);
        }
      }
    } catch {
      // Clipboard API may require user permission; fallback silently
    }
  };
  return <ToolbarBtn onMouseDown={handlePasteClick} title="粘贴"><ClipboardPaste size={16} /></ToolbarBtn>;
};
const DividerBtn = () => { const ed = useSlate(); return <ToolbarBtn onMouseDown={e => { e.preventDefault(); Transforms.insertText(ed, '\n------这是华丽的分割线------\n'); }} title="分隔线"><SeparatorHorizontal size={16} /></ToolbarBtn>; };


const FontFamilySelect = () => {
  const ed = useSlate();
  const current = getGlobalMarkValue(ed, 'fontFamily') || '思源宋体';
  return (
    <select className="toolbar-select" value={current} onChange={e => { const val = e.target.value; applyMarkGlobally(ed, 'fontFamily', val === '思源宋体' ? undefined : val); }} title="字体">
      {FONT_FAMILIES.map(f => <option key={f} value={f} style={{ fontFamily: f === '思源宋体' ? "'Noto Serif SC', serif" : f }}>{f}</option>)}
    </select>
  );
};

const FontSizeSelect = () => {
  const ed = useSlate();
  const current = getGlobalMarkValue(ed, 'fontSize') || '16';
  return (
    <select className="toolbar-select sm" value={current} onChange={e => { const val = e.target.value; applyMarkGlobally(ed, 'fontSize', val === '16' ? undefined : val); }} title="字号">
      {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
};

const LineHeightSelect = ({ onLineHeightChange }: { onLineHeightChange: (val: string) => void }) => {
  const ed = useSlate();
  const current =
    getGlobalBlockProp(ed, 'lineHeight') ||
    savedFormatting.lineHeight ||
    DEFAULT_LINE_HEIGHT;

  return (
    <select
      className="toolbar-select sm"
      value={current}
      onChange={(e) => {
        const val = e.target.value;
        applyBlockPropGlobally(ed, 'lineHeight', val);
        onLineHeightChange(val);
      }}
      title="行距"
    >
      {LINE_HEIGHTS.map((lh) => (
        <option key={lh.value} value={lh.value}>
          {lh.label}
        </option>
      ))}
    </select>
  );
};

const BRACKET_PAIRS = [
  { label: '[ ]', open: '[', close: ']' },
  { label: '{ }', open: '{', close: '}' },
  { label: '" "', open: '"', close: '"' },
  { label: '< >', open: '<', close: '>' },
  { label: '( )', open: '(', close: ')' },
];

const BracketBtn = () => {
  const ed = useSlate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as HTMLElement)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const handleBracket = (open: string, close: string) => {
    const { selection } = ed;
    if (selection && !Range.isCollapsed(selection)) {
      const [start, end] = Range.edges(selection);
      Transforms.insertText(ed, close, { at: end });
      Transforms.insertText(ed, open, { at: start });
    } else {
      Transforms.insertText(ed, open + close);
      Transforms.move(ed, { distance: close.length, reverse: true });
    }
    setDropdownOpen(false);
  };

  return (
    <span className={`bracket-btn-wrapper${dropdownOpen ? ' open' : ''}`} ref={wrapperRef}>
      <ToolbarBtn
        active={dropdownOpen}
        onMouseDown={e => { e.preventDefault(); setDropdownOpen(!dropdownOpen); }}
        title="常用格式"
      ><Brackets size={16} /></ToolbarBtn>
      <span className="bracket-dropdown">
        {BRACKET_PAIRS.map(pair => (
          <button
            key={pair.label}
            className="bracket-option"
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              handleBracket(pair.open, pair.close);
            }}
          >
            {pair.label}
          </button>
        ))}
      </span>
    </span>
  );
};

const ResetFormatBtn = () => {
  const ed = useSlate();
  const handleReset = () => {
    Editor.withoutNormalizing(ed, () => {
      // 1. Remove ALL marks from all text nodes
      const markKeys = ['bold', 'italic', 'underline', 'code', 'strikethrough',
                        'fontFamily', 'fontSize', 'color', 'bgColor'];
      for (const [node, path] of Editor.nodes(ed, {
        at: [],
        match: n => Text.isText(n),
        mode: 'all',
      })) {
        for (const key of markKeys) {
          if ((node as any)[key] !== undefined) {
            Transforms.unsetNodes(ed, key, { at: path });
          }
        }
      }

      // 2. Remove ALL block-level formatting from all block nodes
      const blockKeys = ['align', 'lineHeight'];
      for (const [node, path] of Editor.nodes(ed, {
        at: [],
        match: n => 'type' in n,
        mode: 'all',
      })) {
        for (const key of blockKeys) {
          if ((node as any)[key] !== undefined) {
            Transforms.unsetNodes(ed, key, { at: path });
          }
        }
      }
    });

    // 3. Clear saved cross-chapter formatting preferences
    Object.keys(savedFormatting).forEach(key => delete savedFormatting[key]);
  };

  return (
    <ToolbarBtn
      onMouseDown={e => {
        e.preventDefault();
        handleReset();
      }}
      title="恢复默认格式"
    ><RotateCcw size={16} /></ToolbarBtn>
  );
};

/* ── Search / Replace Bar ── */
const SearchReplaceBar: React.FC<{
  show: boolean;
  searchText: string;
  replaceText: string;
  matchCount: number;
  currentMatch: number;
  onSearchChange: (v: string) => void;
  onReplaceChange: (v: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}> = ({ show, searchText, replaceText, matchCount, currentMatch, onSearchChange, onReplaceChange, onNext, onPrev, onReplace, onReplaceAll, onClose }) => {
  if (!show) return null;
  return (
    <div className="search-bar">
      <div className="search-bar-row">
        {/* Search input */}
        <div className="search-input-wrapper">
          <span className="search-input-icon" onClick={onNext} title="搜索下一个"><Search size={16} /></span>
          <input
            className="search-input"
            type="text"
            value={searchText}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="查找关键词..."
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') onNext(); }}
          />
          <span className="search-match-info">
            {searchText ? `${currentMatch}/${matchCount}` : ''}
          </span>
          <button className="search-nav-btn" onClick={onPrev} title="上一个"><ChevronUp size={14} /></button>
          <button className="search-nav-btn" onClick={onNext} title="下一个"><ChevronDown size={14} /></button>
        </div>
      </div>

      <div className="search-bar-row">
        {/* Replace input */}
        <div className="search-input-wrapper">
          <input
            className="search-input replace-input"
            type="text"
            value={replaceText}
            onChange={e => onReplaceChange(e.target.value)}
            placeholder="请输入替换内容"
          />
        </div>
        <button className="btn btn-sm btn-primary" onClick={onReplace} title="替换当前">替换</button>
        <button className="btn btn-sm btn-primary" onClick={onReplaceAll} title="替换本章所有">替换本章</button>
      </div>

      <button className="search-close-btn" onClick={onClose} title="关闭搜索"><X size={16} /></button>
    </div>
  );
};

/* ── Find button that toggles search bar ── */
const FindBtn: React.FC<{ onToggle: () => void; isOpen: boolean }> = ({ onToggle, isOpen }) => (
  <ToolbarBtn active={isOpen} onMouseDown={e => { e.preventDefault(); onToggle(); }} title="查找和替换"><Search size={16} /></ToolbarBtn>
);

/* ── DOM helpers ── */
const scrollAndFocus = (ed: Editor, range: Range) => {
  try {
    // Select the match range first so the editor scrolls to it
    Transforms.select(ed, range);
    ReactEditor.focus(ed as any);
  } catch { /* */ }
};

/* ── Main Component ── */
interface SlateEditorProps {
  value: Descendant[];
  onChange: (value: Descendant[]) => void;
  placeholder?: string;
}

const SlateEditorComponent: React.FC<SlateEditorProps> = ({ value, onChange, placeholder }) => {
  const renderElement = useCallback((props: RenderElementProps) => <Element {...props} />, []);
  const renderLeaf = useCallback((props: RenderLeafProps) => <Leaf {...props} />, []);
  const editor = useMemo(() => withHistory(withReact(createEditor())), []);
  const editorRef = useRef(editor);
  const [lineHeight, setLineHeight] = useState(
    () => savedFormatting.lineHeight || DEFAULT_LINE_HEIGHT
  );

  const handleLineHeightChange = useCallback(
    (val: string) => {
      setLineHeight(val);
      onChange(editorRef.current.children as Descendant[]);
    },
    [onChange]
  );

  // Apply saved formatting to newly loaded chapter content on mount
  useEffect(() => {
    const ed = editorRef.current;
    const keys = Object.keys(savedFormatting);
    if (keys.length === 0) return;

    // Delay to ensure Slate editor is fully initialized with initialValue
    const timer = setTimeout(() => {
      Editor.withoutNormalizing(ed, () => {
        for (const key of keys) {
          const val = savedFormatting[key];
          if (key === 'lineHeight' || key === 'align') {
            // Block-level properties
            const paths = Array.from(
              Editor.nodes(ed, { match: n => 'type' in n, mode: 'all' })
            ).map(([, p]) => [...p]);
            for (let i = paths.length - 1; i >= 0; i--) {
              Transforms.setNodes(ed, { [key]: val } as any, { at: paths[i] });
            }
          } else {
            // Mark-level properties (bold, italic, underline, fontFamily, fontSize)
            const saved = ed.selection;
            Transforms.select(ed, {
              anchor: Editor.start(ed, []),
              focus: Editor.end(ed, []),
            });
            Editor.addMark(ed, key, val);
            if (saved) {
              Transforms.select(ed, saved);
            } else {
              Transforms.collapse(ed, { edge: 'end' });
            }
          }
        }
      });
      // Notify parent of changes so auto-save picks up the formatting
      onChange(ed.children as Descendant[]);
      if (savedFormatting.lineHeight) {
        setLineHeight(savedFormatting.lineHeight);
      }
    }, 60);

    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const allMatches = useRef<Range[]>([]);
  const currentMatchRef = useRef(0);

  // Page background color state
  const [pageBgColor, setPageBgColor] = useState<string>('');

  const toggleSearch = useCallback(() => {
    setShowSearch(prev => {
      if (prev) {
        setSearchText('');
        setMatchCount(0);
        setCurrentMatch(0);
        currentMatchRef.current = 0;
        allMatches.current = [];
      }
      return !prev;
    });
  }, []);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
    setSearchText('');
    setMatchCount(0);
    setCurrentMatch(0);
    currentMatchRef.current = 0;
    allMatches.current = [];
  }, []);

  // Paste handler — insert plain text only (strip all formatting)
  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    if (text) {
      ReactEditor.focus(editor as any);
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) editor.insertBreak();
        Transforms.insertText(editor, lines[i]);
      }
    }
  }, [editor]);

  // Compute highlight decorations — current match gets different highlight
  // Compare by actual anchor position (path + offset), not by per-node local index
  const decorate = useCallback(([node, path]: [Node, number[]]): Range[] => {
    if (!searchText || !Text.isText(node)) return [];
    const text = (node as any).text || '';
    const lower = text.toLowerCase();
    const lowerSearch = searchText.toLowerCase();
    const ranges: Range[] = [];

    // Get the current match's anchor for position comparison
    const currentAnchor =
      currentMatch > 0 && allMatches.current.length >= currentMatch
        ? allMatches.current[currentMatch - 1]?.anchor
        : null;

    let idx = 0;
    while ((idx = lower.indexOf(lowerSearch, idx)) !== -1) {
      // Compare by exact position (path + offset) instead of local index
      const isCurrent = currentAnchor
        ? path.length === currentAnchor.path.length &&
          path.every((p, i) => p === currentAnchor.path[i]) &&
          idx === currentAnchor.offset
        : false;

      ranges.push({
        anchor: { path, offset: idx },
        focus: { path, offset: idx + searchText.length },
        searchHighlight: true,
        currentHighlight: isCurrent,
      } as any);
      idx += searchText.length;
    }
    return ranges;
  }, [searchText, currentMatch]);

  // Rebuild match list
  const rebuildMatches = useCallback((text: string) => {
    const matches = findMatches(editorRef.current, text);
    allMatches.current = matches;
    const count = matches.length;
    setMatchCount(count);
    const cur = count > 0 ? 1 : 0;
    setCurrentMatch(cur);
    currentMatchRef.current = cur;
  }, []);

  // Update matches list
  const updateMatches = useCallback(() => {
    rebuildMatches(searchText);
  }, [searchText, rebuildMatches]);

  // Search navigation
  const goToNext = useCallback(() => {
    if (allMatches.current.length === 0) return;
    const next = currentMatch >= allMatches.current.length ? 1 : currentMatch + 1;
    setCurrentMatch(next);
    currentMatchRef.current = next;
    const range = allMatches.current[next - 1];
    if (range) scrollAndFocus(editorRef.current, range);
  }, [currentMatch]);

  const goToPrev = useCallback(() => {
    if (allMatches.current.length === 0) return;
    const prev = currentMatch <= 1 ? allMatches.current.length : currentMatch - 1;
    setCurrentMatch(prev);
    currentMatchRef.current = prev;
    const range = allMatches.current[prev - 1];
    if (range) scrollAndFocus(editorRef.current, range);
  }, [currentMatch]);

  // Replace current
  const handleReplace = useCallback(() => {
    if (!searchText || allMatches.current.length === 0) return;
    const idx = currentMatch - 1;
    if (idx < 0 || idx >= allMatches.current.length) return;
    const range = allMatches.current[idx];
    Transforms.select(editorRef.current, range);
    Transforms.insertText(editorRef.current, replaceText);
    onChange(editorRef.current.children as Descendant[]);
    // Rebuild matches after replacement
    setTimeout(() => {
      rebuildMatches(searchText);
    }, 0);
  }, [searchText, replaceText, currentMatch, rebuildMatches, onChange]);

  // Replace all
  const handleReplaceAll = useCallback(() => {
    if (!searchText || allMatches.current.length === 0) return;
    const sorted = [...allMatches.current].sort((a, b) => {
      const aOff = a.anchor.offset;
      const bOff = b.anchor.offset;
      if (a.anchor.path.join(',') !== b.anchor.path.join(',')) {
        return b.anchor.path.join(',').localeCompare(a.anchor.path.join(','));
      }
      return bOff - aOff;
    });
    for (const range of sorted) {
      Transforms.select(editorRef.current, range);
      Transforms.insertText(editorRef.current, replaceText);
    }
    onChange(editorRef.current.children as Descendant[]);
    setSearchText('');
    allMatches.current = [];
    setCurrentMatch(0);
    setMatchCount(0);
    currentMatchRef.current = 0;
  }, [searchText, replaceText, onChange]);

  // Handle search text change
  const handleSearchChange = useCallback((v: string) => {
    setSearchText(v);
    const m = findMatches(editorRef.current, v);
    allMatches.current = m;
    const count = m.length;
    setMatchCount(count);
    const cur = count > 0 ? 1 : 0;
    setCurrentMatch(cur);
    currentMatchRef.current = cur;
  }, []);

  return (
    <div className="slate-editor">
      <Slate editor={editor} initialValue={value} onChange={onChange}>
        <div className="slate-editor-chrome">
          <div className="toolbar">
            <div className="toolbar-group">
              <FontFamilySelect />
              <FontSizeSelect />
              <LineHeightSelect onLineHeightChange={handleLineHeightChange} />
            </div>
            <span className="toolbar-spacer" />
            <div className="toolbar-group">
              <BoldBtn />
              <ItalicBtn />
              <UnderlineBtn />
              <BgColorBtn value={pageBgColor} onChange={setPageBgColor} />
              <FindBtn onToggle={toggleSearch} isOpen={showSearch} />
              <CopyBtn />
              <CutBtn />
              <PasteBtn />
              <UndoBtn />
              <RedoBtn />
              <DividerBtn />
              <BracketBtn />
              <ResetFormatBtn />
            </div>
          </div>

          <SearchReplaceBar
            show={showSearch}
            searchText={searchText}
            replaceText={replaceText}
            matchCount={allMatches.current.length}
            currentMatch={allMatches.current.length > 0 ? currentMatch : 0}
            onSearchChange={handleSearchChange}
            onReplaceChange={setReplaceText}
            onNext={goToNext}
            onPrev={goToPrev}
            onReplace={handleReplace}
            onReplaceAll={handleReplaceAll}
            onClose={closeSearch}
          />
        </div>

        <Editable
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          decorate={decorate}
          placeholder={placeholder || '开始书写你的灵感...'}
          spellCheck={false}
          className={`editable${pageBgColor === '#2C2C34' ? ' editable-dark' : ''}`}
          style={{
            lineHeight: Number(lineHeight),
            ...(pageBgColor
              ? {
                  backgroundColor: pageBgColor,
                  ...(pageBgColor === '#2C2C34' ? { color: '#e8e8ec' } : {}),
                }
              : {}),
          }}
          onPaste={handlePaste}
          onKeyDown={(event) => {
            if (event.key === 'Tab') {
              event.preventDefault();
              if (event.shiftKey) {
                const [match] = Editor.nodes(editor, {
                  match: n => Text.isText(n),
                  mode: 'lowest',
                });
                if (match) {
                  const [node, path] = match;
                  const text = (node as any).text || '';
                  const trimmed = text.replace(/^(\t| {1,4})/, '');
                  if (trimmed !== text) {
                    Transforms.delete(editor, { at: Editor.range(editor, path) });
                    Transforms.insertNodes(editor, { ...node, text: trimmed } as any, { at: path });
                  }
                }
              } else {
                Transforms.insertText(editor, '    ');
              }
              return;
            }
            for (const hotkey in HOTKEYS) {
              if (isHotkey(hotkey, event as any)) {
                event.preventDefault();
                toggleMarkGlobally(editor, HOTKEYS[hotkey]);
              }
            }
          }}
        />
      </Slate>
    </div>
  );
};

export default SlateEditorComponent;
