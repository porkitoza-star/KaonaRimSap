'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { BankStatementParseResult } from '@/lib/types';
import { formatThb } from '@/lib/format';
import { card, input, label, primaryButton, secondaryButton, errorBanner, badge } from '@/lib/ui';

export default function BankStatementPage() {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BankStatementParseResult | null>(null);

  async function submitFile(withPassword?: string) {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !token) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (withPassword) formData.append('password', withPassword);
      const res = await api.post<BankStatementParseResult>('/bank-statement/parse', formData, token);
      setResult(res);
      setNeedsPassword(false);
    } catch (err) {
      if (err instanceof ApiError && (err.body as { requiresPassword?: boolean })?.requiresPassword) {
        setNeedsPassword(true);
        setError(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : 'อ่านไฟล์ Statement ไม่สำเร็จ');
        setNeedsPassword(false);
      }
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileName(file?.name ?? null);
    setResult(null);
    setError(null);
    setNeedsPassword(false);
    setPassword('');
    if (file) submitFile();
  }

  function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    submitFile(password);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Bank Statement (STM)</h1>
        <p className="text-sm text-gray-500">
          อัปโหลดไฟล์ Statement บัญชีธนาคาร (PDF) เพื่อดูรายละเอียดรายรับ-รายจ่ายแยกเป็นรายการ — ถ้าไฟล์มีรหัสผ่าน
          ระบบจะถามให้กรอกก่อน
        </p>
        <p className="mt-1 text-xs text-gray-400">
          ระบบอ่านข้อมูลจากไฟล์เพื่อแสดงผลเท่านั้น ไม่ได้บันทึกเป็นรายการบัญชีในระบบ — เป็นการอ่านแบบพยายามที่ดีที่สุด
          (best-effort) รูปแบบ Statement แต่ละธนาคารต่างกัน ควรตรวจสอบยอดกับไฟล์ต้นฉบับอีกครั้ง
        </p>
      </div>

      {error && <p className={errorBanner}>{error}</p>}

      <div className={card}>
        <label className={label}>ไฟล์ Statement (PDF)</label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className={primaryButton}
          >
            {loading ? 'กำลังอ่านไฟล์...' : 'เลือกไฟล์ PDF'}
          </button>
          {fileName && <span className="text-sm text-gray-500">{fileName}</span>}
          <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
        </div>

        {needsPassword && (
          <form onSubmit={handlePasswordSubmit} className="mt-4 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
            <div>
              <label className={label}>รหัสผ่านไฟล์ PDF</label>
              <input
                type="password"
                className={input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
            </div>
            <button type="submit" disabled={loading} className={primaryButton}>
              {loading ? 'กำลังตรวจสอบ...' : 'ยืนยันรหัสผ่าน'}
            </button>
          </form>
        )}
      </div>

      {result && (
        <>
          <div className={`${card} grid grid-cols-1 gap-4 sm:grid-cols-3`}>
            <div>
              <p className="text-xs text-gray-500">เงินเข้า (รวม)</p>
              <p className="text-lg font-semibold text-[#1B5E3A]">{formatThb(result.totalCredit)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">เงินออก (รวม)</p>
              <p className="text-lg font-semibold text-[#d03b3b]">{formatThb(result.totalDebit)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">จำนวนรายการที่อ่านได้</p>
              <p className="text-lg font-semibold">{result.transactionCount.toLocaleString('th-TH')}</p>
            </div>
          </div>

          <div className={card}>
            <h2 className="mb-3 text-sm font-semibold text-gray-900">รายการเดินบัญชี</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="py-2 pr-4 font-medium">วันที่</th>
                    <th className="py-2 pr-4 font-medium">รายละเอียด</th>
                    <th className="py-2 pr-4 font-medium">ประเภท</th>
                    <th className="py-2 pr-4 text-right font-medium">จำนวนเงิน</th>
                    <th className="py-2 pr-4 text-right font-medium">คงเหลือ</th>
                  </tr>
                </thead>
                <tbody>
                  {result.transactions.map((t, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 pr-4 text-xs text-gray-500">{t.date ?? '-'}</td>
                      <td className="py-2 pr-4">{t.description}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`${badge} ${
                            t.direction === 'CREDIT'
                              ? 'bg-green-50 text-[#1B5E3A]'
                              : t.direction === 'DEBIT'
                                ? 'bg-red-50 text-[#d03b3b]'
                                : 'bg-gray-50 text-gray-400'
                          }`}
                        >
                          {t.direction === 'CREDIT' ? 'เงินเข้า' : t.direction === 'DEBIT' ? 'เงินออก' : 'ไม่ทราบ'}
                        </span>
                      </td>
                      <td
                        className={`py-2 pr-4 text-right tabular-nums ${
                          t.direction === 'CREDIT'
                            ? 'text-[#1B5E3A]'
                            : t.direction === 'DEBIT'
                              ? 'text-[#d03b3b]'
                              : 'text-gray-700'
                        }`}
                      >
                        {formatThb(t.amount)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-gray-500">
                        {t.balance !== null ? formatThb(t.balance) : '-'}
                      </td>
                    </tr>
                  ))}
                  {result.transactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-sm text-gray-400">
                        ไม่พบรายการที่อ่านได้จากไฟล์นี้
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {result.unparsedLines.length > 0 && (
              <details className="mt-4 text-xs text-gray-400">
                <summary className={secondaryButton + ' inline-block cursor-pointer px-3 py-1'}>
                  แถวที่มีวันที่แต่อ่านจำนวนเงินไม่ได้ ({result.unparsedLines.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {result.unparsedLines.map((l, i) => (
                    <li key={i}>
                      หน้า {l.page}: {l.text}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </>
      )}
    </div>
  );
}
