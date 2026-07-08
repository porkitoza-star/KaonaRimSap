'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type {
  ConstructionPhase,
  ConstructionPhasesResponse,
  CostCenter,
  HouseTemplateType,
  ProjectFeasibility,
} from '@/lib/types';
import { formatDate, formatThb } from '@/lib/format';
import { card, input, label, primaryButton, secondaryButton, errorBanner } from '@/lib/ui';

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

function PhaseTimelineBar({ phase, rangeStart, rangeEnd }: { phase: ConstructionPhase; rangeStart: number; rangeEnd: number }) {
  const totalMs = Math.max(rangeEnd - rangeStart, 1);
  const pct = (ms: number) => Math.max(0, Math.min(100, ((ms - rangeStart) / totalMs) * 100));

  const plannedStart = phase.plannedStartDate ? new Date(phase.plannedStartDate).getTime() : null;
  const plannedEnd = phase.plannedEndDate ? new Date(phase.plannedEndDate).getTime() : null;
  const actualStart = phase.actualStartDate ? new Date(phase.actualStartDate).getTime() : null;
  const actualEnd = phase.actualEndDate
    ? new Date(phase.actualEndDate).getTime()
    : actualStart
      ? Date.now()
      : null;

  return (
    <div className="relative h-6 w-full rounded bg-gray-50">
      {plannedStart !== null && plannedEnd !== null && (
        <div
          className="absolute top-0.5 h-2 rounded-full border border-gray-300"
          style={{ left: `${pct(plannedStart)}%`, width: `${pct(plannedEnd) - pct(plannedStart)}%` }}
          title="แผน"
        />
      )}
      {actualStart !== null && actualEnd !== null && (
        <div
          className={`absolute top-3 h-2 rounded-full ${phase.percentComplete >= 100 ? 'bg-[#1B5E3A]' : 'bg-[#B8860B]'}`}
          style={{ left: `${pct(actualStart)}%`, width: `${Math.max(pct(actualEnd) - pct(actualStart), 1)}%` }}
          title={`จริง (${phase.percentComplete}%)`}
        />
      )}
    </div>
  );
}

export default function ConstructionPage() {
  const { token, user } = useAuth();
  const canManage =
    user?.role === 'PROJECT_MANAGER' ||
    user?.role === 'ACCOUNTANT' ||
    user?.role === 'CFO' ||
    user?.role === 'CEO';

  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [phasesData, setPhasesData] = useState<ConstructionPhasesResponse | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [feasibility, setFeasibility] = useState<ProjectFeasibility | null>(null);
  const [feasibilityForm, setFeasibilityForm] = useState({
    houseCount: '1',
    constructionCostPerUnit: '0',
    landCostPerUnit: '0',
    otherCostPerUnit: '0',
    sellingPricePerUnit: '0',
  });
  const [feasibilitySaving, setFeasibilitySaving] = useState(false);

  const selected = costCenters.find((c) => c.id === selectedId);

  useEffect(() => {
    if (!token) return;
    api
      .get<CostCenter[]>('/cost-centers', token)
      .then(setCostCenters)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'โหลด Cost Center ไม่สำเร็จ'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadPhases(costCenterId: string) {
    if (!token) return;
    try {
      setPhasesData(await api.get<ConstructionPhasesResponse>(`/construction-phases?costCenterId=${costCenterId}`, token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดขั้นตอนงานไม่สำเร็จ');
    }
  }

  async function loadFeasibility(costCenterId: string) {
    if (!token) return;
    try {
      const data = await api.get<ProjectFeasibility | null>(`/feasibility/${costCenterId}`, token);
      setFeasibility(data);
      if (data) {
        setFeasibilityForm({
          houseCount: String(data.houseCount),
          constructionCostPerUnit: String(data.constructionCostPerUnit),
          landCostPerUnit: String(data.landCostPerUnit),
          otherCostPerUnit: String(data.otherCostPerUnit),
          sellingPricePerUnit: String(data.sellingPricePerUnit),
        });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดข้อมูล Feasibility ไม่สำเร็จ');
    }
  }

  useEffect(() => {
    if (!selectedId) {
      setPhasesData(null);
      setFeasibility(null);
      return;
    }
    if (selected?.type === 'HOUSE') {
      loadPhases(selectedId);
    } else if (selected?.type === 'PROJECT') {
      loadFeasibility(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function handleSeed(houseType: HouseTemplateType) {
    if (!token || !selectedId) return;
    setSeeding(true);
    setError(null);
    try {
      await api.post('/construction-phases/seed-template', { costCenterId: selectedId, houseType }, token);
      await loadPhases(selectedId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'สร้างขั้นตอนงานจากเทมเพลตไม่สำเร็จ');
    } finally {
      setSeeding(false);
    }
  }

  function startEdit(phase: ConstructionPhase) {
    setEditingId(phase.id);
    setEditDraft({
      plannedStartDate: toDateInput(phase.plannedStartDate),
      plannedEndDate: toDateInput(phase.plannedEndDate),
      actualStartDate: toDateInput(phase.actualStartDate),
      actualEndDate: toDateInput(phase.actualEndDate),
      percentComplete: String(phase.percentComplete),
    });
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!token || !editingId) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(
        `/construction-phases/${editingId}`,
        {
          plannedStartDate: editDraft.plannedStartDate || undefined,
          plannedEndDate: editDraft.plannedEndDate || undefined,
          actualStartDate: editDraft.actualStartDate || undefined,
          actualEndDate: editDraft.actualEndDate || undefined,
          percentComplete: Number(editDraft.percentComplete),
        },
        token,
      );
      setEditingId(null);
      await loadPhases(selectedId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'บันทึกความคืบหน้าไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  const range = useMemo(() => {
    if (!phasesData) return null;
    const dates: number[] = [];
    for (const p of phasesData.phases) {
      for (const d of [p.plannedStartDate, p.plannedEndDate, p.actualStartDate, p.actualEndDate]) {
        if (d) dates.push(new Date(d).getTime());
      }
    }
    if (dates.length === 0) return null;
    return { start: Math.min(...dates), end: Math.max(Math.max(...dates), Date.now()) };
  }, [phasesData]);

  async function handleFeasibilitySave(e: FormEvent) {
    e.preventDefault();
    if (!token || !selectedId) return;
    setFeasibilitySaving(true);
    setError(null);
    try {
      const saved = await api.put<ProjectFeasibility>(
        `/feasibility/${selectedId}`,
        {
          houseCount: Number(feasibilityForm.houseCount),
          constructionCostPerUnit: Number(feasibilityForm.constructionCostPerUnit),
          landCostPerUnit: Number(feasibilityForm.landCostPerUnit),
          otherCostPerUnit: Number(feasibilityForm.otherCostPerUnit),
          sellingPricePerUnit: Number(feasibilityForm.sellingPricePerUnit),
        },
        token,
      );
      setFeasibility(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'บันทึก Feasibility ไม่สำเร็จ');
    } finally {
      setFeasibilitySaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">ขั้นตอนงานก่อสร้าง / Timeline / Feasibility</h1>
        <p className="text-sm text-gray-500">
          เลือก Cost Center: เลือก &quot;บ้าน&quot; เพื่อดู/บันทึกขั้นตอนงานและ Timeline หรือเลือก
          &quot;โครงการ&quot; เพื่อคำนวณ Feasibility
        </p>
        <p className="mt-1 text-xs text-gray-400">
          เทมเพลตขั้นตอนงานเป็น <b>ตัวอย่างทั่วไป</b> (ชื่อและลำดับขั้นตอนเท่านั้น ไม่มีระยะเวลา/ต้นทุนมาตรฐาน) —
          ปรับแก้วันที่และเพิ่ม/ลบขั้นตอนได้ตามความจริงของแต่ละโครงการ
        </p>
      </div>

      {error && <p className={errorBanner}>{error}</p>}

      <div className={card}>
        <label className={label}>Cost Center</label>
        <select className={input} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">-- เลือก Cost Center --</option>
          {costCenters
            .filter((c) => c.type === 'HOUSE' || c.type === 'PROJECT')
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type === 'HOUSE' ? 'บ้าน' : 'โครงการ'})
              </option>
            ))}
        </select>
      </div>

      {selected?.type === 'HOUSE' && phasesData && phasesData.phases.length === 0 && canManage && (
        <div className={card}>
          <p className="text-sm text-gray-700">ยังไม่มีขั้นตอนงานสำหรับบ้านนี้ เริ่มจากเทมเพลต:</p>
          <div className="mt-3 flex gap-2">
            <button disabled={seeding} onClick={() => handleSeed('SINGLE_STORY')} className={primaryButton}>
              บ้านชั้นเดียว
            </button>
            <button disabled={seeding} onClick={() => handleSeed('TWO_STORY')} className={primaryButton}>
              บ้านสองชั้น
            </button>
          </div>
        </div>
      )}

      {selected?.type === 'HOUSE' && phasesData && phasesData.phases.length > 0 && (
        <>
          <div className={`${card} grid grid-cols-2 gap-4 sm:grid-cols-4`}>
            <div>
              <p className="text-xs text-gray-500">ความคืบหน้ารวม</p>
              <p className="text-lg font-semibold text-[#1B5E3A]">{phasesData.summary.overallPercent}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">สถานะ</p>
              <p className="text-lg font-semibold">
                {phasesData.summary.allComplete ? 'เสร็จสมบูรณ์' : 'กำลังดำเนินการ'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Lead Time (จริง)</p>
              <p className="text-lg font-semibold">
                {phasesData.summary.leadTimeDays !== null ? `${phasesData.summary.leadTimeDays} วัน` : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Lead Time (แผน)</p>
              <p className="text-lg font-semibold">
                {phasesData.summary.plannedLeadTimeDays !== null
                  ? `${phasesData.summary.plannedLeadTimeDays} วัน`
                  : '-'}
              </p>
            </div>
          </div>

          <div className={card}>
            <div className="mb-3 flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-4 rounded-full border border-gray-300" /> แผน
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-4 rounded-full bg-[#B8860B]" /> จริง (กำลังทำ)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-4 rounded-full bg-[#1B5E3A]" /> จริง (เสร็จ)
              </span>
              {range && (
                <span className="ml-auto">
                  {formatDate(new Date(range.start))} - {formatDate(new Date(range.end))}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {phasesData.phases.map((phase) => (
                <div key={phase.id} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[200px_1fr_auto]">
                  <div className="text-xs text-gray-700">
                    <span className="text-gray-400">{phase.sequence}.</span> {phase.name}
                  </div>
                  {range ? (
                    <PhaseTimelineBar phase={phase} rangeStart={range.start} rangeEnd={range.end} />
                  ) : (
                    <div />
                  )}
                  {canManage && (
                    <button
                      onClick={() => startEdit(phase)}
                      className={`${secondaryButton} px-2 py-1 text-xs`}
                    >
                      แก้ไข
                    </button>
                  )}
                </div>
              ))}
            </div>

            {editingId && (
              <form onSubmit={saveEdit} className="mt-4 grid grid-cols-1 gap-2 border-t border-gray-100 pt-4 sm:grid-cols-6">
                <div>
                  <label className={label}>แผนเริ่ม</label>
                  <input
                    type="date"
                    className={input}
                    value={editDraft.plannedStartDate}
                    onChange={(e) => setEditDraft((d) => ({ ...d, plannedStartDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={label}>แผนจบ</label>
                  <input
                    type="date"
                    className={input}
                    value={editDraft.plannedEndDate}
                    onChange={(e) => setEditDraft((d) => ({ ...d, plannedEndDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={label}>จริงเริ่ม</label>
                  <input
                    type="date"
                    className={input}
                    value={editDraft.actualStartDate}
                    onChange={(e) => setEditDraft((d) => ({ ...d, actualStartDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={label}>จริงจบ</label>
                  <input
                    type="date"
                    className={input}
                    value={editDraft.actualEndDate}
                    onChange={(e) => setEditDraft((d) => ({ ...d, actualEndDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={label}>% เสร็จ</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className={input}
                    value={editDraft.percentComplete}
                    onChange={(e) => setEditDraft((d) => ({ ...d, percentComplete: e.target.value }))}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button type="submit" disabled={saving} className={primaryButton}>
                    บันทึก
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className={secondaryButton}>
                    ยกเลิก
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}

      {selected?.type === 'PROJECT' && (
        <div className={card}>
          <h2 className="text-sm font-semibold text-gray-900">Feasibility — ประเมินความคุ้มค่าโครงการ</h2>
          <p className="mt-1 text-xs text-gray-400">
            กรอกสมมติฐานต้นทุน/ราคาขายต่อหลังเอง (ระบบไม่มีค่ามาตรฐานในตัว) เพื่อคำนวณกำไรและ Margin ของทั้งโครงการ
          </p>
          <form onSubmit={handleFeasibilitySave} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={label}>จำนวนบ้าน (หลัง)</label>
              <input
                type="number"
                min="1"
                max="8"
                className={input}
                value={feasibilityForm.houseCount}
                onChange={(e) => setFeasibilityForm((f) => ({ ...f, houseCount: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className={label}>ต้นทุนก่อสร้างต่อหลัง (บาท)</label>
              <input
                type="number"
                min="0"
                className={input}
                value={feasibilityForm.constructionCostPerUnit}
                onChange={(e) => setFeasibilityForm((f) => ({ ...f, constructionCostPerUnit: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className={label}>ต้นทุนที่ดินต่อหลัง (บาท)</label>
              <input
                type="number"
                min="0"
                className={input}
                value={feasibilityForm.landCostPerUnit}
                onChange={(e) => setFeasibilityForm((f) => ({ ...f, landCostPerUnit: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className={label}>ต้นทุนอื่นต่อหลัง (บาท)</label>
              <input
                type="number"
                min="0"
                className={input}
                value={feasibilityForm.otherCostPerUnit}
                onChange={(e) => setFeasibilityForm((f) => ({ ...f, otherCostPerUnit: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className={label}>ราคาขายต่อหลัง (บาท)</label>
              <input
                type="number"
                min="0"
                className={input}
                value={feasibilityForm.sellingPricePerUnit}
                onChange={(e) => setFeasibilityForm((f) => ({ ...f, sellingPricePerUnit: e.target.value }))}
                required
              />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={feasibilitySaving} className={primaryButton}>
                {feasibilitySaving ? 'กำลังคำนวณ...' : 'คำนวณ / บันทึก'}
              </button>
            </div>
          </form>

          {feasibility && (
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-gray-500">ต้นทุนต่อหลัง</p>
                <p className="text-base font-semibold">{formatThb(feasibility.costPerUnit)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">กำไรต่อหลัง</p>
                <p className="text-base font-semibold text-[#1B5E3A]">{formatThb(feasibility.profitPerUnit)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Margin</p>
                <p className="text-base font-semibold">{feasibility.marginPercent}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">จำนวนบ้าน</p>
                <p className="text-base font-semibold">{feasibility.houseCount} หลัง</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">ต้นทุนรวมทั้งโครงการ</p>
                <p className="text-base font-semibold">{formatThb(feasibility.totalCost)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">รายได้รวมทั้งโครงการ</p>
                <p className="text-base font-semibold">{formatThb(feasibility.totalRevenue)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">กำไรรวมทั้งโครงการ</p>
                <p className="text-base font-semibold text-[#1B5E3A]">{formatThb(feasibility.totalProfit)}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
