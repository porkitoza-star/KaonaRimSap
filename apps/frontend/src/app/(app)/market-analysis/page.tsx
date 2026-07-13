'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { CostCenter, GenerateInsightsResult, MarketComparable } from '@/lib/types';
import { formatDate, formatThb } from '@/lib/format';
import { card, input, label, primaryButton, goldAccentButton, dangerButton, secondaryButton, errorBanner } from '@/lib/ui';

const CAN_MANAGE_ROLES = ['PROJECT_MANAGER', 'ACCOUNTANT', 'CFO', 'CEO'];

interface ComparableFormState {
  projectName: string;
  developerName: string;
  location: string;
  distanceKm: string;
  houseType: string;
  usableAreaSqm: string;
  priceMin: string;
  priceMax: string;
  unitsTotal: string;
  unitsSold: string;
  launchDate: string;
  promotion: string;
  notes: string;
}

const EMPTY_FORM: ComparableFormState = {
  projectName: '',
  developerName: '',
  location: '',
  distanceKm: '',
  houseType: '',
  usableAreaSqm: '',
  priceMin: '',
  priceMax: '',
  unitsTotal: '',
  unitsSold: '',
  launchDate: '',
  promotion: '',
  notes: '',
};

function toPayload(f: ComparableFormState) {
  return {
    projectName: f.projectName,
    developerName: f.developerName || undefined,
    location: f.location,
    distanceKm: f.distanceKm ? Number(f.distanceKm) : undefined,
    houseType: f.houseType || undefined,
    usableAreaSqm: f.usableAreaSqm ? Number(f.usableAreaSqm) : undefined,
    priceMin: Number(f.priceMin) || 0,
    priceMax: Number(f.priceMax) || 0,
    unitsTotal: f.unitsTotal ? Number(f.unitsTotal) : undefined,
    unitsSold: f.unitsSold ? Number(f.unitsSold) : undefined,
    launchDate: f.launchDate || undefined,
    promotion: f.promotion || undefined,
    notes: f.notes || undefined,
  };
}

export default function MarketAnalysisPage() {
  const { token, user } = useAuth();
  const canManage = !!user && CAN_MANAGE_ROLES.includes(user.role);

  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [costCenterId, setCostCenterId] = useState('');
  const [comparables, setComparables] = useState<MarketComparable[]>([]);
  const [result, setResult] = useState<GenerateInsightsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<ComparableFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [ownPricePerSqm, setOwnPricePerSqm] = useState('');
  const [ownPromotion, setOwnPromotion] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .get<CostCenter[]>('/cost-centers', token)
      .then(setCostCenters)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'โหลด Cost Center ไม่สำเร็จ'));
  }, [token]);

  useEffect(() => {
    if (!token || !costCenterId) {
      setComparables([]);
      setResult(null);
      return;
    }
    setError(null);
    api
      .get<MarketComparable[]>(`/market-analysis/comparables?costCenterId=${costCenterId}`, token)
      .then(setComparables)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'โหลดข้อมูลคู่แข่งไม่สำเร็จ'));
    api
      .get<GenerateInsightsResult['report'] | null>(`/market-analysis/${costCenterId}/report`, token)
      .then((report) => {
        if (report) {
          setResult({ report, metrics: result?.metrics ?? emptyMetrics() });
          if (report.ownPricePerSqm) setOwnPricePerSqm(String(report.ownPricePerSqm));
          if (report.ownPromotion) setOwnPromotion(report.ownPromotion);
        } else {
          setResult(null);
        }
      })
      .catch(() => {
        // no report yet is fine
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, costCenterId]);

  function emptyMetrics() {
    return {
      competitorCount: 0,
      avgPricePerSqm: null,
      minPricePerSqm: null,
      maxPricePerSqm: null,
      priceSpreadPercent: null,
      avgMonthlyAbsorptionPercent: null,
    };
  }

  function startEdit(c: MarketComparable) {
    setEditingId(c.id);
    setForm({
      projectName: c.projectName,
      developerName: c.developerName ?? '',
      location: c.location,
      distanceKm: c.distanceKm !== null ? String(c.distanceKm) : '',
      houseType: c.houseType ?? '',
      usableAreaSqm: c.usableAreaSqm !== null ? String(c.usableAreaSqm) : '',
      priceMin: String(c.priceMin),
      priceMax: String(c.priceMax),
      unitsTotal: c.unitsTotal !== null ? String(c.unitsTotal) : '',
      unitsSold: c.unitsSold !== null ? String(c.unitsSold) : '',
      launchDate: c.launchDate ? c.launchDate.slice(0, 10) : '',
      promotion: c.promotion ?? '',
      notes: c.notes ?? '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    if (!token || !costCenterId || !form.projectName || !form.location) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { ...toPayload(form), costCenterId };
      if (editingId) {
        const updated = await api.put<MarketComparable>(`/market-analysis/comparables/${editingId}`, payload, token);
        setComparables((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
      } else {
        const created = await api.post<MarketComparable>('/market-analysis/comparables', payload, token);
        setComparables((prev) => [...prev, created]);
      }
      cancelEdit();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'บันทึกข้อมูลคู่แข่งไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    setError(null);
    try {
      await api.delete(`/market-analysis/comparables/${id}`, token);
      setComparables((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ลบข้อมูลคู่แข่งไม่สำเร็จ');
    }
  }

  async function handleAnalyze() {
    if (!token || !costCenterId) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await api.post<GenerateInsightsResult>(
        `/market-analysis/${costCenterId}/generate-insights`,
        {
          ownPricePerSqm: ownPricePerSqm ? Number(ownPricePerSqm) : undefined,
          ownPromotion: ownPromotion || undefined,
        },
        token,
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'วิเคราะห์ตลาดไม่สำเร็จ');
    } finally {
      setAnalyzing(false);
    }
  }

  const positioning = result?.report.positioning;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">วิจัยและวิเคราะห์ตลาด (Market Intelligence)</h1>
        <p className="text-sm text-gray-500">
          เก็บข้อมูลโครงการคู่แข่งในทำเลเดียวกัน แล้วให้ AI วิเคราะห์ทำเล ราคา โปรโมชั่น และอัตราการขาย
          เพื่อประเมินว่าตลาดนี้เป็น Red Ocean (แข่งขันดุเดือด) หรือ Blue Ocean (มีช่องว่างที่แตกต่าง)
        </p>
      </div>

      {error && <p className={errorBanner}>{error}</p>}

      <div className={`${card} space-y-3`}>
        <div>
          <label className={label}>เลือกโครงการ (Cost Center)</label>
          <select value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)} className={input}>
            <option value="">-- เลือก Cost Center --</option>
            {costCenters.map((cc) => (
              <option key={cc.id} value={cc.id}>
                {cc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {costCenterId && (
        <>
          <div className={`${card} space-y-4`}>
            <p className="text-sm font-medium text-gray-700">โครงการคู่แข่งในพื้นที่ ({comparables.length})</p>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="whitespace-nowrap py-2 pr-4 font-medium">โครงการ</th>
                    <th className="whitespace-nowrap py-2 pr-4 font-medium">ทำเล</th>
                    <th className="whitespace-nowrap py-2 pr-4 font-medium">ประเภท</th>
                    <th className="whitespace-nowrap py-2 pr-4 text-right font-medium">ราคา (บาท)</th>
                    <th className="whitespace-nowrap py-2 pr-4 text-right font-medium">ขายแล้ว</th>
                    <th className="whitespace-nowrap py-2 pr-4 font-medium">โปรโมชั่น</th>
                    <th className="whitespace-nowrap py-2 pr-4 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {comparables.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50">
                      <td className="whitespace-nowrap py-2 pr-4">
                        <p className="font-medium text-gray-900">{c.projectName}</p>
                        {c.developerName && <p className="text-xs text-gray-400">{c.developerName}</p>}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4">
                        {c.location}
                        {c.distanceKm !== null && <span className="text-gray-400"> ({c.distanceKm} กม.)</span>}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4">{c.houseType ?? '-'}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums">
                        {formatThb(c.priceMin)} - {formatThb(c.priceMax)}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums">
                        {c.unitsTotal ? `${c.unitsSold ?? 0}/${c.unitsTotal}` : '-'}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4">{c.promotion ?? '-'}</td>
                      <td className="whitespace-nowrap py-2 pr-4">
                        {canManage && (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => startEdit(c)} className="text-xs text-[#1B5E3A] hover:underline">
                              แก้ไข
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(c.id)}
                              className="text-xs text-[#d03b3b] hover:underline"
                            >
                              ลบ
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {comparables.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-sm text-gray-400">
                        ยังไม่มีข้อมูลคู่แข่ง — เพิ่มโครงการคู่แข่งด้านล่างเพื่อเริ่มวิเคราะห์
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {canManage && (
              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700">
                  {editingId ? 'แก้ไขโครงการคู่แข่ง' : 'เพิ่มโครงการคู่แข่ง'}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                  <div>
                    <label className={label}>ชื่อโครงการ</label>
                    <input
                      value={form.projectName}
                      onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>ผู้พัฒนา</label>
                    <input
                      value={form.developerName}
                      onChange={(e) => setForm({ ...form, developerName: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>ทำเล</label>
                    <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={input} />
                  </div>
                  <div>
                    <label className={label}>ระยะห่างจากโครงการเรา (กม.)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.distanceKm}
                      onChange={(e) => setForm({ ...form, distanceKm: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>ประเภทบ้าน</label>
                    <input
                      value={form.houseType}
                      onChange={(e) => setForm({ ...form, houseType: e.target.value })}
                      className={input}
                      placeholder="เช่น บ้านเดี่ยว 2 ชั้น"
                    />
                  </div>
                  <div>
                    <label className={label}>พื้นที่ใช้สอย (ตร.ม.)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.usableAreaSqm}
                      onChange={(e) => setForm({ ...form, usableAreaSqm: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>ราคาต่ำสุด (บาท)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.priceMin}
                      onChange={(e) => setForm({ ...form, priceMin: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>ราคาสูงสุด (บาท)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.priceMax}
                      onChange={(e) => setForm({ ...form, priceMax: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>จำนวนยูนิตทั้งหมด</label>
                    <input
                      type="number"
                      min="0"
                      value={form.unitsTotal}
                      onChange={(e) => setForm({ ...form, unitsTotal: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>ขายไปแล้ว (ยูนิต)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.unitsSold}
                      onChange={(e) => setForm({ ...form, unitsSold: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>วันที่เปิดตัวโครงการ</label>
                    <input
                      type="date"
                      value={form.launchDate}
                      onChange={(e) => setForm({ ...form, launchDate: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>โปรโมชั่น</label>
                    <input
                      value={form.promotion}
                      onChange={(e) => setForm({ ...form, promotion: e.target.value })}
                      className={input}
                      placeholder="เช่น ฟรีเฟอร์ ผ่อนดาวน์ 0%"
                    />
                  </div>
                  <div className="sm:col-span-2 md:col-span-4">
                    <label className={label}>หมายเหตุ</label>
                    <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={input} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving || !form.projectName || !form.location || !form.priceMin || !form.priceMax}
                    onClick={handleSave}
                    className={primaryButton}
                  >
                    {saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มโครงการคู่แข่ง'}
                  </button>
                  {editingId && (
                    <button type="button" onClick={cancelEdit} className={secondaryButton}>
                      ยกเลิก
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {canManage && (
            <div className={`${card} space-y-3`}>
              <p className="text-sm font-medium text-gray-700">ข้อมูลโครงการของเรา</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={label}>ราคาของเรา (บาท/ตร.ม.)</label>
                  <input
                    type="number"
                    min="0"
                    value={ownPricePerSqm}
                    onChange={(e) => setOwnPricePerSqm(e.target.value)}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>โปรโมชั่นของเรา</label>
                  <input value={ownPromotion} onChange={(e) => setOwnPromotion(e.target.value)} className={input} />
                </div>
              </div>
              <button
                type="button"
                disabled={analyzing || comparables.length === 0}
                onClick={handleAnalyze}
                className={goldAccentButton}
              >
                {analyzing ? 'กำลังวิเคราะห์ด้วย AI...' : '🧠 วิเคราะห์ตลาดด้วย AI'}
              </button>
              {comparables.length === 0 && (
                <p className="text-xs text-gray-400">ต้องเพิ่มข้อมูลคู่แข่งอย่างน้อย 1 รายการก่อนจึงจะวิเคราะห์ได้</p>
              )}
            </div>
          )}

          {result && (
            <>
              <div className={`${card} space-y-3`}>
                <p className="text-sm font-medium text-gray-700">สรุปตัวเลขการตลาด</p>
                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-gray-500">จำนวนคู่แข่ง</p>
                    <p className="font-semibold">{result.metrics.competitorCount} โครงการ</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">ราคาเฉลี่ย/ตร.ม.</p>
                    <p className="font-semibold">
                      {result.metrics.avgPricePerSqm !== null ? formatThb(result.metrics.avgPricePerSqm) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">ช่วงราคา/ตร.ม.</p>
                    <p className="font-semibold">
                      {result.metrics.minPricePerSqm !== null && result.metrics.maxPricePerSqm !== null
                        ? `${formatThb(result.metrics.minPricePerSqm)} - ${formatThb(result.metrics.maxPricePerSqm)}`
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">ส่วนกระจายราคา</p>
                    <p className="font-semibold">
                      {result.metrics.priceSpreadPercent !== null ? `${result.metrics.priceSpreadPercent}%` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">อัตราการขายเฉลี่ย/เดือน</p>
                    <p className="font-semibold">
                      {result.metrics.avgMonthlyAbsorptionPercent !== null
                        ? `${result.metrics.avgMonthlyAbsorptionPercent}%`
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={`rounded-2xl p-5 shadow-sm ring-1 ${
                  positioning === 'BLUE_OCEAN'
                    ? 'bg-gradient-to-br from-sky-50 to-blue-100 ring-blue-200'
                    : positioning === 'RED_OCEAN'
                      ? 'bg-gradient-to-br from-red-50 to-rose-100 ring-red-200'
                      : 'bg-white ring-gray-100'
                } space-y-3`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
                      positioning === 'BLUE_OCEAN'
                        ? 'bg-blue-600 text-white'
                        : positioning === 'RED_OCEAN'
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {positioning === 'BLUE_OCEAN' ? '🌊 Blue Ocean' : positioning === 'RED_OCEAN' ? '🔴 Red Ocean' : 'ยังไม่วิเคราะห์'}
                  </span>
                  {result.report.positioningScore !== null && (
                    <span className="text-sm text-gray-600">คะแนนความแตกต่าง: {result.report.positioningScore}/100</span>
                  )}
                  {result.report.generatedAt && (
                    <span className="text-xs text-gray-400">วิเคราะห์เมื่อ {formatDate(result.report.generatedAt)}</span>
                  )}
                </div>
                {result.report.summary && <p className="whitespace-pre-line text-sm text-gray-800">{result.report.summary}</p>}
                {result.report.recommendations && (
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-700">ข้อเสนอแนะเชิงกลยุทธ์</p>
                    <p className="whitespace-pre-line text-sm text-gray-800">{result.report.recommendations}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
