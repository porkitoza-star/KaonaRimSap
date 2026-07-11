'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type {
  CostCenter,
  CostEstimatorApplyResult,
  CostEstimatorScenario,
  EstimateScenarioInput,
  EstimatorFloors,
  EstimatorGrade,
  EstimatorRoofType,
} from '@/lib/types';
import { formatThb } from '@/lib/format';
import { card, input, label, primaryButton, errorBanner } from '@/lib/ui';

const GRADE_OPTIONS: { value: EstimatorGrade; label: string }[] = [
  { value: 'STANDARD', label: 'มาตรฐาน (เฉลี่ยไทวัสดุ/โกลบอลเฮ้าส์)' },
  { value: 'HIGH', label: 'เกรดสูง' },
  { value: 'LUXURY', label: 'หรูหรา' },
  { value: 'PREMIUM', label: 'พรีเมียม' },
];

const ROOF_OPTIONS: { value: EstimatorRoofType; label: string }[] = [
  { value: 'GABLE', label: 'ทรงจั่ว' },
  { value: 'HIP', label: 'ทรงปั้นหยา' },
  { value: 'MONO_PITCH', label: 'เพิงหมาแหงน' },
  { value: 'FLAT', label: 'ดาดฟ้า/หลังคาเรียบ' },
];

const FLOORS_OPTIONS: EstimatorFloors[] = [1, 2, 3];

export default function CostEstimatorPage() {
  const { token, user } = useAuth();
  const canApply =
    user?.role === 'PROJECT_MANAGER' ||
    user?.role === 'ACCOUNTANT' ||
    user?.role === 'CFO' ||
    user?.role === 'CEO';

  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [areaSqm, setAreaSqm] = useState('51');
  const [floors, setFloors] = useState<EstimatorFloors>(1);
  const [grade, setGrade] = useState<EstimatorGrade>('STANDARD');
  const [roofType, setRoofType] = useState<EstimatorRoofType>('GABLE');
  const [houseCount, setHouseCount] = useState('1');
  const [sellingPricePerUnit, setSellingPricePerUnit] = useState('2690000');
  const [landCost, setLandCost] = useState('0');
  const [infrastructureCost, setInfrastructureCost] = useState('0');
  const [overheadCost, setOverheadCost] = useState('0');
  const [financingCost, setFinancingCost] = useState('0');
  const [corporateTaxRatePercent, setCorporateTaxRatePercent] = useState('20');

  const [computing, setComputing] = useState(false);
  const [scenario, setScenario] = useState<CostEstimatorScenario | null>(null);

  const [costCenterId, setCostCenterId] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<CostEstimatorApplyResult | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .get<CostCenter[]>('/cost-centers', token)
      .then(setCostCenters)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'โหลด Cost Center ไม่สำเร็จ'));
  }, [token]);

  function buildInput(): EstimateScenarioInput {
    return {
      areaSqm: Number(areaSqm),
      floors,
      grade,
      roofType,
      houseCount: Number(houseCount) || 1,
      sellingPricePerUnit: Number(sellingPricePerUnit) || 0,
      landCost: Number(landCost) || 0,
      infrastructureCost: Number(infrastructureCost) || 0,
      overheadCost: Number(overheadCost) || 0,
      financingCost: Number(financingCost) || 0,
      corporateTaxRatePercent: Number(corporateTaxRatePercent) || 0,
    };
  }

  async function handleCompute() {
    if (!token || !areaSqm) return;
    setComputing(true);
    setError(null);
    setApplyResult(null);
    try {
      const res = await api.post<CostEstimatorScenario>('/cost-estimator/scenario', buildInput(), token);
      setScenario(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'คำนวณ Scenario ไม่สำเร็จ');
    } finally {
      setComputing(false);
    }
  }

  async function handleApply() {
    if (!token || !costCenterId) return;
    setApplying(true);
    setError(null);
    try {
      const res = await api.post<CostEstimatorApplyResult>(
        '/cost-estimator/apply',
        { ...buildInput(), costCenterId },
        token,
      );
      setApplyResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'สร้างรายการจาก Scenario ไม่สำเร็จ');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">ประมาณราคา (Cost Estimator / Scenario)</h1>
        <p className="text-sm text-gray-500">
          เลือกขนาดพื้นที่ จำนวนชั้น เกรดวัสดุ และทรงหลังคา ระบบจะประมาณ BOQ, ไทม์ไลน์ก่อสร้าง และ Feasibility
          ให้ทันที — เป็นแนวทางประมาณการโดยอ้างอิงจากราคาก่อสร้างจริง ไม่ใช่ราคาผูกพันหรือใบเสนอราคาจริง
        </p>
      </div>

      {error && <p className={errorBanner}>{error}</p>}

      <div className={`${card} space-y-4`}>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className={label}>พื้นที่ใช้สอย (ตร.ม.)</label>
            <input type="number" min="1" step="0.1" value={areaSqm} onChange={(e) => setAreaSqm(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>จำนวนชั้น</label>
            <select value={floors} onChange={(e) => setFloors(Number(e.target.value) as EstimatorFloors)} className={input}>
              {FLOORS_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f} ชั้น
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>เกรดวัสดุ</label>
            <select value={grade} onChange={(e) => setGrade(e.target.value as EstimatorGrade)} className={input}>
              {GRADE_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>ทรงหลังคา</label>
            <select value={roofType} onChange={(e) => setRoofType(e.target.value as EstimatorRoofType)} className={input}>
              {ROOF_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>จำนวนหลัง</label>
            <input type="number" min="1" value={houseCount} onChange={(e) => setHouseCount(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>ราคาขายต่อหลัง</label>
            <input
              type="number"
              min="0"
              value={sellingPricePerUnit}
              onChange={(e) => setSellingPricePerUnit(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className={label}>ค่าที่ดินรวม (ไม่บังคับ)</label>
            <input type="number" min="0" value={landCost} onChange={(e) => setLandCost(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>ค่าสาธารณูปโภครวม (ไม่บังคับ)</label>
            <input
              type="number"
              min="0"
              value={infrastructureCost}
              onChange={(e) => setInfrastructureCost(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className={label}>ค่าใช้จ่ายดำเนินการรวม (ไม่บังคับ)</label>
            <input type="number" min="0" value={overheadCost} onChange={(e) => setOverheadCost(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>ต้นทุนทางการเงินรวม (ไม่บังคับ)</label>
            <input type="number" min="0" value={financingCost} onChange={(e) => setFinancingCost(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>อัตราภาษีนิติบุคคล (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={corporateTaxRatePercent}
              onChange={(e) => setCorporateTaxRatePercent(e.target.value)}
              className={input}
            />
          </div>
        </div>
        <button type="button" disabled={!areaSqm || computing} onClick={handleCompute} className={primaryButton}>
          {computing ? 'กำลังคำนวณ...' : 'คำนวณ Scenario'}
        </button>
      </div>

      {scenario && (
        <>
          <div className={`${card} space-y-3`}>
            <p className="text-sm font-medium text-gray-700">อัตราที่ใช้คำนวณ</p>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-gray-500">ราคาฐานต่อ ตร.ม.</p>
                <p className="font-semibold">{formatThb(scenario.rateCard.baseRatePerSqm)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">ตัวคูณเกรด</p>
                <p className="font-semibold">{scenario.rateCard.gradeMultiplier}×</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">ตัวคูณหลังคา</p>
                <p className="font-semibold">{scenario.rateCard.roofMultiplier}×</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">ราคาต่อ ตร.ม. ที่ใช้จริง</p>
                <p className="font-semibold">{formatThb(scenario.rateCard.ratePerSqm)}</p>
              </div>
            </div>
          </div>

          <div className={`${card} space-y-3`}>
            <p className="text-sm font-medium text-gray-700">
              BOQ โดยประมาณต่อหลัง — รวม {formatThb(scenario.boq.constructionCostPerUnit)}
              {scenario.inputs.houseCount > 1 && (
                <span className="text-gray-500"> (รวมทั้งหมด {formatThb(scenario.boq.totalConstructionCost)})</span>
              )}
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
                  {scenario.boq.categoryBreakdown.map((c, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 pr-4">{c.category}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatThb(c.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${card} space-y-3`}>
            <p className="text-sm font-medium text-gray-700">
              ไทม์ไลน์โดยประมาณ — {scenario.timeline.estimatedDurationMonths} เดือน/หลัง
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="py-2 pr-4 font-medium">#</th>
                    <th className="py-2 pr-4 font-medium">หมวดงาน</th>
                    <th className="py-2 pr-4 font-medium">ขั้นตอน</th>
                    <th className="py-2 pr-4 text-right font-medium">มูลค่าโดยประมาณ</th>
                  </tr>
                </thead>
                <tbody>
                  {scenario.timeline.phases.map((p) => (
                    <tr key={p.sequence} className="border-b border-gray-50">
                      <td className="py-2 pr-4 text-gray-400">{p.sequence}</td>
                      <td className="py-2 pr-4 text-gray-500">{p.category}</td>
                      <td className="py-2 pr-4">{p.name}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatThb(p.estimatedValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${card} space-y-4`}>
            <p className="text-sm font-medium text-gray-700">Cost Feasibility</p>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-gray-500">รายได้รวม</p>
                <p className="font-semibold">{formatThb(scenario.feasibility.totalRevenue)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">ต้นทุนรวม</p>
                <p className="font-semibold">{formatThb(scenario.feasibility.totalCost)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Gross Profit</p>
                <p className="font-semibold">{formatThb(scenario.feasibility.grossProfit)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Operating Profit (OP)</p>
                <p className="font-semibold">{formatThb(scenario.feasibility.operatingProfit)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">กำไรสุทธิ</p>
                <p className="font-semibold text-[#1B5E3A]">{formatThb(scenario.feasibility.netProfit)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">ต้นทุนคงที่ (Fixed Cost)</p>
                <p className="font-semibold">{formatThb(scenario.feasibility.fixedCost)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">ต้นทุนผันแปรต่อหลัง (Variable Cost)</p>
                <p className="font-semibold">{formatThb(scenario.feasibility.variableCostPerUnit)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">จุดคุ้มทุน (Break-even)</p>
                <p className="font-semibold">
                  {scenario.feasibility.breakEvenUnits !== null ? `${scenario.feasibility.breakEvenUnits} หลัง` : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Margin (GP/รายได้)</p>
                <p className="font-semibold">{scenario.feasibility.grossMarginPercent}%</p>
              </div>
            </div>
          </div>

          {canApply && (
            <div className={`${card} space-y-3`}>
              <p className="text-sm font-medium text-gray-700">
                สร้างเป็น BOQ + ไทม์ไลน์ + Feasibility จริงใน Cost Center
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <label className={label}>Cost Center</label>
                  <select value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)} className={input}>
                    <option value="">-- เลือก Cost Center --</option>
                    {costCenters.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button type="button" disabled={!costCenterId || applying} onClick={handleApply} className={primaryButton}>
                    {applying ? 'กำลังสร้าง...' : 'สร้างจาก Scenario นี้'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                จะสร้างรายการ BOQ ในหน้าวัสดุ/สต๊อก ขั้นตอนงานก่อสร้างในหน้างานก่อสร้าง (ถ้ายังไม่มี) และข้อมูล
                Feasibility ของ Cost Center นี้
              </p>
              {applyResult && (
                <p className="text-sm text-green-700">
                  สร้าง BOQ {applyResult.boq.createdCount} รายการ
                  {applyResult.phasesCreated > 0
                    ? ` และขั้นตอนงาน ${applyResult.phasesCreated} ขั้นตอน`
                    : applyResult.phasesSkipped
                      ? ' (ข้ามขั้นตอนงาน เนื่องจากมีอยู่แล้ว)'
                      : ''}{' '}
                  พร้อมข้อมูล Feasibility เรียบร้อยแล้ว
                </p>
              )}
            </div>
          )}
        </>
      )}

      <p className="text-xs text-gray-400">
        หมายเหตุ: ตัวเลขราคาต่อ ตร.ม. และสัดส่วนหมวดงานอ้างอิงจากใบประมาณราคาจริง 2 โครงการของบริษัท
        เป็นแนวทางประมาณการเบื้องต้นเท่านั้น ควรตรวจสอบกับผู้รับเหมาก่อนใช้เป็นราคาผูกพัน
      </p>
    </div>
  );
}
