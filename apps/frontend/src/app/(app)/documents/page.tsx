'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { Account, CostCenter, DocumentCategory, DocumentRecord } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { card, input, label, primaryButton, secondaryButton, dangerButton, errorBanner } from '@/lib/ui';
import { StatusBadge } from '@/components/status-badge';
import { ExportButton } from '@/components/export-button';

const today = () => new Date().toISOString().slice(0, 10);

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  BILL: 'บิล/ใบกำกับภาษี (อ่านค่าอัตโนมัติ)',
  BOQ: 'BOQ (รายการวัสดุ/ปริมาณงาน)',
  PERMIT: 'ใบขออนุญาตก่อสร้าง',
  BLUEPRINT: 'แบบพิมพ์เขียว',
  PURCHASE_ORDER: 'ใบสั่งซื้อวัสดุ',
  PHOTO: 'รูปถ่ายหน้างาน',
  OTHER: 'อื่นๆ',
};

const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as DocumentCategory[];

function ReviewForm({
  doc,
  costCenters,
  accounts,
  token,
  onDone,
}: {
  doc: DocumentRecord;
  costCenters: CostCenter[];
  accounts: Account[];
  token: string;
  onDone: () => void;
}) {
  const ocr = doc.ocrRawJson ?? {};
  const [documentNumber, setDocumentNumber] = useState(ocr.documentNumber ?? '');
  const [issueDate, setIssueDate] = useState(ocr.issueDate ?? today());
  const [dueDate, setDueDate] = useState(today());
  const [contactName, setContactName] = useState(ocr.contactName ?? '');
  const [contactTaxId, setContactTaxId] = useState(ocr.taxId ?? '');
  const [subtotal, setSubtotal] = useState(ocr.subtotal?.toString() ?? '');
  const [vatAmount, setVatAmount] = useState(ocr.vatAmount?.toString() ?? '0');
  const [whtAmount, setWhtAmount] = useState('0');
  const [costCenterId, setCostCenterId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [workCategory, setWorkCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post(
        `/documents/${doc.id}/confirm`,
        {
          documentNumber,
          issueDate,
          dueDate,
          contactName,
          contactTaxId: contactTaxId || undefined,
          subtotal: Number(subtotal),
          vatAmount: Number(vatAmount),
          whtAmount: Number(whtAmount),
          costCenterId,
          accountId,
          workCategory: workCategory || undefined,
        },
        token,
      );
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ยืนยันเอกสารไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/documents/${doc.id}/reject`, { notes: 'ปฏิเสธจากหน้าตรวจสอบเอกสาร' }, token);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ปฏิเสธเอกสารไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleConfirm} className="mt-3 space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
      {error && <p className={errorBanner}>{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>เลขที่เอกสาร</label>
          <input className={input} value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} required />
        </div>
        <div>
          <label className={label}>ชื่อคู่ค้า</label>
          <input className={input} value={contactName} onChange={(e) => setContactName(e.target.value)} required />
        </div>
        <div>
          <label className={label}>วันที่ออกเอกสาร</label>
          <input type="date" className={input} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
        </div>
        <div>
          <label className={label}>ครบกำหนดจ่าย</label>
          <input type="date" className={input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>
        <div>
          <label className={label}>เลขผู้เสียภาษี</label>
          <input className={input} value={contactTaxId} onChange={(e) => setContactTaxId(e.target.value)} />
        </div>
        <div />
        <div>
          <label className={label}>ยอดก่อน VAT</label>
          <input
            type="number"
            step="0.01"
            className={input}
            value={subtotal}
            onChange={(e) => setSubtotal(e.target.value)}
            required
          />
        </div>
        <div>
          <label className={label}>VAT</label>
          <input type="number" step="0.01" className={input} value={vatAmount} onChange={(e) => setVatAmount(e.target.value)} />
        </div>
        <div>
          <label className={label}>หัก ณ ที่จ่าย</label>
          <input type="number" step="0.01" className={input} value={whtAmount} onChange={(e) => setWhtAmount(e.target.value)} />
        </div>
        <div>
          <label className={label}>Cost Center</label>
          <select className={input} value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)} required>
            <option value="">-- เลือก --</option>
            {costCenters.map((cc) => (
              <option key={cc.id} value={cc.id}>
                {cc.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>บัญชีค่าใช้จ่าย/ต้นทุน</label>
          <select className={input} value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
            <option value="">-- เลือก --</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} {acc.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>หมวดงาน (ไม่บังคับ)</label>
          <input
            className={input}
            placeholder="เช่น งานหน้าต่าง, งานฉาบ, จิปาถะ"
            value={workCategory}
            onChange={(e) => setWorkCategory(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className={primaryButton}>
          {submitting ? 'กำลังบันทึก...' : 'ยืนยันและสร้างบิล'}
        </button>
        <button type="button" disabled={submitting} onClick={handleReject} className={dangerButton}>
          ปฏิเสธเอกสาร
        </button>
      </div>
    </form>
  );
}

function BoqItemsPanel({
  doc,
  costCenters,
  token,
  onDone,
}: {
  doc: DocumentRecord;
  costCenters: CostCenter[];
  token: string;
  onDone: () => void;
}) {
  const items = doc.ocrRawJson?.items ?? [];
  const [costCenterId, setCostCenterId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleImport() {
    if (!costCenterId) {
      setError('กรุณาเลือก Cost Center ก่อนนำเข้า');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ createdCount: number }>(
        `/documents/${doc.id}/import-boq-items`,
        {
          costCenterId,
          items: items.map((it) => ({
            category: it.category,
            name: it.name,
            unit: it.unit,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          })),
        },
        token,
      );
      setResult(`นำเข้าเป็นรายการวัสดุแล้ว ${res.createdCount} รายการ`);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'นำเข้ารายการไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
      {error && <p className={errorBanner}>{error}</p>}
      {result && <p className="text-sm text-green-700">{result}</p>}
      <p className="text-xs font-medium text-gray-500">รายการที่อ่านได้จากเอกสาร ({items.length} รายการ)</p>
      <div className="max-h-64 overflow-y-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-100 text-gray-500">
            <tr>
              <th className="px-2 py-1">หมวดงาน</th>
              <th className="px-2 py-1">รายการ</th>
              <th className="px-2 py-1">หน่วย</th>
              <th className="px-2 py-1 text-right">ปริมาณ</th>
              <th className="px-2 py-1 text-right">ราคา/หน่วย</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-2 py-1">{it.category ?? '-'}</td>
                <td className="px-2 py-1">{it.name}</td>
                <td className="px-2 py-1">{it.unit ?? '-'}</td>
                <td className="px-2 py-1 text-right">{it.quantity ?? '-'}</td>
                <td className="px-2 py-1 text-right">{it.unitPrice ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${input} mt-0 max-w-xs`} value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
          <option value="">-- เลือก Cost Center --</option>
          {costCenters.map((cc) => (
            <option key={cc.id} value={cc.id}>
              {cc.name}
            </option>
          ))}
        </select>
        <button onClick={handleImport} disabled={submitting} className={primaryButton}>
          {submitting ? 'กำลังนำเข้า...' : 'นำเข้าเป็นรายการวัสดุ (BOQ)'}
        </button>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const { token, user } = useAuth();
  const canReview = user?.role === 'ACCOUNTANT' || user?.role === 'CFO' || user?.role === 'CEO';

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('BILL');
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'ALL'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [boqExpandedId, setBoqExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function reload() {
    if (!token) return;
    try {
      const [docsRes, ccRes, accRes] = await Promise.all([
        api.get<DocumentRecord[]>('/documents', token),
        api.get<CostCenter[]>('/cost-centers', token),
        api.get<Account[]>('/chart-of-accounts', token),
      ]);
      setDocuments(docsRes);
      setCostCenters(ccRes);
      setAccounts(accRes.filter((a) => a.type === 'EXPENSE' || a.type === 'ASSET'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดรายการเอกสารไม่สำเร็จ');
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleUpload() {
    if (!token || !fileInputRef.current?.files?.[0]) return;
    const formData = new FormData();
    formData.append('file', fileInputRef.current.files[0]);
    formData.append('category', uploadCategory);
    setUploading(true);
    setError(null);
    try {
      await api.post('/documents/upload', formData, token);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'อัปโหลดเอกสารไม่สำเร็จ');
    } finally {
      setUploading(false);
    }
  }

  const visibleDocuments =
    categoryFilter === 'ALL' ? documents : documents.filter((d) => d.category === categoryFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">เอกสาร / OCR</h1>
          <p className="text-sm text-gray-500">
            ถ่ายรูปหรืออัปโหลดบิล BOQ ใบขออนุญาต แบบพิมพ์เขียว ใบสั่งซื้อ หรือรูปหน้างาน
          </p>
        </div>
        <ExportButton path="/documents/export" filename="documents.xlsx" onError={setError} />
      </div>

      {error && <p className={errorBanner}>{error}</p>}

      <div className={card}>
        <p className="text-xs font-medium text-gray-500">อัปโหลดเอกสารใหม่</p>
        <div className="mt-3 space-y-3">
          <div>
            <label className={label}>ประเภทเอกสาร</label>
            <select
              className={input}
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="text-sm text-gray-700"
            />
            <button onClick={handleUpload} disabled={uploading} className={primaryButton}>
              {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
            </button>
          </div>
          {uploadCategory !== 'BILL' && (
            <p className="text-xs text-gray-400">
              เอกสารประเภทนี้จะถูกเก็บไว้เป็นไฟล์อ้างอิงทันที ไม่ต้องผ่านขั้นตอนตรวจสอบ/สร้างบิล
            </p>
          )}
        </div>
      </div>

      <div className={card}>
        <div className="mb-3 flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">กรองตามประเภท:</label>
          <select
            className={`${input} mt-0 max-w-xs`}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as DocumentCategory | 'ALL')}
          >
            <option value="ALL">ทั้งหมด</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-3">
          {visibleDocuments.map((doc) => (
            <div key={doc.id} className="rounded-lg border border-gray-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {doc.ocrRawJson?.documentNumber ?? CATEGORY_LABELS[doc.category]}
                  </p>
                  <p className="text-xs text-gray-500">
                    อัปโหลดเมื่อ {formatDate(doc.createdAt)}
                    {doc.ocrRawJson?.contactName ? ` · ${doc.ocrRawJson.contactName}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                    {CATEGORY_LABELS[doc.category]}
                  </span>
                  <StatusBadge status={doc.status} />
                  {canReview && doc.status === 'PENDING_REVIEW' && (
                    <button
                      className={`${secondaryButton} px-3 py-1 text-xs`}
                      onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                    >
                      {expandedId === doc.id ? 'ปิด' : 'ตรวจสอบ'}
                    </button>
                  )}
                  {canReview && doc.category === 'BOQ' && (doc.ocrRawJson?.items?.length ?? 0) > 0 && (
                    <button
                      className={`${secondaryButton} px-3 py-1 text-xs`}
                      onClick={() => setBoqExpandedId(boqExpandedId === doc.id ? null : doc.id)}
                    >
                      {boqExpandedId === doc.id
                        ? 'ปิด'
                        : `ดูรายการ (${doc.ocrRawJson?.items?.length}) / นำเข้า`}
                    </button>
                  )}
                </div>
              </div>
              {expandedId === doc.id && token && (
                <ReviewForm
                  doc={doc}
                  costCenters={costCenters}
                  accounts={accounts}
                  token={token}
                  onDone={() => {
                    setExpandedId(null);
                    reload();
                  }}
                />
              )}
              {boqExpandedId === doc.id && token && (
                <BoqItemsPanel
                  doc={doc}
                  costCenters={costCenters}
                  token={token}
                  onDone={() => reload()}
                />
              )}
            </div>
          ))}
          {visibleDocuments.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">ยังไม่มีเอกสาร</p>
          )}
        </div>
      </div>
    </div>
  );
}
