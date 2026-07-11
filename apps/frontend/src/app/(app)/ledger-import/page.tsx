'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { formatThb, formatDate } from '@/lib/format';
import { card, primaryButton, dangerButton, secondaryButton, errorBanner, input, label } from '@/lib/ui';
import type { LedgerImportPreview, LedgerImportCommitResult } from '@/lib/types';

const CONFIRM_PHRASE = 'ยืนยันนำเข้า';

export default function LedgerImportPage() {
  const { token, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<LedgerImportPreview | null>(null);
  const [commitResult, setCommitResult] = useState<LedgerImportCommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const canPreview = user?.role === 'ACCOUNTANT' || user?.role === 'CFO' || user?.role === 'CEO';
  const canCommit = user?.role === 'CEO';

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
    if (!file || !token || confirmText !== CONFIRM_PHRASE) return;
    setCommitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post<LedgerImportCommitResult>('/ledger-import/commit', formData, token);
      setCommitResult(res);
      setPreview(null);
      setConfirmText('');
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
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            setFileName(e.target.files?.[0]?.name ?? null);
            setPreview(null);
            setCommitResult(null);
          }}
          className="block text-sm"
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
            <div className={`${card} space-y-3 border border-[#d03b3b]/30`}>
              <p className="text-sm font-medium text-gray-900">
                ยืนยันนำเข้าข้อมูลจริง ({preview.billCount + preview.invoiceCount} รายการ)
              </p>
              <p className="text-xs text-gray-500">
                การกดยืนยันจะสร้างบิล/ใบแจ้งหนี้/การชำระเงินจริงในระบบทันทีและ<b>ไม่สามารถย้อนกลับได้</b>
                กรุณาตรวจสอบตัวอย่างข้อมูลด้านบนให้ครบถ้วนก่อน หากถูกต้องแล้ว
                ให้พิมพ์คำว่า &quot;{CONFIRM_PHRASE}&quot; ในช่องด้านล่างเพื่อปลดล็อกปุ่มยืนยัน
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                className={input}
              />
              <button
                type="button"
                disabled={confirmText !== CONFIRM_PHRASE || committing}
                onClick={handleCommit}
                className={dangerButton}
              >
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
            </div>
            <div>
              <p className="text-xs text-gray-500">ใบแจ้งหนี้ที่สร้าง</p>
              <p className="text-lg font-semibold">{commitResult.createdInvoices.toLocaleString('th-TH')}</p>
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
    </div>
  );
}
