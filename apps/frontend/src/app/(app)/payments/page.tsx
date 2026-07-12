'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { Bill, Invoice, Payment } from '@/lib/types';
import { formatThb } from '@/lib/format';
import { card, input, label, primaryButton, secondaryButton, dangerButton, errorBanner } from '@/lib/ui';
import { StatusBadge } from '@/components/status-badge';
import { ExportButton } from '@/components/export-button';

interface AllocationDraft {
  refId: string;
  amount: string;
}

const emptyAllocation = (): AllocationDraft => ({ refId: '', amount: '' });

export default function PaymentsPage() {
  const { token, user } = useAuth();
  const canPropose =
    user?.role === 'PROJECT_MANAGER' ||
    user?.role === 'ACCOUNTANT' ||
    user?.role === 'CFO' ||
    user?.role === 'CEO';
  const canReceive = user?.role === 'ACCOUNTANT' || user?.role === 'CFO' || user?.role === 'CEO';
  const canApprove = user?.role === 'CFO' || user?.role === 'CEO';

  const [payments, setPayments] = useState<Payment[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [payMethod, setPayMethod] = useState('');
  const [payAllocations, setPayAllocations] = useState<AllocationDraft[]>([emptyAllocation()]);
  const [paySubmitting, setPaySubmitting] = useState(false);

  const [receiveMethod, setReceiveMethod] = useState('');
  const [receiveAllocations, setReceiveAllocations] = useState<AllocationDraft[]>([emptyAllocation()]);
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);

  async function reload() {
    if (!token) return;
    try {
      const [paymentRes, billRes, invoiceRes] = await Promise.all([
        api.get<Payment[]>('/payments', token),
        api.get<Bill[]>('/bills', token),
        api.get<Invoice[]>('/invoices', token),
      ]);
      setPayments(paymentRes);
      setBills(billRes.filter((b) => b.status === 'CONFIRMED' || b.status === 'PARTIALLY_PAID'));
      setInvoices(invoiceRes.filter((i) => i.status === 'SENT' || i.status === 'PARTIALLY_PAID'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดข้อมูลการจ่าย-รับเงินไม่สำเร็จ');
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handlePropose(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setPaySubmitting(true);
    setError(null);
    try {
      const allocations = payAllocations.map((a) => ({ billId: a.refId, amount: Number(a.amount) }));
      const amount = allocations.reduce((sum, a) => sum + a.amount, 0);
      await api.post('/payments/propose', { amount, method: payMethod || undefined, allocations }, token);
      setPayMethod('');
      setPayAllocations([emptyAllocation()]);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'เสนอจ่ายเงินไม่สำเร็จ');
    } finally {
      setPaySubmitting(false);
    }
  }

  async function handleReceive(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setReceiveSubmitting(true);
    setError(null);
    try {
      const allocations = receiveAllocations.map((a) => ({ invoiceId: a.refId, amount: Number(a.amount) }));
      const amount = allocations.reduce((sum, a) => sum + a.amount, 0);
      await api.post('/payments/receive', { amount, method: receiveMethod || undefined, allocations }, token);
      setReceiveMethod('');
      setReceiveAllocations([emptyAllocation()]);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'บันทึกรับชำระเงินไม่สำเร็จ');
    } finally {
      setReceiveSubmitting(false);
    }
  }

  async function handleApprove(id: string) {
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/payments/${id}/approve`, undefined, token);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'อนุมัติไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/payments/${id}/reject`, { comment: 'ปฏิเสธจากหน้ารายการจ่ายเงิน' }, token);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ปฏิเสธไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">การจ่าย-รับเงิน</h1>
          <p className="text-sm text-gray-500">
            จ่ายเงินต้องผ่านการอนุมัติจาก CFO เสมอ และ CEO เพิ่มเติมหากยอดเกินวงเงินที่กำหนด
          </p>
        </div>
        <ExportButton path="/payments/export" filename="payments.xlsx" onError={setError} />
      </div>

      {error && <p className={errorBanner}>{error}</p>}

      <div className={card}>
        <h2 className="text-sm font-semibold text-gray-900">รายการจ่าย-รับเงิน</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="whitespace-nowrap py-2 pr-4 font-medium">ประเภท</th>
                <th className="whitespace-nowrap py-2 pr-4 text-right font-medium">จำนวนเงิน</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium">ผู้เสนอ</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium">สถานะ</th>
                {canApprove && <th className="whitespace-nowrap py-2 font-medium">การดำเนินการ</th>}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-gray-50">
                  <td className="whitespace-nowrap py-2 pr-4 text-xs text-gray-500">
                    {p.direction === 'PAY' ? 'จ่ายเงิน' : 'รับเงิน'}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums">{formatThb(p.amount)}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-xs text-gray-500">{p.proposedBy?.name ?? '-'}</td>
                  <td className="whitespace-nowrap py-2 pr-4">
                    <StatusBadge status={p.status} />
                  </td>
                  {canApprove && (
                    <td className="whitespace-nowrap py-2">
                      {(p.status === 'PENDING_CFO_APPROVAL' || p.status === 'PENDING_CEO_APPROVAL') && (
                        <div className="flex gap-2">
                          <button
                            disabled={busyId === p.id}
                            onClick={() => handleApprove(p.id)}
                            className={`${secondaryButton} px-3 py-1 text-xs`}
                          >
                            อนุมัติ
                          </button>
                          <button
                            disabled={busyId === p.id}
                            onClick={() => handleReject(p.id)}
                            className={`${dangerButton} px-3 py-1 text-xs`}
                          >
                            ปฏิเสธ
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-sm text-gray-400">
                    ยังไม่มีรายการ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {canPropose && (
          <div className={card}>
            <h2 className="text-sm font-semibold text-gray-900">เสนอจ่ายเงิน (ให้ผู้รับเหมา/ซัพพลายเออร์)</h2>
            <form onSubmit={handlePropose} className="mt-4 space-y-3">
              <div>
                <label className={label}>วิธีจ่าย</label>
                <input className={input} value={payMethod} onChange={(e) => setPayMethod(e.target.value)} placeholder="โอนธนาคาร / เช็ค" />
              </div>
              {payAllocations.map((a, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-2">
                  <select
                    className={input}
                    value={a.refId}
                    onChange={(e) =>
                      setPayAllocations((prev) => prev.map((x, i) => (i === idx ? { ...x, refId: e.target.value } : x)))
                    }
                    required
                  >
                    <option value="">-- เลือกบิล --</option>
                    {bills.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.number} ({formatThb(b.totalAmount)})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className={input}
                    placeholder="จำนวนเงิน"
                    value={a.amount}
                    onChange={(e) =>
                      setPayAllocations((prev) => prev.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)))
                    }
                    required
                  />
                </div>
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => setPayAllocations((p) => [...p, emptyAllocation()])}
                >
                  + เพิ่มบิล
                </button>
                {payAllocations.length > 1 && (
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => setPayAllocations((p) => p.slice(0, -1))}
                  >
                    - ลบรายการสุดท้าย
                  </button>
                )}
              </div>
              <button type="submit" disabled={paySubmitting} className={primaryButton}>
                {paySubmitting ? 'กำลังส่ง...' : 'เสนอจ่ายเงิน'}
              </button>
            </form>
          </div>
        )}

        {canReceive && (
          <div className={card}>
            <h2 className="text-sm font-semibold text-gray-900">รับชำระเงิน (จากลูกค้า)</h2>
            <form onSubmit={handleReceive} className="mt-4 space-y-3">
              <div>
                <label className={label}>วิธีรับเงิน</label>
                <input
                  className={input}
                  value={receiveMethod}
                  onChange={(e) => setReceiveMethod(e.target.value)}
                  placeholder="โอนธนาคาร / เงินสด"
                />
              </div>
              {receiveAllocations.map((a, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-2">
                  <select
                    className={input}
                    value={a.refId}
                    onChange={(e) =>
                      setReceiveAllocations((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, refId: e.target.value } : x)),
                      )
                    }
                    required
                  >
                    <option value="">-- เลือกใบแจ้งหนี้ --</option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.number} ({formatThb(inv.totalAmount)})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className={input}
                    placeholder="จำนวนเงิน"
                    value={a.amount}
                    onChange={(e) =>
                      setReceiveAllocations((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)),
                      )
                    }
                    required
                  />
                </div>
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => setReceiveAllocations((p) => [...p, emptyAllocation()])}
                >
                  + เพิ่มใบแจ้งหนี้
                </button>
                {receiveAllocations.length > 1 && (
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => setReceiveAllocations((p) => p.slice(0, -1))}
                  >
                    - ลบรายการสุดท้าย
                  </button>
                )}
              </div>
              <button type="submit" disabled={receiveSubmitting} className={primaryButton}>
                {receiveSubmitting ? 'กำลังบันทึก...' : 'บันทึกรับชำระเงิน'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
