'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { BoqTemplateApplyResult, BoqTemplatePreview, BoqTemplateSummary, CostCenter } from '@/lib/types';
import { formatThb } from '@/lib/format';
import { card, input, label, primaryButton, secondaryButton, errorBanner } from '@/lib/ui';

export default function BoqTemplatesPage() {
  const { token, user } = useAuth();
  const canApply =
    user?.role === 'PROJECT_MANAGER' ||
    user?.role === 'ACCOUNTANT' ||
    user?.role === 'CFO' ||
    user?.role === 'CEO';

  const [templates, setTemplates] = useState<BoqTemplateSummary[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targetAreaSqm, setTargetAreaSqm] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<BoqTemplatePreview | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<BoqTemplateApplyResult | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([api.get<BoqTemplateSummary[]>('/boq-templates', token), api.get<CostCenter[]>('/cost-centers', token)])
      .then(([t, cc]) => {
        setTemplates(t);
        setCostCenters(cc);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'โหลดเทมเพลตไม่สำเร็จ'));
  }, [token]);

  function selectTemplate(t: BoqTemplateSummary) {
    setSelectedId(t.id);
    setTargetAreaSqm(String(t.baseAreaSqm));
    setPreview(null);
    setApplyResult(null);
    setError(null);
  }

  async function handlePreview() {
    if (!token || !selectedId || !targetAreaSqm) return;
    setPreviewing(true);
    setError(null);
    setApplyResult(null);
    try {
      const res = await api.get<BoqTemplatePreview>(
        `/boq-templates/${selectedId}/preview?targetAreaSqm=${encodeURIComponent(targetAreaSqm)}`,
        token,
      );
      setPreview(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'คำนวณตัวอย่าง BOQ ไม่สำเร็จ');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleApply() {
    if (!token || !selectedId || !targetAreaSqm || !costCenterId) return;
    setApplying(true);
    setError(null);
    try {
      const res = await api.post<BoqTemplateApplyResult>(
        `/boq-templates/${selectedId}/apply`,
        { costCenterId, targetAreaSqm: Number(targetAreaSqm) },
        token,
      );
      setApplyResult(res);
      setPreview(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'สร้างรายการ BOQ ไม่สำเร็จ');
    } finally {
      setApplying(false);
    }
  }

  const selectedTemplate = templates.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">เทมเพลต BOQ มาตรฐาน</h1>
        <p className="text-sm text-gray-500">
          เลือกเทมเพลตอ้างอิงจากงานก่อสร้างจริง แล้วระบุพื้นที่ใช้สอยของบ้านหลังใหม่ ระบบจะคำนวณปริมาณวัสดุ/ค่าแรง
          และราคาโดยประมาณให้อัตโนมัติตามสัดส่วนพื้นที่ ก่อนสร้างเป็นรายการ BOQ จริงใน Cost Center ที่เลือก
        </p>
      </div>

      {error && <p className={errorBanner}>{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTemplate(t)}
            className={`${card} text-left transition ${selectedId === t.id ? 'ring-2 ring-[#1B5E3A]' : ''}`}
          >
            <p className="font-medium text-gray-900">{t.name}</p>
            <p className="mt-1 text-xs text-gray-500">{t.description}</p>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-gray-500">
                พื้นที่อ้างอิง {t.baseAreaSqm} ตร.ม. · {t.itemCount} รายการ
              </span>
              <span className="font-semibold text-gray-900">{formatThb(t.totalAmount)}</span>
            </div>
          </button>
        ))}
      </div>

      {selectedTemplate && (
        <div className={`${card} space-y-4`}>
          <p className="text-sm font-medium text-gray-700">
            สรุปตามหมวดงาน (ที่พื้นที่อ้างอิง {selectedTemplate.baseAreaSqm} ตร.ม.)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="py-2 pr-4 font-medium">หมวดงาน</th>
                  <th className="py-2 pr-4 text-right font-medium">มูลค่า</th>
                </tr>
              </thead>
              <tbody>
                {selectedTemplate.categorySubtotals.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 pr-4">{c.category}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatThb(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className={label}>พื้นที่ใช้สอยที่ต้องการ (ตร.ม.)</label>
              <input
                type="number"
                min="1"
                step="0.1"
                value={targetAreaSqm}
                onChange={(e) => setTargetAreaSqm(e.target.value)}
                className={input}
              />
            </div>
            <div className="md:col-span-2 flex items-end">
              <button
                type="button"
                disabled={!targetAreaSqm || previewing}
                onClick={handlePreview}
                className={secondaryButton}
              >
                {previewing ? 'กำลังคำนวณ...' : 'คำนวณ BOQ ตามพื้นที่'}
              </button>
            </div>
          </div>

          {preview && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-600">
                อัตราส่วนพื้นที่ {preview.scaleRatio}× (จาก {preview.baseAreaSqm} เป็น {preview.targetAreaSqm} ตร.ม.)
                — มูลค่ารวมโดยประมาณ <span className="font-semibold text-gray-900">{formatThb(preview.totalAmount)}</span>
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500">
                      <th className="py-2 pr-4 font-medium">หมวดงาน</th>
                      <th className="py-2 pr-4 text-right font-medium">มูลค่า (หลังปรับตามพื้นที่)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.categorySubtotals.map((c, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-2 pr-4">{c.category}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{formatThb(c.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {canApply ? (
                <div className="grid gap-3 border-t border-gray-100 pt-4 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <label className={label}>สร้างเป็นรายการ BOQ ใน Cost Center</label>
                    <select
                      value={costCenterId}
                      onChange={(e) => setCostCenterId(e.target.value)}
                      className={input}
                    >
                      <option value="">-- เลือก Cost Center --</option>
                      {costCenters.map((cc) => (
                        <option key={cc.id} value={cc.id}>
                          {cc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={!costCenterId || applying}
                      onClick={handleApply}
                      className={primaryButton}
                    >
                      {applying ? 'กำลังสร้าง...' : `สร้าง BOQ ${preview.items.length} รายการ`}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 md:col-span-3">
                    รายการที่สร้างจะไปแสดงในหน้า &quot;วัสดุก่อสร้าง / สต๊อก&quot; ของ Cost Center ที่เลือก
                    สามารถแก้ไขปริมาณ/ราคาเป็นรายตัวได้ภายหลัง (เป็นค่าประมาณจากสัดส่วนพื้นที่ ไม่ใช่ใบเสนอราคาจริง)
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-400">เฉพาะผู้จัดการโครงการ/ฝ่ายบัญชี/CFO/CEO เท่านั้นที่สร้างรายการ BOQ จริงได้</p>
              )}
            </div>
          )}
        </div>
      )}

      {applyResult && (
        <div className={`${card} space-y-1`}>
          <p className="text-sm font-medium text-[#1B5E3A]">
            สร้างรายการ BOQ สำเร็จ {applyResult.createdCount} รายการ
          </p>
          <p className="text-xs text-gray-500">มูลค่ารวมโดยประมาณ {formatThb(applyResult.totalAmount)}</p>
        </div>
      )}
    </div>
  );
}
