import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Clock, X, Settings, Focus, Plus, Check, Pencil, Trash2, Save,
  GripVertical, Search, ZoomIn, ZoomOut,
} from 'lucide-react';

export interface TimelineEvent {
  id: string;
  time: number;
  event: string;
  side?: 'left' | 'right';
}

export const TIMELINE_KEY = 'slate_timeline';
export const TIMELINE_SETTINGS_KEY = 'slate_timeline_settings';

const DEFAULT_MIN_YEAR = 0;
const DEFAULT_MAX_YEAR = 1000;

const ERA_PRESETS = [
  { label: '古代', min: -3000, max: 618 },
  { label: '中世纪', min: 618, max: 1500 },
  { label: '近代', min: 1840, max: 1949 },
  { label: '现代', min: 1949, max: 2100 },
] as const;

const AXIS_TOP = 36;
const AXIS_BOT = 36;
const MIN_EVENT_GAP_PX = 96;
const AXIS_H_MIN = 360;
const AXIS_H_MAX = 2200;

function migrateEvents(raw: Array<TimelineEvent & { side?: string }>): TimelineEvent[] {
  return raw.map((e, i) => ({
    id: e.id,
    time: e.time,
    event: e.event,
    side: e.side === 'left' || e.side === 'right' ? e.side : (i % 2 === 0 ? 'left' : 'right'),
  }));
}

function loadEvents(): TimelineEvent[] {
  try {
    const saved = localStorage.getItem(TIMELINE_KEY);
    if (!saved) return [];
    return migrateEvents(JSON.parse(saved) as Array<TimelineEvent & { side?: string }>);
  } catch {
    return [];
  }
}

function loadSettings(): { minYear: number; maxYear: number } {
  try {
    const saved = localStorage.getItem(TIMELINE_SETTINGS_KEY);
    return saved ? JSON.parse(saved) : { minYear: DEFAULT_MIN_YEAR, maxYear: DEFAULT_MAX_YEAR };
  } catch {
    return { minYear: DEFAULT_MIN_YEAR, maxYear: DEFAULT_MAX_YEAR };
  }
}

function computeTicks(min: number, max: number, maxTicks = 10): number[] {
  const span = max - min;
  if (span <= 0) return [min];
  const rawStep = span / maxTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const ratio = rawStep / mag;
  let niceStep: number;
  if (ratio <= 1.5) niceStep = mag;
  else if (ratio <= 3) niceStep = 2 * mag;
  else if (ratio <= 7) niceStep = 5 * mag;
  else niceStep = 10 * mag;
  niceStep = Math.max(1, Math.round(niceStep));

  const ticks: number[] = [];
  const start = Math.ceil(min / niceStep) * niceStep;
  for (let t = start; t <= max; t += niceStep) ticks.push(t);
  if (ticks.length > maxTicks + 2) {
    const step = Math.ceil(ticks.length / maxTicks);
    return ticks.filter((_, i) => i % step === 0 || i === ticks.length - 1);
  }
  if (ticks[0] !== min) ticks.unshift(min);
  if (ticks[ticks.length - 1] !== max) ticks.push(max);
  return ticks;
}

/** Expand axis when events cluster in a wide year range */
function computeAxisHeight(
  events: TimelineEvent[],
  minYear: number,
  maxYear: number,
  zoom: number,
): number {
  const yearSpan = maxYear - minYear || 1;
  let axisH = AXIS_H_MIN;

  if (events.length >= 2) {
    const sorted = [...events].sort((a, b) => a.time - b.time);
    let minYearDiff = yearSpan;
    for (let i = 1; i < sorted.length; i++) {
      const diff = sorted[i].time - sorted[i - 1].time;
      if (diff > 0) minYearDiff = Math.min(minYearDiff, diff);
    }
    if (minYearDiff > 0 && minYearDiff < yearSpan) {
      axisH = Math.max(axisH, (MIN_EVENT_GAP_PX * yearSpan) / minYearDiff);
    }
  }

  axisH = Math.max(axisH, events.length * MIN_EVENT_GAP_PX);
  return Math.min(AXIS_H_MAX, axisH * zoom);
}

function eventTimeSpan(events: TimelineEvent[]): number {
  if (events.length === 0) return 0;
  const times = events.map(e => e.time);
  return Math.max(...times) - Math.min(...times);
}

interface TimelineEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

const TimelineEditor: React.FC<TimelineEditorProps> = ({ isOpen, onClose }) => {
  const [events, setEvents] = useState<TimelineEvent[]>(loadEvents);
  const [settings, setSettings] = useState(loadSettings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newTime, setNewTime] = useState('');
  const [newEvent, setNewEvent] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editEvent, setEditEvent] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [setMin, setSetMin] = useState(String(settings.minYear));
  const [setMax, setSetMax] = useState(String(settings.maxYear));
  const [zoom, setZoom] = useState(1);
  const [dismissFitHint, setDismissFitHint] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const eventRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragPreviewY, setDragPreviewY] = useState<number | null>(null);
  const dragStateRef = useRef<{
    id: string;
    origTime: number;
    startClientY: number;
    active: boolean;
    pointerId: number;
  } | null>(null);
  const dragJustEndedRef = useRef(false);
  const dragRafRef = useRef<number>(0);
  const pendingDragYRef = useRef<number | null>(null);

  const getTrackMetrics = useCallback(() => {
    const track = trackRef.current;
    if (!track) return null;
    const rect = track.getBoundingClientRect();
    const trackH = track.offsetHeight;
    const scaleY = trackH / rect.height;
    return { track, rect, trackH, scaleY };
  }, []);

  const clientYToTrackY = useCallback((clientY: number) => {
    const m = getTrackMetrics();
    if (!m) return AXIS_TOP;
    const y = (clientY - m.rect.top) * m.scaleY;
    return Math.max(AXIS_TOP, Math.min(m.trackH - AXIS_BOT, y));
  }, [getTrackMetrics]);

  const autoScrollCanvas = useCallback((clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const margin = 64;
    const speed = 14;
    if (clientY < rect.top + margin) {
      canvas.scrollTop = Math.max(0, canvas.scrollTop - speed);
    } else if (clientY > rect.bottom - margin) {
      canvas.scrollTop = Math.min(
        canvas.scrollHeight - canvas.clientHeight,
        canvas.scrollTop + speed,
      );
    }
  }, []);

  const flushDragPreview = useCallback(() => {
    dragRafRef.current = 0;
    if (pendingDragYRef.current === null) return;
    setDragPreviewY(pendingDragYRef.current);
    pendingDragYRef.current = null;
  }, []);

  const scheduleDragPreview = useCallback((clientY: number) => {
    pendingDragYRef.current = clientYToTrackY(clientY);
    if (!dragRafRef.current) {
      dragRafRef.current = requestAnimationFrame(flushDragPreview);
    }
  }, [clientYToTrackY, flushDragPreview]);

  const { minYear, maxYear } = settings;
  const yearSpan = maxYear - minYear || 1;

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...events].sort((a, b) => a.time - b.time);
    if (!q) return sorted;
    return sorted.filter(
      e => e.event.toLowerCase().includes(q) || String(e.time).includes(q),
    );
  }, [events, search]);

  const displayEvents = filteredEvents;
  const AXIS_H = computeAxisHeight(events, minYear, maxYear, zoom);

  const eventSpan = eventTimeSpan(events);
  const rangeTooWide = events.length > 0 && yearSpan > Math.max(eventSpan * 3, 50);
  const showFitHint = rangeTooWide && !dismissFitHint && !dragId;

  const timeToAxisY = useCallback((t: number): number => {
    const ratio = (maxYear - t) / yearSpan;
    return AXIS_TOP + ratio * AXIS_H;
  }, [maxYear, yearSpan, AXIS_H]);

  const trackYToTime = useCallback((trackY: number, trackH: number): number => {
    const axisH = trackH - AXIS_TOP - AXIS_BOT;
    const y = Math.max(AXIS_TOP, Math.min(trackH - AXIS_BOT, trackY)) - AXIS_TOP;
    const ratio = 1 - y / axisH;
    return Math.round(minYear + ratio * yearSpan);
  }, [minYear, yearSpan]);

  const eventYPositions = useMemo(() => {
    return displayEvents.map(ev => {
      if (ev.id === dragId && dragPreviewY !== null) return dragPreviewY;
      return timeToAxisY(ev.time);
    });
  }, [displayEvents, dragId, dragPreviewY, timeToAxisY]);

  const maxEventY = eventYPositions.length
    ? Math.max(...eventYPositions)
    : AXIS_TOP + AXIS_H;
  const computedTrackH = Math.max(AXIS_TOP + AXIS_H + AXIS_BOT, maxEventY + AXIS_BOT + 24);

  const ticks = computeTicks(minYear, maxYear);

  const persistEvents = (updated: TimelineEvent[]) => {
    updated.sort((a, b) => b.time - a.time);
    setEvents(updated);
    try { localStorage.setItem(TIMELINE_KEY, JSON.stringify(updated)); } catch { /* */ }
  };

  const nextSide = (list: TimelineEvent[]): 'left' | 'right' => {
    if (list.length === 0) return 'left';
    const last = [...list].sort((a, b) => a.time - b.time)[list.length - 1];
    return last.side === 'left' ? 'right' : 'left';
  };

  const persistSettings = (min: number, max: number) => {
    const s = { minYear: min, maxYear: max };
    setSettings(s);
    setSetMin(String(min));
    setSetMax(String(max));
    try { localStorage.setItem(TIMELINE_SETTINGS_KEY, JSON.stringify(s)); } catch { /* */ }
  };

  const autoFitRange = () => {
    if (events.length === 0) return;
    const times = events.map(e => e.time);
    const min = Math.min(...times);
    const max = Math.max(...times);
    const span = max - min || 50;
    const pad = Math.max(5, Math.round(span * 0.15));
    persistSettings(Math.floor(min - pad), Math.ceil(max + pad));
    setDismissFitHint(true);
  };

  const applySettings = () => {
    const mn = parseInt(setMin, 10);
    const mx = parseInt(setMax, 10);
    if (isNaN(mn) || isNaN(mx) || mn >= mx) return;
    persistEvents(events.map(e => ({ ...e, time: Math.max(mn, Math.min(mx, e.time)) })));
    persistSettings(mn, mx);
    setShowSettings(false);
  };

  const applyPreset = (min: number, max: number) => {
    persistEvents(events.map(e => ({ ...e, time: Math.max(min, Math.min(max, e.time)) })));
    persistSettings(min, max);
    setShowSettings(false);
  };

  const addEvent = () => {
    const t = parseFloat(newTime);
    if (isNaN(t) || t < minYear || t > maxYear || !newEvent.trim()) return;
    const id = Date.now().toString(36);
    persistEvents([...events, { id, time: t, event: newEvent.trim(), side: nextSide(events) }]);
    setNewTime('');
    setNewEvent('');
    setShowForm(false);
    setSelectedId(id);
  };

  const saveEdit = () => {
    if (!editId) return;
    const t = parseFloat(editTime);
    if (isNaN(t) || t < minYear || t > maxYear || !editEvent.trim()) return;
    persistEvents(events.map(e => e.id === editId ? { ...e, time: t, event: editEvent.trim() } : e));
    setEditId(null);
  };

  const deleteEvent = (id: string) => {
    persistEvents(events.filter(e => e.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editId === id) setEditId(null);
  };

  const startEdit = (ev: TimelineEvent) => {
    setSelectedId(ev.id);
    setEditId(ev.id);
    setEditTime(String(ev.time));
    setEditEvent(ev.event);
    setShowForm(false);
  };

  const scrollToEvent = (id: string) => {
    setSelectedId(id);
    const el = eventRefs.current.get(id);
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const elTop = el.offsetTop;
    canvas.scrollTo({ top: Math.max(0, elTop - canvas.clientHeight / 2), behavior: 'smooth' });
  };

  const handleCardPointerDown = useCallback((e: React.PointerEvent, ev: TimelineEvent) => {
    if ((e.target as HTMLElement).closest('.tl-editor-card-edit-btn')) return;
    e.preventDefault();
    e.stopPropagation();
    if (!getTrackMetrics()) return;

    dragStateRef.current = {
      id: ev.id,
      origTime: ev.time,
      startClientY: e.clientY,
      active: false,
      pointerId: e.pointerId,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [getTrackMetrics]);

  const handleCardPointerMove = useCallback((e: React.PointerEvent, ev: TimelineEvent) => {
    const ds = dragStateRef.current;
    if (!ds || ds.id !== ev.id || ds.pointerId !== e.pointerId) return;

    const moved = Math.abs(e.clientY - ds.startClientY);
    if (!ds.active) {
      if (moved < 8) return;
      ds.active = true;
      setDragId(ev.id);
      setSelectedId(ev.id);
      setEditId(null);
      setShowForm(false);
    }

    autoScrollCanvas(e.clientY);
    scheduleDragPreview(e.clientY);
  }, [autoScrollCanvas, scheduleDragPreview]);

  const handleCardPointerUp = useCallback((e: React.PointerEvent, ev: TimelineEvent) => {
    const ds = dragStateRef.current;
    if (!ds || ds.id !== ev.id || ds.pointerId !== e.pointerId) return;

    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

    if (ds.active) {
      const m = getTrackMetrics();
      if (m) {
        const y = clientYToTrackY(e.clientY);
        const newTimeVal = trackYToTime(y, m.trackH);
        const finalTime = Math.max(minYear, Math.min(maxYear, newTimeVal));
        if (finalTime !== ds.origTime) {
          setEvents(prev => {
            const updated = prev.map(item =>
              item.id === ev.id ? { ...item, time: finalTime } : item
            );
            updated.sort((a, b) => b.time - a.time);
            try { localStorage.setItem(TIMELINE_KEY, JSON.stringify(updated)); } catch { /* */ }
            return updated;
          });
          if (editId === ev.id) setEditTime(String(finalTime));
        }
      }
      dragJustEndedRef.current = true;
      setTimeout(() => { dragJustEndedRef.current = false; }, 150);
    } else if (!dragJustEndedRef.current) {
      setSelectedId(ev.id);
      setEditId(ev.id);
      setEditTime(String(ev.time));
      setEditEvent(ev.event);
      setShowForm(false);
    }

    dragStateRef.current = null;
    cancelAnimationFrame(dragRafRef.current);
    dragRafRef.current = 0;
    pendingDragYRef.current = null;
    setDragId(null);
    setDragPreviewY(null);
  }, [clientYToTrackY, getTrackMetrics, trackYToTime, minYear, maxYear, editId]);

  const handleCardPointerCancel = useCallback((e: React.PointerEvent, ev: TimelineEvent) => {
    const ds = dragStateRef.current;
    if (!ds || ds.id !== ev.id) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* */ }
    dragStateRef.current = null;
    cancelAnimationFrame(dragRafRef.current);
    dragRafRef.current = 0;
    pendingDragYRef.current = null;
    setDragId(null);
    setDragPreviewY(null);
  }, []);

  const handleTrackClick = (e: React.MouseEvent) => {
    if (dragId || dragJustEndedRef.current) return;
    if ((e.target as HTMLElement).closest('.tl-editor-card, .tl-editor-event, button, input, textarea')) return;
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scaleY = computedTrackH / rect.height;
    const y = (e.clientY - rect.top) * scaleY;
    const time = trackYToTime(y, computedTrackH);
    setNewTime(String(time));
    setNewEvent('');
    setShowForm(true);
    setEditId(null);
  };

  useEffect(() => {
    if (!isOpen) return;
    setEvents(loadEvents());
    setSettings(loadSettings());
    setDismissFitHint(false);
    setZoom(1);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dragId) {
          cancelAnimationFrame(dragRafRef.current);
          dragRafRef.current = 0;
          pendingDragYRef.current = null;
          dragStateRef.current = null;
          setDragId(null);
          setDragPreviewY(null);
          e.stopPropagation();
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, dragId]);

  const previewTimeFor = (ev: TimelineEvent, isDragging: boolean) => {
    if (isDragging && dragPreviewY !== null) {
      const m = getTrackMetrics();
      return m ? trackYToTime(dragPreviewY, m.trackH) : ev.time;
    }
    return ev.time;
  };

  const dragPreviewTime = dragPreviewY !== null && dragId
    ? trackYToTime(dragPreviewY, computedTrackH)
    : null;

  if (!isOpen) return null;

  return (
    <div className="tl-editor-overlay" onClick={onClose}>
      <div className="tl-editor-container" onClick={e => e.stopPropagation()}>
        <header className="tl-editor-header">
          <h2><Clock size={20} /> 故事时间线 <span className="tl-editor-count">{events.length} 个事件</span></h2>
          <div className="tl-editor-header-actions">
            <span className="tl-editor-range-badge">{minYear} — {maxYear} 年</span>
            {events.length > 0 && (
              <button type="button" className="btn btn-sm" onClick={autoFitRange} title="自动适应事件范围">
                <Focus size={14} /> 适应
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => { setShowSettings(!showSettings); setSetMin(String(minYear)); setSetMax(String(maxYear)); }}
            >
              <Settings size={14} /> 范围
            </button>
            <button type="button" className="modal-close-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </header>

        {showSettings && (
          <div className="tl-editor-settings-bar">
            <div className="tl-editor-presets">
              {ERA_PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  className={`tl-preset-chip${minYear === p.min && maxYear === p.max ? ' active' : ''}`}
                  onClick={() => applyPreset(p.min, p.max)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="tl-editor-settings-row">
              <input className="plugin-input sm" type="number" placeholder="最小年" value={setMin} onChange={e => setSetMin(e.target.value)} />
              <span className="tl-settings-sep">—</span>
              <input className="plugin-input sm" type="number" placeholder="最大年" value={setMax} onChange={e => setSetMax(e.target.value)} />
              <button type="button" className="btn btn-primary btn-sm" onClick={applySettings}>应用</button>
              <button type="button" className="btn btn-sm" onClick={() => setShowSettings(false)}>取消</button>
            </div>
          </div>
        )}

        <div className="tl-editor-body">
          <aside className="tl-editor-sidebar">
            <div className="tl-editor-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="搜索事件..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="tl-editor-list">
              {displayEvents.length === 0 ? (
                <p className="tl-editor-list-empty">
                  {search ? '没有匹配的事件' : '暂无事件，点击下方添加'}
                </p>
              ) : (
                displayEvents.map(ev => {
                  const preview = dragId === ev.id ? dragPreviewTime : null;
                  const listYear = preview ?? ev.time;
                  return (
                  <button
                    key={ev.id}
                    type="button"
                    className={`tl-editor-list-item${selectedId === ev.id ? ' active' : ''}${dragId === ev.id ? ' dragging' : ''}`}
                    onClick={() => scrollToEvent(ev.id)}
                  >
                    <span className="tl-editor-list-year">
                      {listYear}
                      {preview !== null && preview !== ev.time && (
                        <span className="tl-editor-list-year-from"> ← {ev.time}</span>
                      )}
                    </span>
                    <span className="tl-editor-list-text">{ev.event}</span>
                  </button>
                  );
                })
              )}
            </div>

            <div className="tl-editor-sidebar-footer">
              {editId ? (
                <div className="tl-editor-form">
                  <div className="tl-editor-form-title">编辑事件</div>
                  <input className="plugin-input sm" type="number" value={editTime} onChange={e => setEditTime(e.target.value)} min={minYear} max={maxYear} placeholder="年份" />
                  <textarea className="plugin-textarea" value={editEvent} onChange={e => setEditEvent(e.target.value)} rows={3} placeholder="事件描述..." />
                  <div className="plugin-row-btns">
                    <button type="button" className="btn btn-primary btn-sm" onClick={saveEdit}><Save size={14} /> 保存</button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => deleteEvent(editId)}><Trash2 size={14} /></button>
                    <button type="button" className="btn btn-sm" onClick={() => setEditId(null)}>取消</button>
                  </div>
                </div>
              ) : showForm ? (
                <div className="tl-editor-form">
                  <div className="tl-editor-form-title">添加事件</div>
                  <input className="plugin-input sm" type="number" placeholder={`年份 (${minYear}–${maxYear})`} value={newTime} onChange={e => setNewTime(e.target.value)} min={minYear} max={maxYear} />
                  <textarea className="plugin-textarea" placeholder="事件描述..." value={newEvent} onChange={e => setNewEvent(e.target.value)} rows={3} />
                  <div className="plugin-row-btns">
                    <button type="button" className="btn btn-primary btn-sm" onClick={addEvent}><Check size={14} /> 添加</button>
                    <button type="button" className="btn btn-sm" onClick={() => setShowForm(false)}>取消</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn btn-primary btn-full btn-sm" onClick={() => { setShowForm(true); setEditId(null); }}>
                  <Plus size={14} /> 添加事件
                </button>
              )}
            </div>
          </aside>

          <div className="tl-editor-canvas-wrap">
            <div className="tl-editor-canvas-toolbar">
              <span className="tl-editor-canvas-label">时间轴</span>
              <div className="tl-editor-zoom">
                <button
                  type="button"
                  className="btn btn-sm"
                  title="缩小"
                  disabled={zoom <= 0.6}
                  onClick={() => setZoom(z => Math.max(0.6, +(z - 0.2).toFixed(1)))}
                >
                  <ZoomOut size={14} />
                </button>
                <span className="tl-editor-zoom-val">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  className="btn btn-sm"
                  title="放大"
                  disabled={zoom >= 2.4}
                  onClick={() => setZoom(z => Math.min(2.4, +(z + 0.2).toFixed(1)))}
                >
                  <ZoomIn size={14} />
                </button>
              </div>
            </div>

            {showFitHint && (
              <div className="tl-editor-fit-hint">
                <span>事件挤在一起？当前范围 {yearSpan} 年，事件仅跨度 {eventSpan || '—'} 年</span>
                <button type="button" className="btn btn-sm btn-primary" onClick={autoFitRange}>
                  <Focus size={14} /> 一键适应
                </button>
                <button type="button" className="tl-editor-fit-dismiss" onClick={() => setDismissFitHint(true)} aria-label="关闭">
                  <X size={14} />
                </button>
              </div>
            )}

          <div className="tl-editor-canvas" ref={canvasRef}>
            <div
              className="tl-editor-track"
              ref={trackRef}
              style={{ height: computedTrackH }}
              onClick={handleTrackClick}
            >
              <div className="tl-editor-axis" style={{ top: AXIS_TOP, bottom: AXIS_BOT }} />
              <div className="tl-editor-axis-arrow" style={{ top: AXIS_TOP - 6 }} />

              {ticks.map((t, ti) => {
                const y = timeToAxisY(t);
                const isEdge = t === minYear || t === maxYear;
                const tickSide = ti % 2 === 0 ? 'left' : 'right';
                return (
                  <span
                    key={t}
                    className={`tl-editor-tick tl-editor-tick-${tickSide}${isEdge ? ' edge' : ''}`}
                    style={{ top: y }}
                  >
                    {t}
                  </span>
                );
              })}

              {dragPreviewY !== null && (
                <div className="tl-editor-snap-guide" style={{ top: dragPreviewY }} />
              )}

              {displayEvents.length === 0 && !search && (
                <div className="tl-editor-canvas-empty">
                  <Clock size={40} strokeWidth={1.2} />
                  <p>点击时间轴空白处快速添加事件</p>
                  <p className="tl-empty-hint">或在左侧面板添加 · 拖拽便签调整年份</p>
                </div>
              )}

              {displayEvents.map((ev, i) => {
                const side = ev.side ?? (i % 2 === 0 ? 'left' : 'right');
                const isDragging = dragId === ev.id;
                const isSelected = selectedId === ev.id;
                const y = eventYPositions[i];
                const displayTime = previewTimeFor(ev, isDragging);

                return (
                  <div
                    key={ev.id}
                    ref={el => { if (el) eventRefs.current.set(ev.id, el); else eventRefs.current.delete(ev.id); }}
                    className={`tl-editor-event tl-editor-event-${side}${isDragging ? ' dragging' : ''}${isSelected ? ' selected' : ''}`}
                    style={{ top: y }}
                  >
                    <div className={`tl-editor-conn tl-editor-conn-${side}`} />
                    <div
                      className="tl-editor-card"
                      onPointerDown={e => handleCardPointerDown(e, ev)}
                      onPointerMove={e => handleCardPointerMove(e, ev)}
                      onPointerUp={e => handleCardPointerUp(e, ev)}
                      onPointerCancel={e => handleCardPointerCancel(e, ev)}
                    >
                      <div className="tl-grip" aria-hidden="true">
                        <GripVertical size={14} />
                      </div>
                      <div className="tl-editor-card-body">
                        <div className="tl-editor-card-year">
                          {isDragging ? (
                            displayTime !== ev.time ? (
                              <span className="tl-editor-year-change">
                                <span className="tl-editor-year-from">{ev.time}</span>
                                <span className="tl-editor-year-arrow">→</span>
                                <span className="tl-editor-year-to">{displayTime}</span>
                                <span className="tl-editor-year-unit">年</span>
                              </span>
                            ) : (
                              <>{ev.time} 年</>
                            )
                          ) : (
                            <>{ev.time} 年</>
                          )}
                        </div>
                        <div className="tl-editor-card-text">{ev.event}</div>
                        {isDragging && displayTime !== ev.time && (
                          <div className="tl-editor-drag-hint">松开保存</div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="tl-editor-card-edit-btn"
                        title="编辑"
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); startEdit(ev); }}
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineEditor;

export function getTimelineSummary(): {
  count: number;
  minYear: number;
  maxYear: number;
  recent: TimelineEvent[];
} {
  const events = loadEvents();
  const settings = loadSettings();
  const sorted = [...events].sort((a, b) => b.time - a.time);
  return {
    count: events.length,
    minYear: settings.minYear,
    maxYear: settings.maxYear,
    recent: sorted.slice(0, 4),
  };
}
