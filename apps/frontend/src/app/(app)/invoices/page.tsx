'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { Account, Contact, CostCenter, Invoice } from '@/lib/types';
import { formatThb, formatDate } from '@/lib/format';
import { card, input, label, primaryButton, secondaryButton, errorBanner } from '@/lib/ui';
import { StatusBadge } from '@/components/status-badge';

interface LineDraft {
  description: string;
  amount: string;
  costCenterId: string;
  accountId: string;
}

const emptyLine = (): LineDraft => ({ description: '', amount: '', costCenterId: '', accountId: '' });

export default function InvoicesPage() {
  const { token, user } = useAuth();
  const canManage = user?.role === 'ACCOUNTANT' || user?.role === 'CFO' || user?.role === 'CEO';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [number, setNumber] = useState('');
  const [contactId, setContactId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    if (!token) return;
    try {
      const [invRes, contactRes, ccRes, accRes] = await Promise.all([
        api.get<Invoice[]>('/invoices', token),
        api.get<Contact[]>('/contacts', token),
        api.get<CostCenter[]>('/cost-centers', token),
        api.get<Account[]>('/chart-of-accounts', token),
      ]);
      setInvoices(invRes);
      setContacts(contactRes);
      setCostCenters(ccRes);
      setAccounts(accRes.filter((a) => a.type === 'REVENUE'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดข้อมูลใบแจ้งหนี้ไม่สำเร็จ');
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(
        '/invoices',
        {
          number,
          contactId,
          issueDate,
          dueDate,
          lines: lines.map((l) => ({ ...l, amount: Number(l.amount) })),
        },
        token,
      );
      setNumber('');
      setContactId('');
      setIssueDate('');
      setDueDate('');
      setLines([emptyLine()]);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'สร้างใบแจ้งหนี้ไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleIssue(id: string) {
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/invoices/${id}/issue`, undefined, token);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ออกใบแจ้งหนี้ไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  }

  async function handleVoid(id: string) {
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/invoices/${id}/void`, undefined, token);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ยกเลิกใบแจ้งหนี้ไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">ใบแจ้งหนี้ (AR)</h1>
        <p className="text-sm text-gray-500">ออกใบแจ้งหนี้ให้ลูกค้าและติดตามการรับชำระ</p>
      </div>

      {error && <p className={errorBanner}>{error}</p>}

      <div className={card}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="py-2 pr-4 font-medium">เลขที่</th>
                <th className="py-2 pr-4 font-medium">คู่ค้า</th>
                <th className="py-2 pr-4 font-medium">ครบกำหนด</th>
                <th className="py-2 pr-4 text-right font-medium">ยอดรวม</th>
                <th className="py-2 pr-4 font-medium">สถานะ</th>
                {canManage && <th className="py-2 font-medium">การดำเนินการ</th>}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4">{inv.number}</td>
                  <td className="py-2 pr-4">{inv.contact?.name}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500">{formatDate(inv.dueDate)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatThb(inv.totalAmount)}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={inv.status} />
                  </td>
                  {canManage && (
                    <td className="py-2">
                      {inv.status === 'DRAFT' && (
                        <div className="flex gap-2">
                          <button
                            disabled={busyId === inv.id}
                            onClick={() => handleIssue(inv.id)}
                            className={`${secondaryButton} px-3 py-1 text-xs`}
                          >
                            ออกใบแจ้งหนี้
                          </button>
                          <button
                            disabled={busyId === inv.id}
                            onClick={() => handleVoid(inv.id)}
                            className={`${secondaryButton} px-3 py-1 text-xs`}
                          >
                            ยกเลิก
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-sm text-gray-400">
                    ยังไม่มีใบแจ้งหนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canManage && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4 border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500">
              สร้างใบแจ้งหนี้ใหม่ (ระบบคำนวณ VAT 7% ให้อัตโนมัติ)
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>เลขที่ใบแจ้งหนี้</label>
                <input className={input} value={number} onChange={(e) => setNumber(e.target.value)} required />
              </div>
              <div>
                <label className={label}>ลูกค้า</label>
                <select className={input} value={contactId} onChange={(e) => setContactId(e.target.value)} required>
                  <option value="">-- เลือกลูกค้า --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>วันที่ออก</label>
                <input
                  type="date"
                  className={input}
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={label}>ครบกำหนดชำระ</label>
                <input
                  type="date"
                  className={input}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className={label}>รายการ</p>
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-gray-100 p-3 sm:grid-cols-4">
                  <input
                    className={input}
                    placeholder="รายละเอียด"
                    value={line.description}
                    onChange={(e) => updateLine(idx, { description: e.target.value })}
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className={input}
                    placeholder="จำนวนเงิน"
                    value={line.amount}
                    onChange={(e) => updateLine(idx, { amount: e.target.value })}
                    required
                  />
                  <select
                    className={input}
                    value={line.costCenterId}
                    onChange={(e) => updateLine(idx, { costCenterId: e.target.value })}
                    required
                  >
                    <option value="">-- Cost Center --</option>
                    {costCenters.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className={input}
                    value={line.accountId}
                    onChange={(e) => updateLine(idx, { accountId: e.target.value })}
                    required
                  >
                    <option value="">-- บัญชีรายได้ --</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div className="flex gap-2">
                <button type="button" className={secondaryButton} onClick={() => setLines((p) => [...p, emptyLine()])}>
                  + เพิ่มรายการ
                </button>
                {lines.length > 1 && (
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => setLines((p) => p.slice(0, -1))}
                  >
                    - ลบรายการสุดท้าย
                  </button>
                )}
              </div>
            </div>

            <button type="submit" disabled={submitting} className={primaryButton}>
              {submitting ? 'กำลังบันทึก...' : 'สร้างใบแจ้งหนี้ (แบบร่าง)'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
