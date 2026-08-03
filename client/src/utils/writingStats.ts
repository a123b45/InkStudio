const STATS_KEY = 'inkstudio_writing_stats';
const GOAL_KEY = 'inkstudio_daily_goal';

export interface DayStat {
  date: string;
  words: number;
}

export interface WritingStats {
  dailyGoal: number;
  days: Record<string, number>;
  streak: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadStats(): WritingStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  const goal = Number(localStorage.getItem(GOAL_KEY)) || 2000;
  return { dailyGoal: goal, days: {}, streak: 0 };
}

function saveStats(stats: WritingStats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function calcStreak(days: Record<string, number>, goal: number): number {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key = d.toISOString().slice(0, 10);
    if ((days[key] || 0) >= goal) {
      streak++;
    } else if (i > 0) {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function recordWordDelta(prevWords: number, newWords: number) {
  const delta = Math.max(0, newWords - prevWords);
  if (delta === 0) return;

  const stats = loadStats();
  const key = todayKey();
  stats.days[key] = (stats.days[key] || 0) + delta;
  stats.streak = calcStreak(stats.days, stats.dailyGoal);
  saveStats(stats);
}

export function getWritingStats(): WritingStats {
  const stats = loadStats();
  stats.streak = calcStreak(stats.days, stats.dailyGoal);
  return stats;
}

export function setDailyGoal(goal: number) {
  const stats = loadStats();
  stats.dailyGoal = goal;
  localStorage.setItem(GOAL_KEY, String(goal));
  stats.streak = calcStreak(stats.days, goal);
  saveStats(stats);
}

export function getTodayProgress(): { today: number; goal: number; streak: number } {
  const stats = getWritingStats();
  return {
    today: stats.days[todayKey()] || 0,
    goal: stats.dailyGoal,
    streak: stats.streak,
  };
}

export function getRecentDays(count = 7): DayStat[] {
  const stats = getWritingStats();
  const result: DayStat[] = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    const key = d.toISOString().slice(0, 10);
    result.unshift({ date: key, words: stats.days[key] || 0 });
    d.setDate(d.getDate() - 1);
  }
  return result;
}
