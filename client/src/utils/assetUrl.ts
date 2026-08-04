import { API_BASE_URL } from '../api';

/** 将 /uploads/... 转为完整 URL，App 连 api 子域时必须用绝对地址 */
export function resolveAssetUrl(path?: string): string {
  if (!path) return '';
  if (/^(https?:|blob:|data:)/.test(path)) return path;

  const base = API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/$/, '')}${normalized}`;
}
