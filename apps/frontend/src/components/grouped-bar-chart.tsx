import type { DashboardGranularity } from '@/lib/types';
import { formatThb } from '@/lib/format';

export interface GroupedBarPoint {
  period: string;
  a: number;
  b: number;
}

function formatPeriod(period: string, granularity: DashboardGranularity): string {
  if (granularity === 'year') return period;
  if (granularity === 'day') {
    const [y, m, d] = period.split('-').map(Number);
    return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d));
  }
  const [y, m] = period.split('-').map(Number);
  return new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit' }).format(new Date(y, m - 1, 1));
}

export function GroupedBarChart({
  data,
  granularity,
  seriesALabel,
  seriesBLabel,
  colorA,
  colorB,
  ariaLabel,
  emptyMessage,
}: {
  data: GroupedBarPoint[];
  granularity: DashboardGranularity;
  seriesALabel: string;
  seriesBLabel: string;
  colorA: string;
  colorB: string;
  ariaLabel: string;
  emptyMessage: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400">{emptyMessage}</p>;
  }

  const width = 640;
  const height = 260;
  const padLeft = 56;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxValue = Math.max(...data.map((m) => Math.max(m.a, m.b)), 1);
  const groupW = plotW / data.length;
  const barW = Math.min(groupW * 0.32, 28);
  const gap = 4;

  const y = (value: number) => padTop + plotH - (value / maxValue) * plotH;
  const barHeight = (value: number) => (value / maxValue) * plotH;

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colorA }} /> {seriesALabel}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colorB }} /> {seriesBLabel}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={ariaLabel}>
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <g key={frac}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={y(maxValue * frac)}
              y2={y(maxValue * frac)}
              stroke="#f0f0f0"
              strokeWidth={1}
            />
            <text x={padLeft - 6} y={y(maxValue * frac) + 3} textAnchor="end" fontSize={9} fill="#9ca3af">
              {formatThb(maxValue * frac)}
            </text>
          </g>
        ))}
        {data.map((m, i) => {
          const groupCenter = padLeft + groupW * i + groupW / 2;
          const aX = groupCenter - barW - gap / 2;
          const bX = groupCenter + gap / 2;
          const label = formatPeriod(m.period, granularity);
          return (
            <g key={m.period}>
              <rect x={aX} y={y(m.a)} width={barW} height={barHeight(m.a)} rx={2} fill={colorA}>
                <title>{`${label}: ${seriesALabel} ${formatThb(m.a)}`}</title>
              </rect>
              <rect x={bX} y={y(m.b)} width={barW} height={barHeight(m.b)} rx={2} fill={colorB}>
                <title>{`${label}: ${seriesBLabel} ${formatThb(m.b)}`}</title>
              </rect>
              <text x={groupCenter} y={height - 8} textAnchor="middle" fontSize={9} fill="#9ca3af">
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
