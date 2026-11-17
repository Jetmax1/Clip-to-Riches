import type { ReactNode } from 'react';
import { CATEGORY_COLOR, CATEGORY_LABEL } from '../../data/editorOptions';
import type { MomentCategory } from '../../types/game';

export function Stars({ value, max = 5, label }: { value: number; max?: number; label?: string }): JSX.Element {
  return (
    <span className="stars" aria-label={`${label ?? 'Rating'}: ${value} of ${max}`} title={`${value}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < value ? 'on' : ''} />
      ))}
    </span>
  );
}

export function Meter({ value, color, label }: { value: number; color?: string; label?: string }): JSX.Element {
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <span style={{ width: `${v * 100}%`, background: color }} />
    </span>
  );
}

export function CategoryTag({ c }: { c: MomentCategory }): JSX.Element {
  return (
    <span className="tag" style={{ color: CATEGORY_COLOR[c], borderColor: CATEGORY_COLOR[c] }}>
      {CATEGORY_LABEL[c]}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }): JSX.Element {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>
        ✦
      </div>
      <h4>{title}</h4>
      {children}
    </div>
  );
}

export function Sparkline({ points, width = 120, height = 28, color = '#4fd8e8' }: { points: number[]; width?: number; height?: number; color?: string }): JSX.Element {
  if (points.length < 2) return <svg width={width} height={height} aria-hidden />;
  const max = Math.max(1, ...points);
  const step = width / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - 2 - (p / max) * (height - 4)).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="spark">
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={color} opacity={0.15} />
      <path d={d} fill="none" stroke={color} strokeWidth={2} />
    </svg>
  );
}
