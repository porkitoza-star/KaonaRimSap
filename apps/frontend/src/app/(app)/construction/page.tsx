'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type {
  ConstructionPhase,
  ConstructionPhasesResponse,
  CostCenter,
  HouseTemplateType,
  PaymentMilestone,
  PaymentMilestonesResponse,
  ProjectFeasibility,
  ValueCurvePoint,
} from '@/lib/types';
import { formatDate, formatThb } from '@/lib/format';
import { badge, card, input, label, primaryButton, secondaryButton, errorBanner } from '@/lib/ui';

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

function formatMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit' }).format(new Date(y, m - 1, 1));
}

function valueAtMonth(curve: ValueCurvePoint[], month: string): number {
  let val = 0;
  for (const p of curve) {
    if (p.month <= month) val = p.cumulativePercent;
    else break;
  }
  return val;
}

function SCurveChart({
  monthlyPlan,
  monthlyActual,
}: {
  monthlyPlan: ValueCurvePoint[];
  monthlyActual: ValueCurvePoint[];
}) {
  const months = useMemo(
    () => Array.from(new Set([...monthlyPlan.map((p) => p.month), ...monthlyActual.map((p) => p.month)])).sort(),
    [monthlyPlan, monthlyActual],
  );

  if (months.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        ยังไม่มีข้อมูลมูลค่างาน (contractValue) พร้อมวันที่เพียงพอสำหรับสร้างกราฟสะสม — กรอกมูลค่างานและวันที่ในแต่ละขั้นตอนก่อน
      </p>
    );
  }

  const width = 640;
  const height = 220;
  const padLeft = 34;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 24;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const x = (i: number) => padLeft + (months.length > 1 ? (i / (months.length - 1)) * plotW : plotW / 2);
  const y = (pct: number) => padTop + plotH - (pct / 100) * plotH;

  const planPoints = months.map((m, i) => ({ x: x(i), y: y(valueAtMonth(monthlyPlan, m)), pct: valueAtMonth(monthlyPlan, m) }));
  const actualPoints = months.map((m, i) => ({
    x: x(i),
    y: y(valueAtMonth(monthlyActual, m)),
    pct: valueAtMonth(monthlyActual, m),
  }));

  const pathFor = (points: { x: number; y: number }[]) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-gray-400" /> แผนสะสม (%)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 border-t-2 border-[#1B5E3A]" /> จริงสะสม (%)
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="กราฟสะสมมูลค่างาน แผนเทียบจริง">
        {[0, 25, 50, 75, 100].map((pct) => (
          <g key={pct}>
            <line x1={padLeft} x2={width - padRight} y1={y(pct)} y2={y(pct)} stroke="#f0f0f0" strokeWidth={1} />
            <text x={padLeft - 6} y={y(pct) + 3} textAnchor="end" fontSize={9} fill="#9ca3af">
              {pct}%
            </text>
          </g>
        ))}
        <path d={pathFor(planPoints)} fill="none" stroke="#9ca3af" strokeWidth={2} strokeDasharray="4 3" strokeLinecap="round" />
        <path d={pathFor(actualPoints)} fill="none" stroke="#1B5E3A" strokeWidth={2} strokeLinecap="round" />
        {planPoints.map((p, i) => (
          <circle key={`plan-${i}`} cx={p.x} cy={p.y} r={3} fill="#9ca3af">
            <title>{`${formatMonth(months[i])}: แผนสะสม ${p.pct}%`}</title>
          </circle>
        ))}
        {actualPoints.map((p, i) => (
          <circle key={`actual-${i}`} cx={p.x} cy={p.y} r={3} fill="#1B5E3A">
            <title>{`${formatMonth(months[i])}: จริงสะสม ${p.pct}%`}</title>
          </circle>
        ))}
        {months.map((m, i) => (
          <text key={m} x={x(i)} y={height - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">
            {formatMonth(m)}
          </text>
        ))}
      </svg>
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

  const [milestonesData, setMilestonesData] = useState<PaymentMilestonesResponse | null>(null);
  const [milestoneForm, setMilestoneForm] = useState({ name: '', amount: '0', plannedDate: '' });
  const [milestoneSaving, setMilestoneSaving] = useState(false);
  const [milestoneActionId, setMilestoneActionId] = useState<string | null>(null);

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

  async function loadMilestones(costCenterId: string) {
    if (!token) return;
    try {
      setMilestonesData(
        await api.get<PaymentMilestonesResponse>(`/payment-milestones?costCenterId=${costCenterId}`, token),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดงวดเงินไม่สำเร็จ');
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
      setMilestonesData(null);
      return;
    }
    if (selected?.type === 'HOUSE') {
      loadPhases(selectedId);
      loadMilestones(selectedId);
    } else if (selected?.type === 'PROJECT') {
      loadFeasibility(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function handleAddMilestone(e: FormEvent) {
    e.preventDefault();
    if (!token || !selectedId) return;
    setMilestoneSaving(true);
    setError(null);
    try {
      const nextSequence = (milestonesData?.milestones.length ?? 0) + 1;
      await api.post(
        '/payment-milestones',
        {
          costCenterId: selectedId,
          sequence: nextSequence,
          name: milestoneForm.name,
          amount: Number(milestoneForm.amount),
          plannedDate: milestoneForm.plannedDate || undefined,
        },
        token,
      );
      setMilestoneForm({ name: '', amount: '0', plannedDate: '' });
      await loadMilestones(selectedId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'เพิ่มงวดเงินไม่สำเร็จ');
    } finally {
      setMilestoneSaving(false);
    }
  }

  async function handleMarkPaid(milestone: PaymentMilestone) {
    if (!token || !selectedId) return;
    setMilestoneActionId(milestone.id);
    setError(null);
    try {
      await api.patch(
        `/payment-milestones/${milestone.id}`,
        { actualPaidDate: new Date().toISOString().slice(0, 10) },
        token,
      );
      await loadMilestones(selectedId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'บันทึกการรับเงินไม่สำเร็จ');
    } finally {
      setMilestoneActionId(null);
    }
  }

  async function handleDeleteMilestone(milestone: PaymentMilestone) {
    if (!token || !selectedId) return;
    setMilestoneActionId(milestone.id);
    setError(null);
    try {
      await api.delete(`/payment-milestones/${milestone.id}`, token);
      await loadMilestones(selectedId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ลบงวดเงินไม่สำเร็จ');
    } finally {
      setMilestoneActionId(null);
    }
  }

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
      contractValue: String(phase.contractValue),
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
          contractValue: Number(editDraft.contractValue),
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

      {selected?.type === 'HOUSE' && phasesData && phasesData.phases.length === 0 && (
        <div className={card}>
          <p className="text-sm text-gray-700">
            ยังไม่มีขั้นตอนงานสำหรับบ้านนี้
            {canManage ? ' เริ่มจากเทมเพลต:' : ' กรุณาติดต่อผู้ดูแลระบบ (Project Manager/CEO/CFO) เพื่อสร้างขั้นตอนงาน'}
          </p>
          {canManage && (
            <div className="mt-3 flex gap-2">
              <button disabled={seeding} onClick={() => handleSeed('SINGLE_STORY')} className={primaryButton}>
                บ้านชั้นเดียว
              </button>
              <button disabled={seeding} onClick={() => handleSeed('TWO_STORY')} className={primaryButton}>
                บ้านสองชั้น
              </button>
            </div>
          )}
        </div>
      )}

      {selected?.type === 'HOUSE' && phasesData && phasesData.phases.length > 0 && (
        <>
          <div className={`${card} grid grid-cols-2 gap-4 sm:grid-cols-5`}>
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
            <div>
              <p className="text-xs text-gray-500">มูลค่าสัญญารวม</p>
              <p className="text-lg font-semibold">{formatThb(phasesData.summary.totalContractValue)}</p>
            </div>
          </div>

          <div className={card}>
            <h2 className="mb-3 text-sm font-semibold text-gray-900">
              กราฟสะสมมูลค่างาน (S-Curve) — แผนเทียบจริง
            </h2>
            <SCurveChart monthlyPlan={phasesData.summary.monthlyPlan} monthlyActual={phasesData.summary.monthlyActual} />
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
              <form onSubmit={saveEdit} className="mt-4 grid grid-cols-1 gap-2 border-t border-gray-100 pt-4 sm:grid-cols-7">
                <div>
                  <label className={label}>มูลค่างาน (บาท)</label>
                  <input
                    type="number"
                    min="0"
                    className={input}
                    value={editDraft.contractValue}
                    onChange={(e) => setEditDraft((d) => ({ ...d, contractValue: e.target.value }))}
                  />
                </div>
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

          {milestonesData && (
            <div className={card}>
              <h2 className="text-sm font-semibold text-gray-900">งวดงานการชำระเงิน (Payment Milestones)</h2>
              <p className="mt-1 text-xs text-gray-400">
                บันทึกงวดเงินที่ลูกค้าต้องชำระตามความคืบหน้างาน และวันที่รับเงินจริง เพื่อดู Cash Flow ของบ้านหลังนี้
              </p>

              <div className="mt-3 grid grid-cols-3 gap-4 border-b border-gray-100 pb-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">มูลค่างวดรวม</p>
                  <p className="font-semibold">{formatThb(milestonesData.summary.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">รับแล้ว</p>
                  <p className="font-semibold text-[#1B5E3A]">{formatThb(milestonesData.summary.totalReceived)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">ค้างรับ</p>
                  <p className="font-semibold text-[#B8860B]">{formatThb(milestonesData.summary.totalPending)}</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {milestonesData.milestones.length === 0 && (
                  <p className="text-sm text-gray-400">ยังไม่มีงวดเงินสำหรับบ้านนี้</p>
                )}
                {milestonesData.milestones.map((m) => (
                  <div
                    key={m.id}
                    className="grid grid-cols-1 items-center gap-2 border-b border-gray-50 pb-2 text-sm sm:grid-cols-[1fr_auto_auto_auto_auto]"
                  >
                    <div>
                      <span className="text-gray-400">{m.sequence}.</span> {m.name}
                    </div>
                    <div className="text-gray-700">{formatThb(m.amount)}</div>
                    <div className="text-xs text-gray-500">
                      แผน: {m.plannedDate ? formatDate(m.plannedDate) : '-'}
                    </div>
                    <div className={`${badge} ${m.actualPaidDate ? 'bg-green-50 text-[#1B5E3A]' : 'bg-amber-50 text-[#B8860B]'}`}>
                      {m.actualPaidDate ? `รับแล้ว ${formatDate(m.actualPaidDate)}` : 'รอรับเงิน'}
                    </div>
                    {canManage && (
                      <div className="flex gap-2">
                        {!m.actualPaidDate && (
                          <button
                            disabled={milestoneActionId === m.id}
                            onClick={() => handleMarkPaid(m)}
                            className={`${secondaryButton} px-2 py-1 text-xs`}
                          >
                            รับเงินแล้ว
                          </button>
                        )}
                        <button
                          disabled={milestoneActionId === m.id}
                          onClick={() => handleDeleteMilestone(m)}
                          className={`${secondaryButton} px-2 py-1 text-xs`}
                        >
                          ลบ
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {canManage && (
                <form onSubmit={handleAddMilestone} className="mt-4 grid grid-cols-1 gap-2 border-t border-gray-100 pt-4 sm:grid-cols-4">
                  <div>
                    <label className={label}>ชื่องวด</label>
                    <input
                      type="text"
                      required
                      className={input}
                      value={milestoneForm.name}
                      onChange={(e) => setMilestoneForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="เช่น งวดที่ 1 - วางเสาเข็ม"
                    />
                  </div>
                  <div>
                    <label className={label}>จำนวนเงิน (บาท)</label>
                    <input
                      type="number"
                      min="0"
                      required
                      className={input}
                      value={milestoneForm.amount}
                      onChange={(e) => setMilestoneForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={label}>วันครบกำหนด (แผน)</label>
                    <input
                      type="date"
                      className={input}
                      value={milestoneForm.plannedDate}
                      onChange={(e) => setMilestoneForm((f) => ({ ...f, plannedDate: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-end">
                    <button type="submit" disabled={milestoneSaving} className={primaryButton}>
                      {milestoneSaving ? 'กำลังเพิ่ม...' : 'เพิ่มงวดเงิน'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
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
