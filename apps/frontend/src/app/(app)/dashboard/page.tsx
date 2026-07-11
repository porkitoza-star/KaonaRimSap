'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { DashboardGranularity, IncomeExpenseSummary, LaborMaterialSummary } from '@/lib/types';
import { formatDate, formatThb } from '@/lib/format';
import { StatTile } from '@/components/stat-tile';
import { AgingBarChart } from '@/components/aging-bar-chart';
import { IncomeExpenseChart } from '@/components/income-expense-chart';
import { LaborMaterialChart } from '@/components/labor-material-chart';
import { GranularityToggle } from '@/components/granularity-toggle';

interface CashBalance {
  balance: number;
}

interface AgingResponse {
  buckets: Record<string, number>;
}

interface PnlRow {
  costCenterId: string;
  costCenterName: string;
  revenue: number;
  expense: number;
  profit: number;
}

interface CashFlowForecast {
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
}

interface PendingMilestoneItem {
  id: string;
  costCenterName: string;
  name: string;
  amount: number;
  plannedDate: string | null;
}

interface PendingMilestones {
  totalOverdue: number;
  totalDueSoon: number;
  overdue: PendingMilestoneItem[];
  dueSoon: PendingMilestoneItem[];
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [cash, setCash] = useState<CashBalance | null>(null);
  const [arAging, setArAging] = useState<AgingResponse | null>(null);
  const [apAging, setApAging] = useState<AgingResponse | null>(null);
  const [pnl, setPnl] = useState<PnlRow[] | null>(null);
  const [forecast, setForecast] = useState<CashFlowForecast | null>(null);
  const [milestones, setMilestones] = useState<PendingMilestones | null>(null);
  const [incomeExpense, setIncomeExpense] = useState<IncomeExpenseSummary | null>(null);
  const [laborMaterial, setLaborMaterial] = useState<LaborMaterialSummary | null>(null);
  const [granularity, setGranularity] = useState<DashboardGranularity>('month');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.get<CashBalance>('/dashboard/cash-balance', token),
      api.get<AgingResponse>('/dashboard/ar-aging', token),
      api.get<AgingResponse>('/dashboard/ap-aging', token),
      api.get<PnlRow[]>('/dashboard/pnl-by-cost-center', token),
      api.get<CashFlowForecast>('/dashboard/cash-flow-forecast', token),
      api.get<PendingMilestones>('/dashboard/pending-construction-milestones', token),
    ])
      .then(([cashRes, arRes, apRes, pnlRes, forecastRes, milestonesRes]) => {
        setCash(cashRes);
        setArAging(arRes);
        setApAging(apRes);
        setPnl(pnlRes);
        setForecast(forecastRes);
        setMilestones(milestonesRes);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'โหลดข้อมูลแดชบอร์ดไม่สำเร็จ');
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.get<IncomeExpenseSummary>(`/dashboard/income-expense-summary?granularity=${granularity}`, token),
      api.get<LaborMaterialSummary>(`/dashboard/labor-material-paid?granularity=${granularity}`, token),
    ])
      .then(([incomeExpenseRes, laborMaterialRes]) => {
        setIncomeExpense(incomeExpenseRes);
        setLaborMaterial(laborMaterialRes);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'โหลดข้อมูลกราฟไม่สำเร็จ');
      });
  }, [token, granularity]);

  if (error) {
    return <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">แดชบอร์ดการเงิน</h1>
        <p className="text-sm text-gray-500">ข้อมูลล่าสุดจากระบบบัญชี ณ ขณะนี้</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="เงินสดคงเหลือ"
          value={cash ? formatThb(cash.balance) : '...'}
          tone={cash && cash.balance < 0 ? 'critical' : 'good'}
        />
        <StatTile
          label="กระแสเงินสดคาดการณ์ 90 วัน"
          value={forecast ? formatThb(forecast.netCashFlow) : '...'}
          tone={forecast && forecast.netCashFlow < 0 ? 'critical' : 'good'}
        />
        <StatTile
          label="เงินเข้าที่คาดการณ์ (90 วัน)"
          value={forecast ? formatThb(forecast.totalInflow) : '...'}
        />
        <StatTile
          label="เงินออกที่คาดการณ์ (90 วัน)"
          value={forecast ? formatThb(forecast.totalOutflow) : '...'}
        />
        <StatTile
          label="งวดเงินก่อสร้างค้างชำระ (เลยกำหนด)"
          value={milestones ? formatThb(milestones.totalOverdue) : '...'}
          tone={milestones && milestones.totalOverdue > 0 ? 'critical' : 'good'}
        />
        <StatTile
          label="งวดเงินก่อสร้างใกล้ครบกำหนด (30 วัน)"
          value={milestones ? formatThb(milestones.totalDueSoon) : '...'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">อายุลูกหนี้การค้า (AR Aging)</h2>
          <div className="mt-4">
            {arAging ? <AgingBarChart buckets={arAging.buckets} color="blue" /> : <p className="text-sm text-gray-400">กำลังโหลด...</p>}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">อายุเจ้าหนี้การค้า (AP Aging)</h2>
          <div className="mt-4">
            {apAging ? <AgingBarChart buckets={apAging.buckets} color="aqua" /> : <p className="text-sm text-gray-400">กำลังโหลด...</p>}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">กำไรขาดทุนแยกตามโครงการ/บ้าน (P&amp;L by Cost Center)</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="py-2 pr-4 font-medium">โครงการ / บ้าน</th>
                <th className="py-2 pr-4 text-right font-medium">รายได้</th>
                <th className="py-2 pr-4 text-right font-medium">ต้นทุน/ค่าใช้จ่าย</th>
                <th className="py-2 text-right font-medium">กำไร(ขาดทุน)</th>
              </tr>
            </thead>
            <tbody>
              {pnl && pnl.length > 0 ? (
                pnl.map((row) => (
                  <tr key={row.costCenterId} className="border-b border-gray-50">
                    <td className="py-2 pr-4">{row.costCenterName}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatThb(row.revenue)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatThb(row.expense)}</td>
                    <td
                      className={`py-2 text-right tabular-nums ${row.profit < 0 ? 'text-[#d03b3b]' : 'text-[#0ca30c]'}`}
                    >
                      {formatThb(row.profit)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-sm text-gray-400">
                    {pnl ? 'ยังไม่มีข้อมูล' : 'กำลังโหลด...'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">ช่วงเวลาของกราฟด้านล่าง</p>
        <GranularityToggle value={granularity} onChange={setGranularity} />
      </div>

      {incomeExpense && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">รายรับ-รายจ่าย</h2>
            <p className="mt-1 text-xs text-gray-400">รวมจากใบแจ้งหนี้ (AR) และบิล (AP) ทั้งหมด ตามวันที่ออกเอกสาร</p>
            <div className="mt-4">
              <IncomeExpenseChart series={incomeExpense.series} />
            </div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">รายจ่ายแยกตามหมวดงาน</h2>
            <p className="mt-1 text-xs text-gray-400">
              รวมยอดค่าใช้จ่ายจากบิล (AP) ตามหมวดงานที่ระบุไว้ในแต่ละรายการ
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="py-2 pr-4 font-medium">หมวดงาน</th>
                    <th className="py-2 text-right font-medium">ยอดรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeExpense.byWorkCategory.length > 0 ? (
                    incomeExpense.byWorkCategory.map((row) => (
                      <tr key={row.category} className="border-b border-gray-50">
                        <td className="py-2 pr-4">{row.category}</td>
                        <td className="py-2 text-right tabular-nums">{formatThb(row.amount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="py-4 text-center text-sm text-gray-400">
                        ยังไม่มีข้อมูล
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {laborMaterial && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">ค่าแรงช่างและค่าวัสดุที่จ่าย</h2>
          <p className="mt-1 text-xs text-gray-400">
            รวมทั้งใบแจ้งหนี้ผู้จำหน่ายที่เป็นทางการ (ชีท &quot;ค่าของ&quot;/&quot;ค่าแรง&quot;) และรายการค่าแรงที่จ่ายตรงในบัญชีรายรับ-รายจ่ายหลัก
            (ตรวจจับจากคำว่า &quot;ค่าแรง&quot;/&quot;ค่าจ้าง&quot;/&quot;ช่าง&quot; ในรายการ — {formatThb(laborMaterial.totalLaborFromLedgerKeywords)} จากส่วนนี้)
            — รวม {formatThb(laborMaterial.totalLabor)} ค่าแรง และ {formatThb(laborMaterial.totalMaterial)} ค่าวัสดุ
          </p>
          <div className="mt-4">
            <LaborMaterialChart series={laborMaterial.series} />
          </div>
        </div>
      )}

      {milestones && (milestones.overdue.length > 0 || milestones.dueSoon.length > 0) && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">งวดเงินก่อสร้างที่ต้องติดตาม (Payment Milestones)</h2>
          <p className="mt-1 text-xs text-gray-400">
            งวดเงินที่ยังไม่ได้รับ ทั้งที่เลยกำหนดแล้วและใกล้ครบกำหนดใน 30 วัน จากทุกบ้าน/โครงการ
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="py-2 pr-4 font-medium">บ้าน/โครงการ</th>
                  <th className="py-2 pr-4 font-medium">งวดเงิน</th>
                  <th className="py-2 pr-4 text-right font-medium">จำนวนเงิน</th>
                  <th className="py-2 pr-4 font-medium">วันครบกำหนด</th>
                  <th className="py-2 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {[...milestones.overdue, ...milestones.dueSoon].map((m) => {
                  const isOverdue = milestones.overdue.some((o) => o.id === m.id);
                  return (
                    <tr key={m.id} className="border-b border-gray-50">
                      <td className="py-2 pr-4">{m.costCenterName}</td>
                      <td className="py-2 pr-4">{m.name}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatThb(m.amount)}</td>
                      <td className="py-2 pr-4">{m.plannedDate ? formatDate(m.plannedDate) : '-'}</td>
                      <td className={`py-2 ${isOverdue ? 'text-[#d03b3b]' : 'text-[#B8860B]'}`}>
                        {isOverdue ? 'เลยกำหนด' : 'ใกล้ครบกำหนด'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
