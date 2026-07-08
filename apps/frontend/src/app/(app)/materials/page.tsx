'use client';

import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { CostCenter, FeasibilityCostCategory, MaterialItem, StockTransactionType } from '@/lib/types';
import { formatDate, formatThb } from '@/lib/format';
import { card, input, label, primaryButton, secondaryButton, errorBanner, badge } from '@/lib/ui';
import { ExportButton } from '@/components/export-button';

const TX_TYPES: StockTransactionType[] = ['RECEIVE', 'USE', 'ADJUST'];
const TX_LABELS: Record<StockTransactionType, string> = {
  RECEIVE: 'รับเข้า',
  USE: 'เบิกใช้',
  ADJUST: 'ปรับปรุงยอด',
};

const FEASIBILITY_CATEGORY_LABELS: Record<FeasibilityCostCategory, string> = {
  LAND: 'ที่ดิน',
  CONSTRUCTION: 'ก่อสร้าง',
  INFRASTRUCTURE: 'สาธารณูปโภคส่วนกลาง',
  OVERHEAD: 'ค่าใช้จ่ายโครงการ',
  FINANCING: 'ต้นทุนทางการเงิน',
};

export default function MaterialsPage() {
  const { token, user } = useAuth();
  const canManage =
    user?.role === 'PROJECT_MANAGER' ||
    user?.role === 'ACCOUNTANT' ||
    user?.role === 'CFO' ||
    user?.role === 'CEO';

  const [items, setItems] = useState<MaterialItem[]>([]);
  const [lowStock, setLowStock] = useState<MaterialItem[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MaterialItem | null>(null);

  const [costCenterId, setCostCenterId] = useState('');
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [plannedQuantity, setPlannedQuantity] = useState('');
  const [reorderThreshold, setReorderThreshold] = useState('0');
  const [materialUnitPrice, setMaterialUnitPrice] = useState('0');
  const [laborUnitPrice, setLaborUnitPrice] = useState('0');
  const [feasibilityCategory, setFeasibilityCategory] = useState<FeasibilityCostCategory>('CONSTRUCTION');
  const [submitting, setSubmitting] = useState(false);

  const [txType, setTxType] = useState<StockTransactionType>('RECEIVE');
  const [txQuantity, setTxQuantity] = useState('');
  const [txDate, setTxDate] = useState('');
  const [txNotes, setTxNotes] = useState('');
  const [txSubmitting, setTxSubmitting] = useState(false);

  async function reload() {
    if (!token) return;
    try {
      const [itemsRes, lowStockRes, ccRes] = await Promise.all([
        api.get<MaterialItem[]>('/materials', token),
        api.get<MaterialItem[]>('/materials/low-stock', token),
        api.get<CostCenter[]>('/cost-centers', token),
      ]);
      setItems(itemsRes);
      setLowStock(lowStockRes);
      setCostCenters(ccRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดข้อมูลวัสดุไม่สำเร็จ');
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(
        '/materials',
        {
          costCenterId,
          category,
          name,
          unit,
          plannedQuantity: Number(plannedQuantity),
          reorderThreshold: Number(reorderThreshold),
          materialUnitPrice: Number(materialUnitPrice),
          laborUnitPrice: Number(laborUnitPrice),
          feasibilityCategory,
        },
        token,
      );
      setCategory('');
      setName('');
      setUnit('');
      setPlannedQuantity('');
      setReorderThreshold('0');
      setMaterialUnitPrice('0');
      setLaborUnitPrice('0');
      setFeasibilityCategory('CONSTRUCTION');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'เพิ่มรายการวัสดุไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleExpand(item: MaterialItem) {
    if (expandedId === item.id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(item.id);
    setTxQuantity('');
    setTxDate('');
    setTxNotes('');
    if (!token) return;
    try {
      setDetail(await api.get<MaterialItem>(`/materials/${item.id}`, token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดประวัติสต๊อกไม่สำเร็จ');
    }
  }

  async function handleTransaction(e: FormEvent) {
    e.preventDefault();
    if (!token || !expandedId) return;
    setTxSubmitting(true);
    setError(null);
    try {
      await api.post(
        `/materials/${expandedId}/transactions`,
        { type: txType, quantity: Number(txQuantity), transactionDate: txDate, notes: txNotes || undefined },
        token,
      );
      setTxQuantity('');
      setTxNotes('');
      const updated = await api.get<MaterialItem>(`/materials/${expandedId}`, token);
      setDetail(updated);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'บันทึกรายการสต๊อกไม่สำเร็จ');
    } finally {
      setTxSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">วัสดุก่อสร้าง (BOQ) และสต๊อก</h1>
          <p className="text-sm text-gray-500">
            รายการวัสดุตามหมวดงานต่อ Cost Center พร้อมสต๊อกรับเข้า/เบิกใช้/คงเหลือ
          </p>
        </div>
        <ExportButton path="/materials/export" filename="materials.xlsx" onError={setError} />
      </div>

      {error && <p className={errorBanner}>{error}</p>}

      {lowStock.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            ⚠️ มี {lowStock.length} รายการที่ควรสั่งซื้อเพิ่ม
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-700">
            {lowStock.map((item) => (
              <li key={item.id}>
                {item.name} ({item.costCenter?.name}) — คงเหลือ {item.currentStock} {item.unit} (จุดสั่งซื้อ{' '}
                {item.reorderThreshold} {item.unit})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={card}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="py-2 pr-4 font-medium">Cost Center</th>
                <th className="py-2 pr-4 font-medium">หมวดงาน</th>
                <th className="py-2 pr-4 font-medium">วัสดุ</th>
                <th className="py-2 pr-4 text-right font-medium">ตามแผน</th>
                <th className="py-2 pr-4 text-right font-medium">คงเหลือ</th>
                <th className="py-2 pr-4 text-right font-medium">มูลค่ารวม (บาท)</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <Fragment key={item.id}>
                  <tr className="border-b border-gray-50">
                    <td className="py-2 pr-4 text-xs text-gray-500">{item.costCenter?.name}</td>
                    <td className="py-2 pr-4 text-xs text-gray-500">{item.category}</td>
                    <td className="py-2 pr-4">{item.name}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-xs text-gray-500">
                      {Number(item.plannedQuantity)} {item.unit}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      <span
                        className={
                          item.currentStock <= Number(item.reorderThreshold)
                            ? `${badge} bg-amber-100 text-amber-800`
                            : ''
                        }
                      >
                        {item.currentStock} {item.unit}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-xs text-gray-500">
                      {formatThb(item.totalValue)}
                    </td>
                    <td className="py-2 text-right">
                      {canManage && (
                        <button
                          onClick={() => toggleExpand(item)}
                          className={`${secondaryButton} px-3 py-1 text-xs`}
                        >
                          {expandedId === item.id ? 'ปิด' : 'บันทึกสต๊อก'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === item.id && (
                    <tr>
                      <td colSpan={7} className="bg-gray-50 px-4 py-4">
                        <form onSubmit={handleTransaction} className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                          <select
                            className={input}
                            value={txType}
                            onChange={(e) => setTxType(e.target.value as StockTransactionType)}
                          >
                            {TX_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {TX_LABELS[t]}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            className={input}
                            placeholder={`จำนวน (${item.unit})`}
                            value={txQuantity}
                            onChange={(e) => setTxQuantity(e.target.value)}
                            required
                          />
                          <input
                            type="date"
                            className={input}
                            value={txDate}
                            onChange={(e) => setTxDate(e.target.value)}
                            required
                          />
                          <input
                            className={input}
                            placeholder="หมายเหตุ (ไม่บังคับ)"
                            value={txNotes}
                            onChange={(e) => setTxNotes(e.target.value)}
                          />
                          <button type="submit" disabled={txSubmitting} className={primaryButton}>
                            {txSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
                          </button>
                        </form>

                        {detail?.transactions && detail.transactions.length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs font-medium text-gray-500">ประวัติล่าสุด</p>
                            <table className="mt-1 w-full text-left text-xs">
                              <tbody>
                                {detail.transactions.slice(0, 10).map((tx) => (
                                  <tr key={tx.id} className="border-b border-gray-100">
                                    <td className="py-1 pr-4">{formatDate(tx.transactionDate)}</td>
                                    <td className="py-1 pr-4">{TX_LABELS[tx.type]}</td>
                                    <td className="py-1 pr-4 text-right tabular-nums">
                                      {Number(tx.quantity)} {item.unit}
                                    </td>
                                    <td className="py-1 pr-4 text-gray-500">{tx.notes ?? ''}</td>
                                    <td className="py-1 text-gray-400">{tx.createdBy?.name}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-sm text-gray-400">
                    ยังไม่มีรายการวัสดุ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canManage && (
          <form onSubmit={handleCreate} className="mt-6 space-y-3 border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500">เพิ่มรายการวัสดุใหม่ (BOQ)</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={label}>Cost Center</label>
                <select
                  className={input}
                  value={costCenterId}
                  onChange={(e) => setCostCenterId(e.target.value)}
                  required
                >
                  <option value="">-- เลือก Cost Center --</option>
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>หมวดงาน</label>
                <input
                  className={input}
                  placeholder="เช่น งานโครงสร้าง, งานหลังคา"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={label}>ชื่อวัสดุ</label>
                <input className={input} value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label className={label}>หน่วยนับ</label>
                <input
                  className={input}
                  placeholder="เช่น ถุง, ลบ.ม., เส้น"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={label}>ปริมาณตามแผน BOQ</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={input}
                  value={plannedQuantity}
                  onChange={(e) => setPlannedQuantity(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={label}>จุดสั่งซื้อเพิ่ม (คงเหลือน้อยกว่านี้จะแจ้งเตือน)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={input}
                  value={reorderThreshold}
                  onChange={(e) => setReorderThreshold(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>ราคาวัสดุ/หน่วย (บาท)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={input}
                  value={materialUnitPrice}
                  onChange={(e) => setMaterialUnitPrice(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>ราคาค่าแรง/หน่วย (บาท)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={input}
                  value={laborUnitPrice}
                  onChange={(e) => setLaborUnitPrice(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>หมวด Feasibility (สำหรับรวมยอดเข้าโครงการ)</label>
                <select
                  className={input}
                  value={feasibilityCategory}
                  onChange={(e) => setFeasibilityCategory(e.target.value as FeasibilityCostCategory)}
                >
                  {Object.entries(FEASIBILITY_CATEGORY_LABELS).map(([value, labelText]) => (
                    <option key={value} value={value}>
                      {labelText}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" disabled={submitting} className={primaryButton}>
              {submitting ? 'กำลังบันทึก...' : 'เพิ่มรายการวัสดุ'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
