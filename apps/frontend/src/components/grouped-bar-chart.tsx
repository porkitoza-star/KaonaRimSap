import { formatThb } from '@/lib/format';

export interface GroupedBarPoint {
  period: string;
  a: number;
  b: number;
}

// Detects the period string's actual shape (YYYY / YYYY-MM / YYYY-MM-DD)
// rather than trusting the `granularity` prop, since the chart can briefly
// re-render with the new granularity before its matching data has finished
// fetching — parsing a "YYYY-MM" period as a day (or vice versa) produces an
// Invalid Date, which throws when formatted.
function formatPeriod(period: string): string {
  const parts = period.split('-').map(Number);
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    const [y, m, d] = parts;
    return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d));
  }
  if (parts.length === 2 && parts.every((n) => !Number.isNaN(n))) {
    const [y, m] = parts;
    return new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit' }).format(new Date(y, m - 1, 1));
  }
  if (parts.length === 1 && !Number.isNaN(parts[0])) return String(parts[0]);
  return period;
}

function formatCompact(value: number): string {
  if (value === 0) return '';
  return new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function GroupedBarChart({
  data,
  seriesALabel,
  seriesBLabel,
  colorA,
  colorB,
  ariaLabel,
  emptyMessage,
}: {
  data: GroupedBarPoint[];
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
  const height = 270;
  const padLeft = 56;
  const padRight = 12;
  const padTop = 24;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxValue = Math.max(...data.map((m) => Math.max(m.a, m.b)), 1);
  const groupW = plotW / data.length;
  const barW = Math.min(groupW * 0.32, 28);
  const gap = 4;
  const showValueLabels = data.length <= 40;

  const y = (value: number) => padTop + plotH - (value / maxValue) * plotH;
  const barHeight = (value: number) => (value / maxValue) * plotH;

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-gray-600">
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
              stroke="#e5e7eb"
              strokeWidth={1}
            />
            <text x={padLeft - 6} y={y(maxValue * frac) + 3} textAnchor="end" fontSize={9} fill="#4b5563">
              {formatThb(maxValue * frac)}
            </text>
          </g>
        ))}
        {data.map((m, i) => {
          const groupCenter = padLeft + groupW * i + groupW / 2;
          const aX = groupCenter - barW - gap / 2;
          const bX = groupCenter + gap / 2;
          const label = formatPeriod(m.period);
          return (
            <g key={m.period}>
              <rect x={aX} y={y(m.a)} width={barW} height={barHeight(m.a)} rx={2} fill={colorA}>
                <title>{`${label}: ${seriesALabel} ${formatThb(m.a)}`}</title>
              </rect>
              <rect x={bX} y={y(m.b)} width={barW} height={barHeight(m.b)} rx={2} fill={colorB}>
                <title>{`${label}: ${seriesBLabel} ${formatThb(m.b)}`}</title>
              </rect>
              {showValueLabels && m.a > 0 && (
                <text x={aX + barW / 2} y={y(m.a) - 3} textAnchor="middle" fontSize={8} fontWeight={600} fill={colorA}>
                  {formatCompact(m.a)}
                </text>
              )}
              {showValueLabels && m.b > 0 && (
                <text x={bX + barW / 2} y={y(m.b) - 3} textAnchor="middle" fontSize={8} fontWeight={600} fill={colorB}>
                  {formatCompact(m.b)}
                </text>
              )}
              <text x={groupCenter} y={height - 8} textAnchor="middle" fontSize={9} fill="#4b5563">
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
