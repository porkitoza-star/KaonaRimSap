'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { Bill, WhtCertificate } from '@/lib/types';
import { formatThb, formatDate } from '@/lib/format';
import { card, input, label, primaryButton, secondaryButton, errorBanner } from '@/lib/ui';

const CERT_TYPES: WhtCertificate['certType'][] = ['PND3', 'PND53'];
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export default function WhtCertificatesPage() {
  const { token, user } = useAuth();
  const canManage = user?.role === 'ACCOUNTANT' || user?.role === 'CFO' || user?.role === 'CEO';

  const [certs, setCerts] = useState<WhtCertificate[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [billId, setBillId] = useState('');
  const [certType, setCertType] = useState<WhtCertificate['certType']>('PND53');
  const [incomeTypeCode, setIncomeTypeCode] = useState('');
  const [baseAmount, setBaseAmount] = useState('');
  const [whtRate, setWhtRate] = useState('3');
  const [issueDate, setIssueDate] = useState('');

  async function reload() {
    if (!token) return;
    try {
      const [certRes, billRes] = await Promise.all([
        api.get<WhtCertificate[]>('/wht-certificates', token),
        api.get<Bill[]>('/bills', token),
      ]);
      setCerts(certRes);
      setBills(billRes.filter((b) => b.status !== 'DRAFT' && b.status !== 'VOID'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดข้อมูลใบหัก ณ ที่จ่ายไม่สำเร็จ');
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(
        '/wht-certificates',
        {
          billId,
          certType,
          incomeTypeCode,
          baseAmount: Number(baseAmount),
          whtRate: Number(whtRate),
          issueDate,
        },
        token,
      );
      setBillId('');
      setIncomeTypeCode('');
      setBaseAmount('');
      setIssueDate('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'สร้างใบหัก ณ ที่จ่ายไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExport() {
    if (!token) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/wht-certificates/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('ส่งออกไม่สำเร็จ');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wht-certificates.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('ส่งออกไฟล์ CSV ไม่สำเร็จ');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">ใบหัก ณ ที่จ่าย</h1>
          <p className="text-sm text-gray-500">ออกใบหัก ณ ที่จ่าย และส่งออกไฟล์สำหรับยื่นสรรพากร</p>
        </div>
        <button onClick={handleExport} disabled={exporting} className={secondaryButton}>
          {exporting ? 'กำลังส่งออก...' : 'ส่งออก CSV'}
        </button>
      </div>

      {error && <p className={errorBanner}>{error}</p>}

      <div className={card}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="py-2 pr-4 font-medium">เลขที่</th>
                <th className="py-2 pr-4 font-medium">ประเภทแบบ</th>
                <th className="py-2 pr-4 font-medium">วันที่ออก</th>
                <th className="py-2 pr-4 text-right font-medium">ยอดเงินได้</th>
                <th className="py-2 text-right font-medium">ภาษีหัก ณ ที่จ่าย</th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4">{c.certNumber}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500">{c.certType}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500">{formatDate(c.issueDate)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatThb(c.baseAmount)}</td>
                  <td className="py-2 text-right tabular-nums">{formatThb(c.whtAmount)}</td>
                </tr>
              ))}
              {certs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-sm text-gray-400">
                    ยังไม่มีใบหัก ณ ที่จ่าย
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canManage && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3 border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500">ออกใบหัก ณ ที่จ่ายใหม่</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>บิลอ้างอิง</label>
                <select className={input} value={billId} onChange={(e) => setBillId(e.target.value)} required>
                  <option value="">-- เลือกบิล --</option>
                  {bills.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.number} ({b.contact?.name})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>ประเภทแบบ</label>
                <select
                  className={input}
                  value={certType}
                  onChange={(e) => setCertType(e.target.value as WhtCertificate['certType'])}
                >
                  {CERT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>ประเภทเงินได้</label>
                <input
                  className={input}
                  value={incomeTypeCode}
                  onChange={(e) => setIncomeTypeCode(e.target.value)}
                  placeholder="ค่าจ้างทำของ"
                  required
                />
              </div>
              <div>
                <label className={label}>วันที่ออกเอกสาร</label>
                <input
                  type="date"
                  className={input}
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={label}>ยอดเงินได้ (ฐานภาษี)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className={input}
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={label}>อัตราภาษี (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={input}
                  value={whtRate}
                  onChange={(e) => setWhtRate(e.target.value)}
                  required
                />
              </div>
            </div>
            <button type="submit" disabled={submitting} className={primaryButton}>
              {submitting ? 'กำลังบันทึก...' : 'ออกใบหัก ณ ที่จ่าย'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
