import React, { useState, useCallback, useEffect } from 'react';
import { Dices, Lightbulb, User, BarChart3, Map as MapIcon, Clock, Network, Save, Check, Trash2, ChevronRight, ChevronLeft, Pencil, ClipboardList, Plus, X, Minus, Mars, Venus, Users, Settings, RotateCcw, Download, Palette, Wrench, Maximize2, Copy, Star, RefreshCw, UserPlus } from 'lucide-react';
import MapEditor, { MapData, MapPin } from './MapEditor';
import RelationGraphEditor, { RelationGraph, GraphThumbnail } from './RelationGraphEditor';
import TimelineEditor, { getTimelineSummary } from './TimelineEditor';
import {
  NAME_STYLES,
  generateNames,
  generateSingleName,
  surnamePlaceholder,
  type NameGender,
  type NameStyle,
  type GeneratedName,
} from './nameGenerator';

/* ── Plugin Tab Definition ── */
interface PluginDef {
  key: string;
  icon: string;
  label: string;
}

const PLUGINS: PluginDef[] = [
  { key: 'names', icon: '🎲', label: '随机取名' },
  { key: 'notes', icon: '💡', label: '灵感便签' },
  { key: 'characters', icon: '👤', label: '人物卡片' },
  { key: 'attributes', icon: '📊', label: '属性状态' },
  { key: 'map', icon: '🗺', label: '地图定位' },
  { key: 'timeline', icon: '⏱', label: '时间线' },
  { key: 'relationgraph', icon: '🕸️', label: '关系图谱' },
];

const PLUGIN_PANEL_EXPANDED_KEY = 'slate_plugin_panel_expanded';

/* ═════════════════════════════════════════════
   Plugin 1: 随机取名
   ═════════════════════════════════════════════ */

const NAMES_FAVORITES_KEY = 'slate_name_favorites';
const CHARACTERS_STORAGE_KEY = 'slate_characters';

interface NameResultItem extends GeneratedName {
  id: string;
}

const NamesPlugin: React.FC = () => {
  const [gender, setGender] = useState<NameGender>('any');
  const [style, setStyle] = useState<NameStyle>('modern');
  const [surname, setSurname] = useState('');
  const [lockSurname, setLockSurname] = useState(false);
  const [lockedSurname, setLockedSurname] = useState('');
  const [count, setCount] = useState(10);
  const [names, setNames] = useState<NameResultItem[]>([]);
  const [favorites, setFavorites] = useState<GeneratedName[]>(() => {
    try {
      const saved = localStorage.getItem(NAMES_FAVORITES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [addedTip, setAddedTip] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem(NAMES_FAVORITES_KEY, JSON.stringify(favorites)); } catch { /* */ }
  }, [favorites]);

  const genOpts = useCallback(() => ({
    gender,
    style,
    count,
    surname,
    lockSurname,
    lockedSurname: lockSurname ? lockedSurname : undefined,
  }), [gender, style, count, surname, lockSurname, lockedSurname]);

  const generate = useCallback(() => {
    const { names: generated, lockedSurname: newLocked } = generateNames(genOpts());
    if (newLocked) setLockedSurname(newLocked);
    setNames(generated.map((n, i) => ({ ...n, id: `${Date.now()}-${i}` })));
  }, [genOpts]);

  const regenOne = useCallback((id: string) => {
    const exclude = new Set(names.map(n => n.full));
    const item = generateSingleName(genOpts(), exclude);
    if (!item) return;
    setNames(prev => prev.map(n => (n.id === id ? { ...item, id } : n)));
  }, [names, genOpts]);

  const copyName = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  const toggleFavorite = useCallback((item: GeneratedName) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.full === item.full);
      if (exists) return prev.filter(f => f.full !== item.full);
      return [{ full: item.full, tag: item.tag }, ...prev];
    });
  }, []);

  const isFavorite = (full: string) => favorites.some(f => f.full === full);

  const copyAll = useCallback(() => {
    if (!names.length) return;
    navigator.clipboard.writeText(names.map(n => n.full).join('\n'));
    setCopiedId('__all__');
    setTimeout(() => setCopiedId(null), 1500);
  }, [names]);

  const addToCharacter = useCallback((name: string) => {
    try {
      const saved = localStorage.getItem(CHARACTERS_STORAGE_KEY);
      const chars = saved ? JSON.parse(saved) : [];
      const genderLabel = gender === 'male' ? '男' : gender === 'female' ? '女' : '男';
      chars.unshift({
        id: Date.now().toString(36),
        name,
        age: '',
        gender: genderLabel,
        appearance: '',
        personality: '',
        background: '',
      });
      localStorage.setItem(CHARACTERS_STORAGE_KEY, JSON.stringify(chars));
      setAddedTip(name);
      setTimeout(() => setAddedTip(null), 2000);
    } catch { /* */ }
  }, [gender]);

  const styleMeta = NAME_STYLES.find(s => s.id === style);

  return (
    <div className="plugin-content-inner names-plugin">
      <div className="plugin-section-title"><Dices size={18} /> 随机取名</div>

      <div className="names-field">
        <label className="names-label">风格</label>
        <select className="plugin-select names-select" value={style} onChange={e => setStyle(e.target.value as NameStyle)}>
          {NAME_STYLES.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        {styleMeta && <p className="names-hint">{styleMeta.description}</p>}
      </div>

      <div className="names-field">
        <label className="names-label">性别</label>
        <div className="gender-tabs">
          {(['male', 'female', 'any'] as NameGender[]).map(g => (
            <button
              key={g}
              type="button"
              className={`gender-tab${gender === g ? ' active' : ''}`}
              onClick={() => setGender(g)}
            >
              {g === 'male' ? <><Mars size={14} /> 男</> : g === 'female' ? <><Venus size={14} /> 女</> : <><Users size={14} /> 通用</>}
            </button>
          ))}
        </div>
      </div>

      <div className="names-field">
        <label className="names-label">姓氏</label>
        <div className="names-surname-row">
          <input
            className="plugin-input char-input"
            placeholder={surnamePlaceholder(style)}
            value={surname}
            onChange={e => setSurname(e.target.value)}
          />
          <label className="names-lock">
            <input
              type="checkbox"
              checked={lockSurname}
              onChange={e => {
                setLockSurname(e.target.checked);
                if (!e.target.checked) setLockedSurname('');
              }}
            />
            锁定
          </label>
        </div>
        {lockSurname && lockedSurname && !surname.trim() && (
          <p className="names-hint">已锁定姓氏：<strong>{lockedSurname}</strong></p>
        )}
      </div>

      <div className="names-field">
        <label className="names-label">数量</label>
        <select className="plugin-select names-count" value={count} onChange={e => setCount(Number(e.target.value))}>
          <option value={5}>5 个</option>
          <option value={10}>10 个</option>
          <option value={20}>20 个</option>
        </select>
      </div>

      <button className="btn btn-primary btn-full" type="button" onClick={generate}>
        <Dices size={14} /> 生成 {count} 个名字
      </button>

      {addedTip && (
        <p className="names-toast">已添加「{addedTip}」到人物卡片</p>
      )}

      {names.length > 0 && (
        <>
          <div className="names-result-head">
            <span>生成结果</span>
            <button type="button" className="btn btn-sm" onClick={copyAll}>
              <Copy size={14} /> {copiedId === '__all__' ? '已复制' : '全部复制'}
            </button>
          </div>
          <div className="name-list">
            {names.map(n => (
              <div key={n.id} className="name-item">
                <div className="name-item-main">
                  <span className="name-item-text">{n.full}</span>
                  <span className="name-item-tag">{n.tag}</span>
                </div>
                <div className="name-item-actions">
                  <button type="button" className="name-icon-btn" title="复制" onClick={() => copyName(n.id, n.full)}>
                    <Copy size={13} />{copiedId === n.id ? '✓' : ''}
                  </button>
                  <button
                    type="button"
                    className={`name-icon-btn${isFavorite(n.full) ? ' active' : ''}`}
                    title="收藏"
                    onClick={() => toggleFavorite(n)}
                  >
                    <Star size={13} />
                  </button>
                  <button type="button" className="name-icon-btn" title="换一条" onClick={() => regenOne(n.id)}>
                    <RefreshCw size={13} />
                  </button>
                  <button type="button" className="name-icon-btn" title="加到人物卡片" onClick={() => addToCharacter(n.full)}>
                    <UserPlus size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {favorites.length > 0 && (
        <>
          <div className="notes-divider" />
          <div className="names-result-head">
            <span><Star size={14} /> 收藏 ({favorites.length})</span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(favorites.map(f => f.full).join('\n'));
                setCopiedId('__fav__');
                setTimeout(() => setCopiedId(null), 1500);
              }}
            >
              <Copy size={14} /> {copiedId === '__fav__' ? '已复制' : '复制全部'}
            </button>
          </div>
          <div className="name-fav-list">
            {favorites.map(f => (
              <div key={f.full} className="name-fav-chip">
                <span>{f.full}</span>
                <button type="button" className="name-icon-btn" title="移除" onClick={() => toggleFavorite(f)}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ═════════════════════════════════════════════
   Plugin 2: 灵感便签
   ═════════════════════════════════════════════ */
const NOTES_STORAGE_KEY = 'slate_inspiration_notes';

interface Note {
  id: string;
  text: string;
  createdAt: string;
}

const NotesPlugin: React.FC = () => {
  const [text, setText] = useState('');
  const [notes, setNotes] = useState<Note[]>(() => {
    try { const saved = localStorage.getItem(NOTES_STORAGE_KEY); return saved ? JSON.parse(saved) : []; }
    catch { return []; }
  });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  const persist = (updated: Note[]) => {
    setNotes(updated);
    try { localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(updated)); } catch { /* */ }
  };

  const handleSave = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const note: Note = {
      id: Date.now().toString(36),
      text: trimmed,
      createdAt: new Date().toLocaleString('zh-CN'),
    };
    persist([note, ...notes]);
    setText('');
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleDelete = (id: string) => {
    persist(notes.filter(n => n.id !== id));
    setExpandedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const preview = (t: string) => t.length > 8 ? t.slice(0, 8) + '…' : t;

  return (
    <div className="plugin-content-inner">
      <div className="plugin-section-title"><Lightbulb size={18} /> 灵感便签</div>

      {/* Input area */}
      <textarea
        className="notes-textarea"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="记录一闪而过的灵感..."
        rows={6}
      />
      <button className="btn btn-primary btn-full" onClick={handleSave}>
        {saved ? <><Check size={14} /> 已保存</> : <><Save size={14} /> 保存便签</>}
      </button>

      {/* Saved notes list */}
      {notes.length > 0 && (
        <>
          <div className="notes-divider" />
          <div className="notes-count-label"><ClipboardList size={14} /> 灵感记录 ({notes.length})</div>
          <div className="notes-list">
            {notes.map(note => {
              const isExpanded = expandedIds.has(note.id);
              return (
                <div
                  key={note.id}
                  className={`note-card${isExpanded ? ' expanded' : ''}`}
                >
                  <div className="note-card-header" onClick={() => toggleExpand(note.id)}>
                    <span className={`note-arrow${isExpanded ? ' open' : ''}`}><ChevronRight size={14} /></span>
                    <span className="note-preview">{isExpanded ? note.text : preview(note.text)}</span>
                  </div>
                  {isExpanded && (
                    <div className="note-card-body">
                      <div className="note-time"><Clock size={14} /> {note.createdAt}</div>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(note.id)}
                      ><Trash2 size={14} /> 删除</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

/* ═════════════════════════════════════════════
   Plugin 3: 人物卡片
   ═════════════════════════════════════════════ */
interface CharacterCard {
  id: string;
  name: string;
  age: string;
  gender: string;
  appearance: string;
  personality: string;
  background: string;
}

const CHARACTERS_KEY = 'slate_characters';

const emptyChar = (): CharacterCard => ({ id: '', name: '', age: '', gender: '男', appearance: '', personality: '', background: '' });

interface CharacterFormFieldsProps {
  form: CharacterCard;
  setForm: React.Dispatch<React.SetStateAction<CharacterCard>>;
}

const CharacterFormFields: React.FC<CharacterFormFieldsProps> = ({ form, setForm }) => (
  <>
    <div className="char-field">
      <label className="char-field-label">姓名 *</label>
      <input
        className="plugin-input char-input"
        placeholder="角色姓名"
        value={form.name}
        onChange={e => setForm({ ...form, name: e.target.value })}
      />
    </div>
    <div className="char-form-meta">
      <div className="char-field char-field-age">
        <label className="char-field-label">年龄</label>
        <input
          className="plugin-input char-input"
          placeholder="如 20"
          value={form.age}
          onChange={e => setForm({ ...form, age: e.target.value })}
        />
      </div>
      <div className="char-field char-field-gender">
        <label className="char-field-label">性别</label>
        <select
          className="plugin-select char-select"
          value={form.gender}
          onChange={e => setForm({ ...form, gender: e.target.value })}
        >
          <option>男</option><option>女</option><option>其他</option>
        </select>
      </div>
    </div>
    <div className="char-field">
      <label className="char-field-label">外貌</label>
      <textarea
        className="plugin-textarea char-input"
        placeholder="外貌特征、穿着打扮..."
        value={form.appearance}
        onChange={e => setForm({ ...form, appearance: e.target.value })}
        rows={2}
      />
    </div>
    <div className="char-field">
      <label className="char-field-label">性格</label>
      <textarea
        className="plugin-textarea char-input"
        placeholder="性格特点、行为习惯..."
        value={form.personality}
        onChange={e => setForm({ ...form, personality: e.target.value })}
        rows={2}
      />
    </div>
    <div className="char-field">
      <label className="char-field-label">背景</label>
      <textarea
        className="plugin-textarea char-input"
        placeholder="身世背景、重要经历..."
        value={form.background}
        onChange={e => setForm({ ...form, background: e.target.value })}
        rows={2}
      />
    </div>
  </>
);

const CharactersPlugin: React.FC = () => {
  const [chars, setChars] = useState<CharacterCard[]>(() => {
    try { const saved = localStorage.getItem(CHARACTERS_KEY); return saved ? JSON.parse(saved) : []; }
    catch { return []; }
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<CharacterCard>(emptyChar());
  const [showNewForm, setShowNewField] = useState(false);

  const persist = (updated: CharacterCard[]) => {
    setChars(updated);
    try { localStorage.setItem(CHARACTERS_KEY, JSON.stringify(updated)); } catch { /* */ }
  };

  const handleSaveNew = () => {
    if (!form.name.trim()) return;
    persist([{ ...form, id: Date.now().toString(36) }, ...chars]);
    setForm(emptyChar());
    setShowNewField(false);
  };

  const handleSaveEdit = () => {
    if (!form.name.trim()) return;
    persist(chars.map(c => c.id === editingId ? { ...form, id: editingId } : c));
    setEditingId(null);
    setForm(emptyChar());
  };

  const handleDelete = (id: string) => {
    persist(chars.filter(c => c.id !== id));
    if (editingId === id) { setEditingId(null); setForm(emptyChar()); }
    if (expandedId === id) setExpandedId(null);
  };

  const cancelEdit = () => { setEditingId(null); setForm(emptyChar()); };

  const startEdit = (c: CharacterCard) => {
    setEditingId(c.id);
    setForm({ ...c });
    setShowNewField(false);
    setExpandedId(null);
  };

  return (
    <div className="plugin-content-inner char-plugin">
      <div className="plugin-section-title"><User size={18} /> 人物卡片 ({chars.length})</div>

      {!showNewForm && !editingId && (
        <button className="btn btn-primary btn-full btn-sm" onClick={() => { setShowNewField(true); setForm(emptyChar()); }}>
          <Plus size={14} /> 新建人物
        </button>
      )}

      {showNewForm && !editingId && (
        <div className="char-form">
          <div className="char-form-label"><Plus size={14} /> 新建人物</div>
          <CharacterFormFields form={form} setForm={setForm} />
          <div className="plugin-row-btns">
            <button className="btn btn-primary btn-sm" onClick={handleSaveNew}><Save size={14} /> 保存</button>
            <button className="btn btn-sm" onClick={() => { setShowNewField(false); setForm(emptyChar()); }}>取消</button>
          </div>
        </div>
      )}

      {chars.length > 0 && (
        <div className="char-list">
          {chars.map(c => {
            const isEditing = editingId === c.id;
            const isExpanded = expandedId === c.id && !isEditing;
            return (
              <div key={c.id} className={`char-card-mini${isEditing ? ' editing' : ''}${isExpanded ? ' expanded' : ''}`}>
                <div
                  className="char-card-header clickable"
                  onClick={() => {
                    if (isEditing) return;
                    setExpandedId(isExpanded ? null : c.id);
                  }}
                >
                  <span className={`note-arrow${isExpanded ? ' open' : ''}`}><ChevronRight size={14} /></span>
                  <div className="char-card-title">
                    <strong>{c.name}</strong>
                    <span className="char-meta">{c.gender}{c.age ? ` · ${c.age}岁` : ''}</span>
                  </div>
                </div>

                {!isEditing && !isExpanded && (c.appearance || c.personality) && (
                  <p className="char-card-summary">
                    {[c.appearance, c.personality].filter(Boolean).join(' · ')}
                  </p>
                )}

                {isEditing && (
                  <div className="char-form char-form-inline">
                    <CharacterFormFields form={form} setForm={setForm} />
                    <div className="plugin-row-btns">
                      <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}><Save size={14} /> 保存</button>
                      <button className="btn btn-sm" onClick={cancelEdit}>取消</button>
                    </div>
                  </div>
                )}

                {isExpanded && (
                  <div className="char-card-detail">
                    {c.appearance ? <div className="char-detail-row"><span>外貌</span><p>{c.appearance}</p></div> : null}
                    {c.personality ? <div className="char-detail-row"><span>性格</span><p>{c.personality}</p></div> : null}
                    {c.background ? <div className="char-detail-row"><span>背景</span><p>{c.background}</p></div> : null}
                    {!c.appearance && !c.personality && !c.background && (
                      <p className="char-empty-hint">暂无详细描述</p>
                    )}
                  </div>
                )}

                {!isEditing && (
                  <div className="char-card-actions">
                    <button className="btn btn-sm" type="button" onClick={() => startEdit(c)}>
                      <Pencil size={14} /> 编辑
                    </button>
                    <button className="btn btn-sm btn-danger" type="button" onClick={() => handleDelete(c.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ═════════════════════════════════════════════
   Plugin 4: 属性状态
   ═════════════════════════════════════════════ */
interface AttrDef {
  key: string;
  label: string;
  icon: string;
}

interface ChapterAttrs {
  chapterId: string;
  chapterTitle: string;
  values: Record<string, number>;
  customAttrs: AttrDef[];
  deletedKeys: string[];
}

const DEFAULT_ATTRS: AttrDef[] = [
  { key: 'strength', label: '力量', icon: '💪' },
  { key: 'intelligence', label: '智力', icon: '🧠' },
  { key: 'charm', label: '魅力', icon: '✨' },
  { key: 'agility', label: '敏捷', icon: '🏃' },
  { key: 'endurance', label: '耐力', icon: '🛡' },
  { key: 'luck', label: '幸运', icon: '🍀' },
];

const ATTRS_CHAPTERS_KEY = 'slate_attr_chapters';

interface AttributesPluginProps {
  currentChapterId: string | null;
  chapterTitle: string;
}

const AttributesPlugin: React.FC<AttributesPluginProps> = ({ currentChapterId, chapterTitle }) => {
  // Saved chapter records
  const [chapters, setChapters] = useState<ChapterAttrs[]>(() => {
    try { const saved = localStorage.getItem(ATTRS_CHAPTERS_KEY); return saved ? JSON.parse(saved) : []; }
    catch { return []; }
  });
  const [expandedChapId, setExpandedChapId] = useState<string | null>(null);

  // Current editing values (not saved yet)
  const [values, setValues] = useState<Record<string, number>>({});
  const [customAttrs, setCustomAttrs] = useState<AttrDef[]>([]);
  const [deletedKeys, setDeletedKeys] = useState<string[]>([]);
  const [showNewField, setShowNewField] = useState(false);
  const [newName, setNewName] = useState('');
  const [newVal, setNewVal] = useState(5);
  const [resetVal, setResetVal] = useState(5);

  // Load from saved chapter record when switching chapters
  const savedChap = chapters.find(c => c.chapterId === currentChapterId);

  const visibleDefaults = DEFAULT_ATTRS.filter(a => !deletedKeys.includes(a.key));
  const allKeys = [...visibleDefaults.map(a => a.key), ...customAttrs.map(c => c.key)];

  const getVal = (key: string) => values[key] ?? 5;

  const setVal = (key: string, v: number) => {
    setValues(prev => ({ ...prev, [key]: v }));
  };

  const handleAddField = () => {
    const name = newName.trim();
    if (!name) return;
    const key = 'cust_' + Date.now().toString(36);
    setCustomAttrs(prev => [...prev, { key, label: name, icon: '⚙️' }]);
    setVal(key, Math.max(1, newVal));
    setNewName('');
    setNewVal(5);
    setShowNewField(false);
  };

  const handleDeleteField = (key: string) => {
    if (DEFAULT_ATTRS.some(a => a.key === key)) {
      setDeletedKeys(prev => [...prev, key]);
    } else {
      setCustomAttrs(prev => prev.filter(c => c.key !== key));
    }
    setValues(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleResetAll = () => {
    const r = Math.max(1, resetVal);
    const next: Record<string, number> = {};
    allKeys.forEach(k => next[k] = r);
    setValues(next);
  };

  // Save current attributes as a chapter record
  const handleSaveChapter = () => {
    if (!currentChapterId) return;
    const record: ChapterAttrs = {
      chapterId: currentChapterId,
      chapterTitle: chapterTitle || '未命名章节',
      values: { ...values },
      customAttrs: [...customAttrs],
      deletedKeys: [...deletedKeys],
    };
    const updated = chapters.filter(c => c.chapterId !== currentChapterId);
    updated.unshift(record);
    setChapters(updated);
    try { localStorage.setItem(ATTRS_CHAPTERS_KEY, JSON.stringify(updated)); } catch { /* */ }
  };

  // Load saved chapter for editing
  const handleLoadChapter = (chap: ChapterAttrs) => {
    setValues(chap.values);
    setCustomAttrs(chap.customAttrs);
    setDeletedKeys(chap.deletedKeys);
    setExpandedChapId(null);
  };

  // Delete saved chapter record
  const handleDeleteChapter = (chapId: string) => {
    const updated = chapters.filter(c => c.chapterId !== chapId);
    setChapters(updated);
    try { localStorage.setItem(ATTRS_CHAPTERS_KEY, JSON.stringify(updated)); } catch { /* */ }
    if (expandedChapId === chapId) setExpandedChapId(null);
  };

  const renderCard = (attr: AttrDef) => {
    const val = getVal(attr.key);
    return (
      <div key={attr.key} className="attr-card">
        <div className="attr-card-head">
          <span className="attr-card-label">{attr.icon} {attr.label}</span>
          <button className="attr-del-btn" onClick={() => handleDeleteField(attr.key)} title="删除字段"><X size={12} /></button>
        </div>
        <div className="attr-card-stepper">
          <button className="attr-btn" type="button" onClick={() => setVal(attr.key, Math.max(1, val - 1))} aria-label="减少"><Minus size={14} /></button>
          <input
            className="attr-num-input"
            type="number"
            min={1}
            value={val}
            onChange={e => setVal(attr.key, Math.max(1, parseInt(e.target.value) || 1))}
          />
          <button className="attr-btn" type="button" onClick={() => setVal(attr.key, val + 1)} aria-label="增加"><Plus size={14} /></button>
        </div>
      </div>
    );
  };

  return (
    <div className="plugin-content-inner attr-plugin">
      <div className="plugin-section-title"><BarChart3 size={18} /> 属性状态</div>

      {currentChapterId && (
        <button className="btn btn-primary btn-full btn-sm attr-save-btn" onClick={handleSaveChapter}>
          <Save size={14} /> 保存当前章属性
        </button>
      )}

      <div className="attr-grid">
        {visibleDefaults.map(a => renderCard(a))}
        {customAttrs.map(a => renderCard(a))}
      </div>

      <div className="attr-toolbar">
        {showNewField ? (
          <div className="attr-new-form">
            <div className="plugin-row">
              <input className="plugin-input sm" placeholder="字段名" value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddField(); }} />
              <input className="plugin-input sm attr-new-val" type="number" min={1} value={newVal}
                onChange={e => setNewVal(Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
            <div className="plugin-row-btns">
              <button className="btn btn-primary btn-sm" onClick={handleAddField}><Check size={14} /> 确认</button>
              <button className="btn btn-sm" onClick={() => setShowNewField(false)}>取消</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-sm attr-toolbar-btn" type="button" onClick={() => setShowNewField(true)}>
            <Plus size={14} /> 新建字段
          </button>
        )}

        <div className="attr-reset-compact">
          <input
            className="attr-reset-input"
            type="number"
            min={1}
            value={resetVal}
            onChange={e => setResetVal(Math.max(1, parseInt(e.target.value) || 1))}
            title="重置目标值"
          />
          <button className="btn btn-sm attr-toolbar-btn" type="button" onClick={handleResetAll} title="将全部属性设为此值">
            <RotateCcw size={14} /> 重置
          </button>
        </div>
      </div>

      {chapters.length > 0 && (
        <>
          <div className="notes-divider" />
          <div className="notes-count-label"><ClipboardList size={14} /> 已保存 ({chapters.length})</div>
          <div className="notes-list attr-saved-list">
            {[...chapters].sort((a, b) => {
              if (a.chapterId === currentChapterId) return -1;
              if (b.chapterId === currentChapterId) return 1;
              return 0;
            }).map(chap => {
              const isExpanded = expandedChapId === chap.chapterId;
              const isCurrent = chap.chapterId === currentChapterId;
              const savedAttrs = [
                ...DEFAULT_ATTRS.filter(a => !chap.deletedKeys.includes(a.key)),
                ...chap.customAttrs,
              ];
              return (
                <div key={chap.chapterId} className={`note-card attr-saved-card${isExpanded ? ' expanded' : ''}`}>
                  <div
                    className="note-card-header"
                    onClick={() => setExpandedChapId(isExpanded ? null : chap.chapterId)}
                  >
                    <span className={`note-arrow${isExpanded ? ' open' : ''}`}><ChevronRight size={14} /></span>
                    <span className="note-preview">
                      {chap.chapterTitle}
                      {isCurrent && <span className="attr-current-tag">当前</span>}
                    </span>
                    {!isExpanded && savedAttrs.length > 0 && (
                      <span className="attr-saved-summary">
                        {savedAttrs.slice(0, 3).map(a => `${a.label[0]}${chap.values[a.key] ?? 5}`).join(' · ')}
                        {savedAttrs.length > 3 ? '…' : ''}
                      </span>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="note-card-body">
                      <div className="attr-saved-chips">
                        {savedAttrs.map(a => (
                          <span key={a.key} className="attr-chip">
                            <span className="attr-chip-label">{a.icon} {a.label}</span>
                            <span className="attr-chip-val">{chap.values[a.key] ?? 5}</span>
                          </span>
                        ))}
                      </div>
                      <div className="attr-saved-actions">
                        <button className="btn btn-sm" type="button" onClick={() => handleLoadChapter(chap)}><Download size={14} /> 加载</button>
                        <button className="btn btn-sm btn-danger" type="button" onClick={() => handleDeleteChapter(chap.chapterId)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

/* ═════════════════════════════════════════════
   Plugin 5: 地图定位
   ═════════════════════════════════════════════ */

const MAPS_KEY = 'slate_maps';

const MapPlugin: React.FC = () => {
  const [maps, setMaps] = useState<MapData[]>(() => {
    try { const saved = localStorage.getItem(MAPS_KEY); return saved ? JSON.parse(saved) : []; }
    catch { return []; }
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editMap, setEditMap] = useState<MapData | null>(null);
  const [viewMap, setViewMap] = useState<MapData | null>(null);

  const persist = (updated: MapData[]) => {
    setMaps(updated);
    try { localStorage.setItem(MAPS_KEY, JSON.stringify(updated)); } catch { /* */ }
  };

  const handleSave = (name: string, dataURL: string, thumbnailURL: string, pins: MapPin[]) => {
    const newMap: MapData = {
      id: Date.now().toString(36),
      name,
      dataURL,
      thumbnailURL,
      createdAt: new Date().toLocaleString('zh-CN'),
      pins,
    };
    persist([newMap, ...maps]);
  };

  const handleEditSave = (name: string, dataURL: string, thumbnailURL: string, pins: MapPin[]) => {
    if (!editMap) return;
    const updated = maps.map(m =>
      m.id === editMap.id
        ? { ...m, name, dataURL, thumbnailURL, pins, createdAt: m.createdAt + ' (已编辑)' }
        : m
    );
    persist(updated);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('确定要删除这张地图吗？此操作不可撤销。')) return;
    persist(maps.filter(m => m.id !== id));
    if (editMap?.id === id) setEditMap(null);
    if (viewMap?.id === id) setViewMap(null);
  };

  return (
    <div className="plugin-content-inner">
      <div className="plugin-section-title"><MapIcon size={18} /> 地图定位 ({maps.length})</div>

      {/* New Map button */}
      <button
        className="btn btn-primary btn-full"
        onClick={() => setEditorOpen(true)}
      >
        <Palette size={14} /> 新建地图
      </button>

      {/* Saved maps list */}
      {maps.length > 0 ? (
        <div className="map-list">
          {maps.map(m => (
            <div key={m.id} className="map-card">
              <div
                className="map-thumb-wrap"
                onClick={() => setViewMap(m)}
                title="点击查看地图"
              >
                <img className="map-thumb" src={m.thumbnailURL} alt={m.name} />
              </div>
              <div className="map-card-body">
                <div className="map-card-name" title={m.name}>{m.name}</div>
                <div className="map-card-meta">
                  <span className="map-card-time">{m.createdAt}</span>
                </div>
              </div>
              <div className="map-card-actions">
                <button
                  className="map-action-btn edit"
                  onClick={() => setEditMap(m)}
                  title="编辑地图"
                ><Pencil size={14} /></button>
                <button
                  className="map-action-btn del"
                  onClick={() => handleDelete(m.id)}
                  title="删除地图"
                ><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="map-empty">
          <div className="map-empty-icon"><MapIcon size={48} /></div>
          <p>还没有地图<br />点击上方按钮创建你的第一张地图</p>
        </div>
      )}

      {/* Map Editor (new map mode) */}
      <MapEditor
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
      />

      {/* Map Editor (edit map mode) */}
      <MapEditor
        isOpen={!!editMap}
        mode="edit"
        initialDataURL={editMap?.dataURL ?? null}
        initialPins={editMap?.pins ?? []}
        onClose={() => setEditMap(null)}
        onSave={handleEditSave}
      />

      {/* Map Editor (view mode) */}
      <MapEditor
        isOpen={!!viewMap}
        mode="view"
        initialDataURL={viewMap?.dataURL ?? null}
        initialPins={viewMap?.pins ?? []}
        onClose={() => setViewMap(null)}
        onSave={() => {}}
      />
    </div>
  );
};

/* ═════════════════════════════════════════════
   Plugin 6: 时间线事件
   ═════════════════════════════════════════════ */

const TimelinePlugin: React.FC = () => {
  const [editorOpen, setEditorOpen] = useState(false);
  const [summary, setSummary] = useState(getTimelineSummary);

  const refresh = () => setSummary(getTimelineSummary());

  return (
    <div className="plugin-content-inner tl-plugin-compact">
      <div className="plugin-section-title"><Clock size={18} /> 时间线 ({summary.count})</div>

      <div className="tl-compact-range">{summary.minYear} — {summary.maxYear} 年</div>

      {summary.count > 0 ? (
        <div className="tl-compact-list">
          {summary.recent.map(ev => (
            <div key={ev.id} className="tl-compact-item">
              <span className="tl-compact-year">{ev.time}</span>
              <span className="tl-compact-text">{ev.event}</span>
            </div>
          ))}
          {summary.count > 4 && (
            <p className="tl-compact-more">还有 {summary.count - 4} 个事件…</p>
          )}
        </div>
      ) : (
        <div className="map-empty tl-compact-empty">
          <div className="map-empty-icon"><Clock size={40} /></div>
          <p>记录故事中的关键节点<br />在大视图中编辑更清晰</p>
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary btn-full"
        onClick={() => { refresh(); setEditorOpen(true); }}
      >
        <Maximize2 size={14} /> 打开时间线
      </button>

      <TimelineEditor
        isOpen={editorOpen}
        onClose={() => { setEditorOpen(false); refresh(); }}
      />
    </div>
  );
};

/* ═════════════════════════════════════════════
   Plugin 7: 关系图谱
   ═════════════════════════════════════════════ */

const RELATION_GRAPHS_KEY = 'slate_relation_graphs';

const RelationGraphPlugin: React.FC<{ chapterTitle: string }> = ({ chapterTitle }) => {
  const [graphs, setGraphs] = useState<RelationGraph[]>(() => {
    try { const saved = localStorage.getItem(RELATION_GRAPHS_KEY); return saved ? JSON.parse(saved) : []; }
    catch { return []; }
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editGraph, setEditGraph] = useState<RelationGraph | null>(null);
  const [viewGraph, setViewGraph] = useState<RelationGraph | null>(null);

  const persist = (updated: RelationGraph[]) => {
    setGraphs(updated);
    try { localStorage.setItem(RELATION_GRAPHS_KEY, JSON.stringify(updated)); } catch { /* */ }
  };

  const handleSave = (graph: RelationGraph) => {
    const existing = graphs.find(g => g.id === graph.id);
    if (existing) {
      persist(graphs.map(g => (g.id === graph.id ? graph : g)));
    } else {
      persist([graph, ...graphs]);
    }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('确定要删除这个关系图谱吗？此操作不可撤销。')) return;
    persist(graphs.filter(g => g.id !== id));
    if (editGraph?.id === id) setEditGraph(null);
    if (viewGraph?.id === id) setViewGraph(null);
  };

  const formatDateOnly = (dateStr: string): string => {
    const m = dateStr.match(/^(\d{4}\/\d{1,2}\/\d{1,2})/);
    return m ? m[1] : dateStr;
  };

  return (
    <div className="plugin-content-inner">
      <div className="plugin-section-title"><Network size={18} /> 关系图谱 ({graphs.length})</div>

      {/* Create button */}
      <button
        className="btn btn-primary btn-full"
        onClick={() => setEditorOpen(true)}
      >
        <Plus size={14} /> 创建图谱
      </button>

      {/* Saved graphs list */}
      {graphs.length > 0 ? (
        <div className="map-list">
          {graphs.map(g => (
            <div key={g.id} className="map-card rg-card-row">
              <div className="rg-card-logo" onClick={() => setViewGraph(g)} title={`${g.name} — 点击查看`}>
                <GraphThumbnail nodes={g.nodes} edges={g.edges} />
              </div>
              <div className="rg-card-info">
                <div className="rg-card-name" title={g.name}>{g.name}</div>
                <div className="rg-card-meta">
                  <span className="rg-card-date">{formatDateOnly(g.updatedAt || g.createdAt)}</span>
                  <span className="rg-card-count">{g.nodes.length}节点 · {g.edges.length}连线</span>
                </div>
                <div className="rg-card-btns">
                  <button className="btn btn-sm" onClick={() => setEditGraph(g)} title="编辑"><Pencil size={14} /></button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(g.id)} title="删除"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="map-empty">
          <div className="map-empty-icon"><Network size={48} /></div>
          <p>还没有关系图谱<br />点击上方按钮创建你的第一个图谱</p>
        </div>
      )}

      {/* Graph Editor (create mode) */}
      <RelationGraphEditor
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        chapterTitle={chapterTitle}
      />

      {/* Graph Editor (edit mode) */}
      <RelationGraphEditor
        isOpen={!!editGraph}
        mode="edit"
        initialGraph={editGraph}
        onClose={() => setEditGraph(null)}
        onSave={handleSave}
        chapterTitle={chapterTitle}
      />

      {/* Graph Editor (view mode) */}
      <RelationGraphEditor
        isOpen={!!viewGraph}
        mode="view"
        initialGraph={viewGraph}
        onClose={() => setViewGraph(null)}
        onSave={() => {}}
        chapterTitle={chapterTitle}
      />
    </div>
  );
};

/* ═════════════════════════════════════════════
   Main Plugin Panel
   ═════════════════════════════════════════════ */
interface PluginPanelProps {
  currentChapterId: string | null;
  chapterTitle: string;
}

const PluginPanel: React.FC<PluginPanelProps> = ({ currentChapterId, chapterTitle }) => {
  const [activePlugin, setActivePlugin] = useState<string | null>(null);
  const [panelExpanded, setPanelExpanded] = useState(() => {
    try { return localStorage.getItem(PLUGIN_PANEL_EXPANDED_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(PLUGIN_PANEL_EXPANDED_KEY, panelExpanded ? '1' : '0'); } catch { /* */ }
  }, [panelExpanded]);

  const renderPluginContent = () => {
    switch (activePlugin) {
      case 'names': return <NamesPlugin />;
      case 'notes': return <NotesPlugin />;
      case 'characters': return <CharactersPlugin />;
      case 'attributes': return <AttributesPlugin currentChapterId={currentChapterId} chapterTitle={chapterTitle} />;
      case 'map': return <MapPlugin />;
      case 'timeline': return <TimelinePlugin />;
      case 'relationgraph': return <RelationGraphPlugin chapterTitle={chapterTitle} />;
      default: return (
        <div className="plugin-empty">
          <div className="plugin-empty-icon"><Wrench size={48} /></div>
          <p>点击上方插件按钮<br />开始使用写作工具</p>
        </div>
      );
    }
  };

  // Map tab keys to Lucide icon components
  const tabIconMap: Record<string, React.ReactNode> = {
    names: <Dices size={16} />,
    notes: <Lightbulb size={16} />,
    characters: <User size={16} />,
    attributes: <BarChart3 size={16} />,
    map: <MapIcon size={16} />,
    timeline: <Clock size={16} />,
    relationgraph: <Network size={16} />,
  };

  return (
    <aside className={`plugin-panel${panelExpanded ? ' expanded' : ''}`}>
      <div className="plugin-panel-header">
        <button
          type="button"
          className="plugin-panel-expand-btn"
          onClick={() => setPanelExpanded(v => !v)}
          title={panelExpanded ? '收起工具箱' : '向左展开工具箱'}
          aria-expanded={panelExpanded}
          aria-label={panelExpanded ? '收起工具箱' : '向左展开工具箱'}
        >
          {panelExpanded ? <ChevronRight size={14} strokeWidth={2.25} /> : <ChevronLeft size={14} strokeWidth={2.25} />}
        </button>
        <span className="plugin-panel-title">
          {activePlugin
            ? PLUGINS.find((p) => p.key === activePlugin)?.label
            : '写作工具箱'}
        </span>
      </div>
      {/* 插件导航 — 纵向完整展示，无需滚动 */}
      <nav className="plugin-nav">
        {PLUGINS.map(p => (
          <button
            key={p.key}
            type="button"
            className={`plugin-nav-item${activePlugin === p.key ? ' active' : ''}`}
            onClick={() => setActivePlugin(activePlugin === p.key ? null : p.key)}
          >
            <span className="plugin-nav-icon">{tabIconMap[p.key]}</span>
            <span className="plugin-nav-label">{p.label}</span>
          </button>
        ))}
      </nav>

      {/* Plugin Content Area */}
      <div className="plugin-content">
        {renderPluginContent()}
      </div>
    </aside>
  );
};

export default PluginPanel;
