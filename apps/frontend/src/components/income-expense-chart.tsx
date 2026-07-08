import type { MonthlyIncomeExpense } from '@/lib/types';
import { formatThb } from '@/lib/format';

function formatMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit' }).format(new Date(y, m - 1, 1));
}

export function IncomeExpenseChart({ monthly }: { monthly: MonthlyIncomeExpense[] }) {
  if (monthly.length === 0) {
    return <p className="text-sm text-gray-400">ยังไม่มีข้อมูลรายรับ-รายจ่าย</p>;
  }

  const width = 640;
  const height = 260;
  const padLeft = 48;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxValue = Math.max(...monthly.map((m) => Math.max(m.income, m.expense)), 1);
  const groupW = plotW / monthly.length;
  const barW = Math.min(groupW * 0.32, 28);
  const gap = 4;

  const y = (value: number) => padTop + plotH - (value / maxValue) * plotH;
  const barHeight = (value: number) => (value / maxValue) * plotH;

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#1B5E3A]" /> รายรับ
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#d03b3b]" /> รายจ่าย
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="กราฟรายรับ-รายจ่ายรายเดือน">
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
        {monthly.map((m, i) => {
          const groupCenter = padLeft + groupW * i + groupW / 2;
          const incomeX = groupCenter - barW - gap / 2;
          const expenseX = groupCenter + gap / 2;
          return (
            <g key={m.month}>
              <rect
                x={incomeX}
                y={y(m.income)}
                width={barW}
                height={barHeight(m.income)}
                rx={2}
                fill="#1B5E3A"
              >
                <title>{`${formatMonth(m.month)}: รายรับ ${formatThb(m.income)}`}</title>
              </rect>
              <rect
                x={expenseX}
                y={y(m.expense)}
                width={barW}
                height={barHeight(m.expense)}
                rx={2}
                fill="#d03b3b"
              >
                <title>{`${formatMonth(m.month)}: รายจ่าย ${formatThb(m.expense)}`}</title>
              </rect>
              <text x={groupCenter} y={height - 8} textAnchor="middle" fontSize={9} fill="#9ca3af">
                {formatMonth(m.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
