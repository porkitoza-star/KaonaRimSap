import type { DashboardGranularity, LaborMaterialPeriod } from '@/lib/types';
import { GroupedBarChart } from './grouped-bar-chart';

export function LaborMaterialChart({
  series,
  granularity,
}: {
  series: LaborMaterialPeriod[];
  granularity: DashboardGranularity;
}) {
  return (
    <GroupedBarChart
      data={series.map((s) => ({ period: s.period, a: s.labor, b: s.material }))}
      granularity={granularity}
      seriesALabel="ค่าแรงช่าง"
      seriesBLabel="ค่าวัสดุ"
      colorA="#B8860B"
      colorB="#2563EB"
      ariaLabel="กราฟค่าแรงช่างและค่าวัสดุที่จ่าย"
      emptyMessage="ยังไม่มีข้อมูลใบแจ้งหนี้ค่าแรง/ค่าวัสดุ (นำเข้าจากชีท ค่าของ/ค่าแรง ใน Excel)"
    />
  );
}
