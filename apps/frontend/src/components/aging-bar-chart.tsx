import { formatThb } from '@/lib/format';

const BUCKET_LABELS: Record<string, string> = {
  current: 'ยังไม่ถึงกำหนด',
  days1to30: 'เกิน 1-30 วัน',
  days31to60: 'เกิน 31-60 วัน',
  days61to90: 'เกิน 61-90 วัน',
  over90: 'เกิน 90 วันขึ้นไป',
};

const BUCKET_ORDER = ['current', 'days1to30', 'days31to60', 'days61to90', 'over90'];

export function AgingBarChart({
  buckets,
  color,
}: {
  buckets: Record<string, number>;
  color: 'blue' | 'aqua';
}) {
  const max = Math.max(...BUCKET_ORDER.map((k) => buckets[k] ?? 0), 1);
  const barColor = color === 'blue' ? '#2a78d6' : '#1baf7a';
  const darkBarColor = color === 'blue' ? '#3987e5' : '#199e70';

  return (
    <div className="space-y-2">
      {BUCKET_ORDER.map((key) => {
        const value = buckets[key] ?? 0;
        const widthPct = Math.max((value / max) * 100, value > 0 ? 2 : 0);
        return (
          <div key={key} className="flex items-center gap-3" title={`${BUCKET_LABELS[key]}: ${formatThb(value)}`}>
            <span className="w-32 shrink-0 text-xs text-gray-500">{BUCKET_LABELS[key]}</span>
            <div className="h-3 flex-1 rounded-full bg-gray-100">
              <div
                className="h-3 rounded-full transition-all dark:hidden"
                style={{ width: `${widthPct}%`, backgroundColor: barColor }}
              />
              <div
                className="hidden h-3 rounded-full transition-all dark:block"
                style={{ width: `${widthPct}%`, backgroundColor: darkBarColor }}
              />
            </div>
            <span className="w-28 shrink-0 text-right text-xs tabular-nums text-gray-700">
              {formatThb(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
