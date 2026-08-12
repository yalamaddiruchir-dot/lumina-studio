import { useState } from 'react';
import { moneyCompact } from '../lib/format';

/* ---------- Horizontal grouped bar chart (budget vs spent) ---------- */
export function BudgetBarChart({ data, height = 210 }) {
  const [tip, setTip] = useState(null);
  const max = Math.max(...data.map((d) => Math.max(d.budget, d.spent)), 1);
  return (
    <div style={{ position: 'relative' }}>
      <div className="flex gap-12 mb-12" style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
        <span className="flex gap-6"><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--primary)', display: 'inline-block' }} /> Budget</span>
        <span className="flex gap-6"><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--accent)', display: 'inline-block' }} /> Spent</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, position: 'relative' }}>
        {data.map((d) => (
          <div key={d.name} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.name}>
              {d.name}
            </span>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 3, position: 'relative' }}
              onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, name: d.name, budget: d.budget, spent: d.spent })}
              onMouseLeave={() => setTip(null)}
            >
              <div style={{ height: 7, borderRadius: 4, background: '#eceef6', position: 'relative' }}>
                <div style={{ width: `${(d.budget / max) * 100}%`, height: '100%', borderRadius: 4, background: 'var(--primary)', opacity: 0.85 }} />
              </div>
              <div style={{ height: 7, borderRadius: 4, background: '#eceef6', position: 'relative' }}>
                <div style={{ width: `${(d.spent / max) * 100}%`, height: '100%', borderRadius: 4, background: 'var(--accent)' }} />
              </div>
            </div>
          </div>
        ))}
        {tip && (
          <div className="chart-tip" style={{ left: Math.min(tip.x + 12, window.innerWidth - 220), top: Math.min(tip.y - 40, window.innerHeight - 80), position: 'fixed' }}>
            <div style={{ fontWeight: 700, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tip.name}</div>
            <div>Budget {moneyCompact(tip.budget)} · Spent {moneyCompact(tip.spent)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Donut chart ---------- */
export function DonutChart({ data, size = 168, thickness = 22, colors }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const palette = colors || ['#6366f1', '#8b5cf6', '#0ea371', '#f59e0b', '#dc2626', '#2563eb', '#64748b'];
  return (
    <div className="flex" style={{ gap: 22, justifyContent: 'center', flexWrap: 'wrap' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eceef6" strokeWidth={thickness} />
        {data.map((d, i) => {
          const len = (d.value / total) * circ;
          const seg = (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={palette[i % palette.length]}
              strokeWidth={thickness}
              strokeDasharray={`${Math.max(len - 2, 0)} ${circ - Math.max(len - 2, 0)}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
            />
          );
          offset += len;
          return seg;
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontSize: 22, fontWeight: 800, fill: 'var(--text)' }}>
          {total}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontSize: 10.5, fontWeight: 600, fill: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          projects
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, justifyContent: 'center' }}>
        {data.map((d, i) => (
          <div key={d.name} className="flex gap-6" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>
            <i style={{ width: 9, height: 9, borderRadius: 3, background: palette[i % palette.length], display: 'inline-block' }} />
            <span style={{ textTransform: 'capitalize', minWidth: 74 }}>{d.name.replace('_', ' ')}</span>
            <b style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{d.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Line / area chart (tasks completed per day) ---------- */
export function AreaChart({ data, height = 150, color = 'var(--primary)' }) {
  const [tip, setTip] = useState(null);
  const w = 520;
  const h = height;
  const pad = 16;
  const max = Math.max(...data.map((d) => d.count), 1);
  const step = (w - pad * 2) / Math.max(data.length - 1, 1);
  const pts = data.map((d, i) => [pad + i * step, h - pad - (d.count / max) * (h - pad * 2)]);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z`;
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * w;
          const idx = Math.round((x - pad) / step);
          if (idx >= 0 && idx < data.length) setTip({ x: e.clientX, y: e.clientY, ...data[idx] });
        }}
        onMouseLeave={() => setTip(null)}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad} x2={w - pad} y1={h - pad - (h - pad * 2) * f} y2={h - pad - (h - pad * 2) * f} stroke="#eceef6" strokeWidth={1} strokeDasharray="3 4" />
        ))}
        <path d={area} fill="url(#areaFill)" />
        <path d={line} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={2.6} fill="#fff" stroke={color} strokeWidth={2} />)}
      </svg>
      {tip && (
        <div className="chart-tip" style={{ left: Math.min(tip.x + 12, window.innerWidth - 180), top: Math.min(tip.y - 34, window.innerHeight - 80), position: 'fixed' }}>
          <b>{tip.count}</b> task{tip.count === 1 ? '' : 's'} · {tip.date}
        </div>
      )}
    </div>
  );
}
