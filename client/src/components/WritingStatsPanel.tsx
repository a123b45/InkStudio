import React, { useEffect, useState } from 'react';
import { X, Target, TrendingUp, Flame, BookOpen, PenLine } from 'lucide-react';
import { getWritingStats, setDailyGoal, getRecentDays, DayStat } from '../utils/writingStats';

interface WritingStatsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  bookWords?: number;
}

const WritingStatsPanel: React.FC<WritingStatsPanelProps> = ({ isOpen, onClose, bookWords }) => {
  const [, setTick] = useState(0);
  const [goal, setGoal] = useState(2000);

  useEffect(() => {
    if (isOpen) {
      setGoal(getWritingStats().dailyGoal);
      setTick((t) => t + 1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const stats = getWritingStats();
  const recent = getRecentDays(7);
  const todayKey = new Date().toISOString().slice(0, 10);
  const today = stats.days[todayKey] || 0;
  const progress = stats.dailyGoal > 0 ? Math.min(100, Math.round((today / stats.dailyGoal) * 100)) : 0;
  const maxWords = Math.max(...recent.map((r) => r.words), stats.dailyGoal, 1);
  const weekTotal = recent.reduce((sum, d) => sum + d.words, 0);

  const handleSaveGoal = () => {
    setDailyGoal(goal);
    onClose();
  };

  const adjustGoal = (delta: number) => {
    setGoal((g) => Math.max(100, g + delta));
  };

  return (
    <div className="modal-overlay feature-modal-overlay" onClick={onClose}>
      <div className="modal-card stats-modal" onClick={(e) => e.stopPropagation()}>
        <div className="feature-modal-header">
          <div className="feature-modal-title">
            <span className="feature-modal-icon stats-icon"><TrendingUp size={18} /></span>
            <div>
              <h2>写作统计</h2>
              <p className="feature-modal-subtitle">追踪每日产出与写作习惯</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="关闭"><X size={16} /></button>
        </div>

        <div className="feature-modal-body">
          {/* 今日进度主卡片 */}
          <div className="stats-hero">
            <div className="stats-hero-ring" style={{ '--progress': `${progress}%` } as React.CSSProperties}>
              <div className="stats-hero-ring-inner">
                <span className="stats-hero-value">{today.toLocaleString()}</span>
                <span className="stats-hero-unit">今日词数</span>
              </div>
            </div>
            <div className="stats-hero-meta">
              <div className="stats-hero-target">
                <Target size={15} />
                <span>目标 <strong>{stats.dailyGoal.toLocaleString()}</strong> 词</span>
                <span className="stats-hero-pct">{progress}%</span>
              </div>
              <div className="stats-hero-bar">
                <div className="stats-hero-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <p className="stats-hero-hint">
                {progress >= 100 ? '今日目标已达成，继续保持！' : `还差 ${Math.max(0, stats.dailyGoal - today).toLocaleString()} 词达标`}
              </p>
            </div>
          </div>

          {/* 次要指标 */}
          <div className="stats-metrics">
            <div className="stats-metric-card streak">
              <span className="stats-metric-icon"><Flame size={18} /></span>
              <div>
                <div className="stats-metric-value">{stats.streak}</div>
                <div className="stats-metric-label">连续达标</div>
              </div>
            </div>
            <div className="stats-metric-card week">
              <span className="stats-metric-icon"><PenLine size={18} /></span>
              <div>
                <div className="stats-metric-value">{weekTotal.toLocaleString()}</div>
                <div className="stats-metric-label">近 7 日合计</div>
              </div>
            </div>
            {bookWords !== undefined && (
              <div className="stats-metric-card book">
                <span className="stats-metric-icon"><BookOpen size={18} /></span>
                <div>
                  <div className="stats-metric-value">{bookWords.toLocaleString()}</div>
                  <div className="stats-metric-label">本书总字数</div>
                </div>
              </div>
            )}
          </div>

          {/* 目标设置 */}
          <div className="stats-goal-panel">
            <label className="stats-section-label">每日写作目标</label>
            <div className="stats-goal-control">
              <button type="button" className="stats-goal-btn" onClick={() => adjustGoal(-500)}>−</button>
              <div className="stats-goal-input-wrap">
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={goal}
                  onChange={(e) => setGoal(Math.max(100, Number(e.target.value) || 100))}
                />
                <span className="stats-goal-unit">词 / 天</span>
              </div>
              <button type="button" className="stats-goal-btn" onClick={() => adjustGoal(500)}>+</button>
            </div>
          </div>

          {/* 近 7 日图表 */}
          <div className="stats-chart-panel">
            <div className="stats-section-head">
              <span className="stats-section-label">近 7 日趋势</span>
              <span className="stats-section-meta">单位：词</span>
            </div>
            <div className="stats-chart">
              {recent.map((d: DayStat) => {
                const barPx = d.words > 0 ? Math.max(12, Math.round((d.words / maxWords) * 72)) : 6;
                const isToday = d.date === todayKey;
                return (
                  <div key={d.date} className={`stats-chart-col${isToday ? ' today' : ''}`} title={`${d.date}：${d.words.toLocaleString()} 词`}>
                    <span className="stats-chart-value">{d.words > 0 ? d.words.toLocaleString() : ''}</span>
                    <div className="stats-chart-bar-wrap">
                      <div className="stats-chart-bar" style={{ height: `${barPx}px` }} />
                    </div>
                    <span className="stats-chart-label">{d.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="feature-modal-footer">
          <button className="btn" onClick={onClose}>关闭</button>
          <button className="btn btn-primary" onClick={handleSaveGoal}>保存目标</button>
        </div>
      </div>
    </div>
  );
};

export default WritingStatsPanel;
