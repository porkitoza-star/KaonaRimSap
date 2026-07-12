'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { Account, Bill, Contact, CostCenter } from '@/lib/types';
import { formatThb, formatDate } from '@/lib/format';
import { card, input, label, primaryButton, secondaryButton, errorBanner } from '@/lib/ui';
import { StatusBadge } from '@/components/status-badge';
import { ExportButton } from '@/components/export-button';
import { ImportButton } from '@/components/import-button';

interface LineDraft {
  description: string;
  amount: string;
  costCenterId: string;
  accountId: string;
  workCategory: string;
}

const emptyLine = (): LineDraft => ({
  description: '',
  amount: '',
  costCenterId: '',
  accountId: '',
  workCategory: '',
});

export default function BillsPage() {
  const { token, user } = useAuth();
  const canManage = user?.role === 'ACCOUNTANT' || user?.role === 'CFO' || user?.role === 'CEO';

  const [bills, setBills] = useState<Bill[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [number, setNumber] = useState('');
  const [contactId, setContactId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [vatAmount, setVatAmount] = useState('0');
  const [whtAmount, setWhtAmount] = useState('0');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    if (!token) return;
    try {
      const [billRes, contactRes, ccRes, accRes] = await Promise.all([
        api.get<Bill[]>('/bills', token),
        api.get<Contact[]>('/contacts', token),
        api.get<CostCenter[]>('/cost-centers', token),
        api.get<Account[]>('/chart-of-accounts', token),
      ]);
      setBills(billRes);
      setContacts(contactRes);
      setCostCenters(ccRes);
      setAccounts(accRes.filter((a) => a.type === 'EXPENSE' || a.type === 'ASSET'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดข้อมูลบิลไม่สำเร็จ');
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
        '/bills',
        {
          number,
          contactId,
          issueDate,
          dueDate,
          vatAmount: Number(vatAmount),
          whtAmount: Number(whtAmount),
          lines: lines.map((l) => ({ ...l, amount: Number(l.amount) })),
        },
        token,
      );
      setNumber('');
      setContactId('');
      setIssueDate('');
      setDueDate('');
      setVatAmount('0');
      setWhtAmount('0');
      setLines([emptyLine()]);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'สร้างบิลไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(id: string) {
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/bills/${id}/confirm`, undefined, token);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ยืนยันบิลไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  }

  async function handleVoid(id: string) {
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/bills/${id}/void`, undefined, token);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ยกเลิกบิลไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">บิล (AP)</h1>
          <p className="text-sm text-gray-500">บันทึกบิลจากผู้รับเหมาและซัพพลายเออร์</p>
          {canManage && (
            <p className="mt-1 text-xs text-gray-400">
              นำเข้า Excel ต้องมีคอลัมน์: เลขที่ (เว้นว่างได้), คู่ค้า, วันที่ออก, ครบกำหนด (เว้นว่างได้),
              รายละเอียด, จำนวนเงิน, รหัสบัญชี (เช่น 5010), ศูนย์ต้นทุน (ชื่อต้องตรงกับที่มีในระบบ), VAT,
              หัก ณ ที่จ่าย — 1 แถว = 1 บิล (รายการเดียว)
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <ExportButton path="/bills/export" filename="bills.xlsx" onError={setError} />
          {canManage && (
            <ImportButton path="/bills/import" onImported={reload} onError={setError} />
          )}
        </div>
      </div>

      {error && <p className={errorBanner}>{error}</p>}

      <div className={card}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="whitespace-nowrap py-2 pr-4 font-medium">เลขที่</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium">คู่ค้า</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium">ครบกำหนด</th>
                <th className="whitespace-nowrap py-2 pr-4 text-right font-medium">ยอดรวม</th>
                <th className="whitespace-nowrap py-2 pr-4 font-medium">สถานะ</th>
                {canManage && <th className="whitespace-nowrap py-2 font-medium">การดำเนินการ</th>}
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id} className="border-b border-gray-50">
                  <td className="whitespace-nowrap py-2 pr-4">{bill.number}</td>
                  <td className="whitespace-nowrap py-2 pr-4">{bill.contact?.name}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-xs text-gray-500">{formatDate(bill.dueDate)}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-right tabular-nums">{formatThb(bill.totalAmount)}</td>
                  <td className="whitespace-nowrap py-2 pr-4">
                    <StatusBadge status={bill.status} />
                  </td>
                  {canManage && (
                    <td className="whitespace-nowrap py-2">
                      {bill.status === 'DRAFT' && (
                        <div className="flex gap-2">
                          <button
                            disabled={busyId === bill.id}
                            onClick={() => handleConfirm(bill.id)}
                            className={`${secondaryButton} px-3 py-1 text-xs`}
                          >
                            ยืนยัน
                          </button>
                          <button
                            disabled={busyId === bill.id}
                            onClick={() => handleVoid(bill.id)}
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
              {bills.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-sm text-gray-400">
                    ยังไม่มีบิล
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canManage && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4 border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500">บันทึกบิลใหม่</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>เลขที่บิล</label>
                <input className={input} value={number} onChange={(e) => setNumber(e.target.value)} required />
              </div>
              <div>
                <label className={label}>ผู้รับเหมา/ซัพพลายเออร์</label>
                <select className={input} value={contactId} onChange={(e) => setContactId(e.target.value)} required>
                  <option value="">-- เลือกคู่ค้า --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>วันที่ออกบิล</label>
                <input
                  type="date"
                  className={input}
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={label}>ครบกำหนดจ่าย</label>
                <input
                  type="date"
                  className={input}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={label}>VAT (บาท)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={input}
                  value={vatAmount}
                  onChange={(e) => setVatAmount(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>หัก ณ ที่จ่าย (บาท)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={input}
                  value={whtAmount}
                  onChange={(e) => setWhtAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className={label}>รายการ</p>
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-gray-100 p-3 sm:grid-cols-5">
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
                    <option value="">-- บัญชีต้นทุน/ค่าใช้จ่าย --</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} {acc.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className={input}
                    placeholder="หมวดงาน (ไม่บังคับ)"
                    value={line.workCategory}
                    onChange={(e) => updateLine(idx, { workCategory: e.target.value })}
                  />
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
              {submitting ? 'กำลังบันทึก...' : 'บันทึกบิล (แบบร่าง)'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
