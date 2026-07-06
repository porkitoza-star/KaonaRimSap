'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { formatThb } from '@/lib/format';
import { StatTile } from '@/components/stat-tile';
import { AgingBarChart } from '@/components/aging-bar-chart';

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

export default function DashboardPage() {
  const { token } = useAuth();
  const [cash, setCash] = useState<CashBalance | null>(null);
  const [arAging, setArAging] = useState<AgingResponse | null>(null);
  const [apAging, setApAging] = useState<AgingResponse | null>(null);
  const [pnl, setPnl] = useState<PnlRow[] | null>(null);
  const [forecast, setForecast] = useState<CashFlowForecast | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.get<CashBalance>('/dashboard/cash-balance', token),
      api.get<AgingResponse>('/dashboard/ar-aging', token),
      api.get<AgingResponse>('/dashboard/ap-aging', token),
      api.get<PnlRow[]>('/dashboard/pnl-by-cost-center', token),
      api.get<CashFlowForecast>('/dashboard/cash-flow-forecast', token),
    ])
      .then(([cashRes, arRes, apRes, pnlRes, forecastRes]) => {
        setCash(cashRes);
        setArAging(arRes);
        setApAging(apRes);
        setPnl(pnlRes);
        setForecast(forecastRes);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'โหลดข้อมูลแดชบอร์ดไม่สำเร็จ');
      });
  }, [token]);

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
    </div>
  );
}
