import type { IncomeExpensePeriod } from '@/lib/types';
import { GroupedBarChart } from './grouped-bar-chart';

export function IncomeExpenseChart({ series }: { series: IncomeExpensePeriod[] }) {
  return (
    <GroupedBarChart
      data={series.map((s) => ({ period: s.period, a: s.income, b: s.expense }))}
      seriesALabel="รายรับ"
      seriesBLabel="รายจ่าย"
      colorA="#1B5E3A"
      colorB="#d03b3b"
      ariaLabel="กราฟรายรับ-รายจ่าย"
      emptyMessage="ยังไม่มีข้อมูลรายรับ-รายจ่าย"
    />
  );
}
