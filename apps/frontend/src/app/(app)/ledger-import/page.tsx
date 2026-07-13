'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { formatThb, formatDate } from '@/lib/format';
import { card, primaryButton, goodButton, secondaryButton, errorBanner, label } from '@/lib/ui';
import type { LedgerImportPreview, LedgerImportCommitResult, LedgerImportLogEntry } from '@/lib/types';

export default function LedgerImportPage() {
  const { token, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<LedgerImportPreview | null>(null);
  const [commitResult, setCommitResult] = useState<LedgerImportCommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateChoice, setDuplicateChoice] = useState<'skip' | 'force'>('skip');
  const [history, setHistory] = useState<LedgerImportLogEntry[]>([]);

  const canPreview = user?.role === 'ACCOUNTANT' || user?.role === 'CFO' || user?.role === 'CEO';
  const canCommit = user?.role === 'CEO';

  async function loadHistory() {
    if (!token) return;
    try {
      setHistory(await api.get<LedgerImportLogEntry[]>('/ledger-import/history', token));
    } catch {
      // history is a convenience view — silently ignore load failures here
    }
  }

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function getSelectedFile(): File | null {
    return fileInputRef.current?.files?.[0] ?? null;
  }

  async function handlePreview() {
    const file = getSelectedFile();
    if (!file || !token) return;
    setPreviewing(true);
    setError(null);
    setPreview(null);
    setCommitResult(null);
    setDuplicateChoice('skip');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post<LedgerImportPreview>('/ledger-import/preview', formData, token);
      setPreview(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ตรวจสอบไฟล์ไม่สำเร็จ');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleCommit() {
    const file = getSelectedFile();
    if (!file || !token) return;
    setCommitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('forceDuplicates', duplicateChoice === 'force' ? 'true' : 'false');
      const res = await api.post<LedgerImportCommitResult>('/ledger-import/commit', formData, token);
      setCommitResult(res);
      setPreview(null);
      await loadHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'นำเข้าข้อมูลจริงไม่สำเร็จ');
    } finally {
      setCommitting(false);
    }
  }

  if (!canPreview) {
    return <p className={errorBanner}>เฉพาะฝ่ายบัญชี, CFO หรือ CEO เท่านั้นที่เข้าถึงหน้านี้ได้</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">นำเข้าบัญชีรายรับ-รายจ่ายจาก Excel</h1>
        <p className="text-sm text-gray-500">
          อัปโหลดไฟล์ Excel บัญชีรายรับ-รายจ่ายของบริษัท ระบบจะตรวจสอบและสรุปรายการก่อน
          จากนั้น CEO เท่านั้นที่สามารถกดยืนยันเพื่อนำเข้าเป็นบิล/ใบแจ้งหนี้/การชำระเงินจริงในระบบ
        </p>
      </div>

      {error && <p className={errorBanner}>{error}</p>}

      <div className={`${card} space-y-3`}>
        <label className={label}>เลือกไฟล์ Excel (.xlsx, .xls)</label>
        <label
          htmlFor="ledger-import-file"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600 transition hover:border-[#1B5E3A] hover:bg-gray-100"
        >
          <span className="text-2xl">📎</span>
          <span className="font-medium">{fileName ?? 'แตะเพื่อเลือกไฟล์ Excel'}</span>
          {!fileName && <span className="text-xs text-gray-400">รองรับไฟล์ .xlsx และ .xls</span>}
        </label>
        <input
          id="ledger-import-file"
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            setFileName(e.target.files?.[0]?.name ?? null);
            setPreview(null);
            setCommitResult(null);
          }}
          className="sr-only"
        />
        <button
          type="button"
          disabled={!fileName || previewing}
          onClick={handlePreview}
          className={primaryButton}
        >
          {previewing ? 'กำลังตรวจสอบ...' : 'ตรวจสอบข้อมูลก่อนนำเข้า'}
        </button>
        <p className="text-xs text-gray-400">
          ขั้นตอนนี้เป็นการตรวจสอบเท่านั้น ยังไม่มีการบันทึกข้อมูลใด ๆ ลงระบบ
        </p>
      </div>

      {preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className={card}>
              <p className="text-xs text-gray-500">รายการรายจ่าย (บิล)</p>
              <p className="mt-1 text-lg font-semibold">{preview.billCount.toLocaleString('th-TH')}</p>
              <p className="text-xs text-gray-400">{formatThb(preview.totalBillAmount)}</p>
            </div>
            <div className={card}>
              <p className="text-xs text-gray-500">รายการรายรับ (ใบแจ้งหนี้)</p>
              <p className="mt-1 text-lg font-semibold">{preview.invoiceCount.toLocaleString('th-TH')}</p>
              <p className="text-xs text-gray-400">{formatThb(preview.totalInvoiceAmount)}</p>
            </div>
            <div className={card}>
              <p className="text-xs text-gray-500">Cost Center ที่จะสร้างใหม่</p>
              <p className="mt-1 text-lg font-semibold">{preview.costCentersToCreate.length.toLocaleString('th-TH')}</p>
            </div>
            <div className={card}>
              <p className="text-xs text-gray-500">รายการข้าม / ผิดปกติ</p>
              <p className="mt-1 text-lg font-semibold">
                {(preview.skippedCount + preview.errorCount).toLocaleString('th-TH')}
              </p>
            </div>
          </div>

          {(preview.materialInvoiceCount > 0 || preview.laborInvoiceCount > 0) && (
            <div className={`${card} space-y-1`}>
              <p className="text-sm font-medium text-gray-700">
                ทะเบียนใบแจ้งหนี้ผู้จำหน่าย (ชีท &quot;ค่าของ&quot;/&quot;ค่าแรง&quot;) — ใช้แสดงกราฟค่าแรง/ค่าวัสดุบน Dashboard เท่านั้น
                ไม่สร้างเป็นบิลซ้ำกับรายการด้านบน
              </p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-gray-500">ใบแจ้งหนี้ค่าวัสดุ</p>
                  <p className="mt-1 text-lg font-semibold">{preview.materialInvoiceCount.toLocaleString('th-TH')}</p>
                  <p className="text-xs text-gray-400">{formatThb(preview.totalMaterialAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">ใบแจ้งหนี้ค่าแรง</p>
                  <p className="mt-1 text-lg font-semibold">{preview.laborInvoiceCount.toLocaleString('th-TH')}</p>
                  <p className="text-xs text-gray-400">{formatThb(preview.totalLaborAmount)}</p>
                </div>
              </div>
            </div>
          )}

          {preview.costCentersToCreate.length > 0 && (
            <div className={card}>
              <p className="mb-2 text-sm font-medium text-gray-700">Cost Center ที่จะถูกสร้าง</p>
              <div className="flex flex-wrap gap-2">
                {preview.costCentersToCreate.map((c, i) => (
                  <span key={i} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                    {c.name} ({c.type})
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className={card}>
            <p className="mb-2 text-sm font-medium text-gray-700">ตัวอย่างรายการรายจ่าย (สูงสุด 15 รายการ)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="py-2 pr-4 font-medium">วันที่</th>
                    <th className="py-2 pr-4 font-medium">บ้าน/โครงการ</th>
                    <th className="py-2 pr-4 font-medium">หมวด</th>
                    <th className="py-2 pr-4 font-medium">รายการ</th>
                    <th className="py-2 pr-4 text-right font-medium">จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleBills.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-sm text-gray-400">
                        ไม่มีรายการรายจ่าย
                      </td>
                    </tr>
                  )}
                  {preview.sampleBills.map((b, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 pr-4">{b.date ? formatDate(b.date) : '-'}</td>
                      <td className="py-2 pr-4">{b.house || '-'}</td>
                      <td className="py-2 pr-4">{b.category || '-'}</td>
                      <td className="py-2 pr-4">{b.description}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatThb(b.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={card}>
            <p className="mb-2 text-sm font-medium text-gray-700">ตัวอย่างรายการรายรับ (สูงสุด 15 รายการ)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="py-2 pr-4 font-medium">วันที่</th>
                    <th className="py-2 pr-4 font-medium">บ้าน/โครงการ</th>
                    <th className="py-2 pr-4 font-medium">รายการ</th>
                    <th className="py-2 pr-4 text-right font-medium">จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleInvoices.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-sm text-gray-400">
                        ไม่มีรายการรายรับ
                      </td>
                    </tr>
                  )}
                  {preview.sampleInvoices.map((inv, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 pr-4">{inv.date ? formatDate(inv.date) : '-'}</td>
                      <td className="py-2 pr-4">{inv.house || '-'}</td>
                      <td className="py-2 pr-4">{inv.description}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatThb(inv.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {(preview.duplicateBillCount > 0 || preview.duplicateInvoiceCount > 0) && (
            <div className={`${card} space-y-3 border border-[#B8860B]/40 bg-[#B8860B]/5`}>
              <p className="text-sm font-medium text-gray-900">
                พบรายการที่ดูซ้ำกับข้อมูลที่มีอยู่แล้ว {preview.duplicateBillCount + preview.duplicateInvoiceCount}{' '}
                รายการ (บิล {preview.duplicateBillCount.toLocaleString('th-TH')}, ใบแจ้งหนี้{' '}
                {preview.duplicateInvoiceCount.toLocaleString('th-TH')})
              </p>
              <p className="text-xs text-gray-500">
                ระบบเทียบจาก Cost Center + รายละเอียด + จำนวนเงินที่ตรงกันทุกอย่าง เลือกวิธีจัดการก่อนยืนยันนำเข้า
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setDuplicateChoice('skip')}
                  className={duplicateChoice === 'skip' ? primaryButton : secondaryButton}
                >
                  ข้ามรายการซ้ำ (แนะนำ)
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateChoice('force')}
                  className={duplicateChoice === 'force' ? primaryButton : secondaryButton}
                >
                  นำเข้าซ้ำเป็นรายการเพิ่มเติมทั้งหมด
                </button>
              </div>
            </div>
          )}

          {(preview.skipped.length > 0 || preview.errors.length > 0) && (
            <div className={card}>
              <p className="mb-2 text-sm font-medium text-gray-700">รายการที่ข้ามหรือต้องตรวจสอบเอง</p>
              {preview.skipped.map((s, i) => (
                <p key={`s${i}`} className="rounded bg-[#fab219]/15 px-2 py-1 text-xs text-[#946600]">
                  ข้าม: {s.sheet} แถว {s.row} — {s.reason}
                </p>
              ))}
              {preview.errors.map((e, i) => (
                <p key={`e${i}`} className="mt-1 rounded bg-[#d03b3b]/15 px-2 py-1 text-xs text-[#a02f2f]">
                  ผิดปกติ: {e.sheet} แถว {e.row} — {e.reason}
                </p>
              ))}
            </div>
          )}

          {canCommit ? (
            <div className={`${card} space-y-3`}>
              <p className="text-sm font-medium text-gray-900">
                ยืนยันนำเข้าข้อมูลจริง ({preview.billCount + preview.invoiceCount} รายการ)
              </p>
              <p className="text-xs text-gray-500">
                การกดยืนยันจะสร้างบิล/ใบแจ้งหนี้/การชำระเงินจริงในระบบทันที กรุณาตรวจสอบตัวอย่างข้อมูลด้านบนก่อนกด
              </p>
              <button type="button" disabled={committing} onClick={handleCommit} className={goodButton}>
                {committing ? 'กำลังนำเข้าข้อมูลจริง...' : 'ยืนยันนำเข้าข้อมูลจริงเข้าสู่ระบบ'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">เฉพาะ CEO เท่านั้นที่สามารถยืนยันนำเข้าข้อมูลจริงได้</p>
          )}
        </div>
      )}

      {commitResult && (
        <div className={`${card} space-y-2`}>
          <p className="text-sm font-medium text-[#1B5E3A]">นำเข้าข้อมูลจริงสำเร็จ</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">บิลที่สร้าง</p>
              <p className="text-lg font-semibold">{commitResult.createdBills.toLocaleString('th-TH')}</p>
              {commitResult.duplicateBills > 0 && (
                <p className="text-xs text-gray-400">
                  ข้ามรายการซ้ำ {commitResult.duplicateBills.toLocaleString('th-TH')} รายการ
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500">ใบแจ้งหนี้ที่สร้าง</p>
              <p className="text-lg font-semibold">{commitResult.createdInvoices.toLocaleString('th-TH')}</p>
              {commitResult.duplicateInvoices > 0 && (
                <p className="text-xs text-gray-400">
                  ข้ามรายการซ้ำ {commitResult.duplicateInvoices.toLocaleString('th-TH')} รายการ
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500">Cost Center ใหม่</p>
              <p className="text-lg font-semibold">{commitResult.costCentersCreated.toLocaleString('th-TH')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">คู่ค้าใหม่</p>
              <p className="text-lg font-semibold">{commitResult.contactsCreated.toLocaleString('th-TH')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">ใบแจ้งหนี้ค่าแรง/ค่าวัสดุที่บันทึก</p>
              <p className="text-lg font-semibold">{commitResult.createdSupplierInvoices.toLocaleString('th-TH')}</p>
              {commitResult.duplicateSupplierInvoices > 0 && (
                <p className="text-xs text-gray-400">
                  ข้ามรายการซ้ำ {commitResult.duplicateSupplierInvoices.toLocaleString('th-TH')} รายการ
                </p>
              )}
            </div>
          </div>
          {commitResult.errors.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-gray-700">รายการที่นำเข้าไม่สำเร็จ</p>
              {commitResult.errors.map((e, i) => (
                <p key={i} className="rounded bg-[#d03b3b]/15 px-2 py-1 text-xs text-[#a02f2f]">
                  {e.context} — {e.reason}
                </p>
              ))}
            </div>
          )}
          <button type="button" onClick={() => setCommitResult(null)} className={secondaryButton}>
            ปิด
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div className={card}>
          <p className="mb-2 text-sm font-medium text-gray-700">ประวัติการนำเข้าไฟล์ (เก็บไว้ทุกครั้ง)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="py-2 pr-4 font-medium">วันที่นำเข้า</th>
                  <th className="py-2 pr-4 font-medium">ไฟล์</th>
                  <th className="py-2 pr-4 text-right font-medium">บิลที่สร้าง</th>
                  <th className="py-2 pr-4 text-right font-medium">ใบแจ้งหนี้ที่สร้าง</th>
                  <th className="py-2 pr-4 text-right font-medium">ข้ามซ้ำ</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-gray-50">
                    <td className="py-2 pr-4 text-xs text-gray-500">{formatDate(h.uploadedAt)}</td>
                    <td className="py-2 pr-4">{h.fileName}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{h.billCount.toLocaleString('th-TH')}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{h.invoiceCount.toLocaleString('th-TH')}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-gray-500">
                      {(h.duplicateBillCount + h.duplicateInvoiceCount).toLocaleString('th-TH')}
                      {h.forcedDuplicates ? ' (นำเข้าซ้ำ)' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
