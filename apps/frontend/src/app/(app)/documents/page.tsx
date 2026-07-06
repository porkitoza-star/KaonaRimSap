'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { Account, CostCenter, DocumentRecord } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { card, input, label, primaryButton, secondaryButton, dangerButton, errorBanner } from '@/lib/ui';
import { StatusBadge } from '@/components/status-badge';

const today = () => new Date().toISOString().slice(0, 10);

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

export default function DocumentsPage() {
  const { token, user } = useAuth();
  const canReview = user?.role === 'ACCOUNTANT' || user?.role === 'CFO' || user?.role === 'CEO';

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">เอกสาร / OCR</h1>
        <p className="text-sm text-gray-500">ถ่ายรูปหรืออัปโหลดบิล ระบบจะอ่านค่าด้วย AI ให้อัตโนมัติ</p>
      </div>

      {error && <p className={errorBanner}>{error}</p>}

      <div className={card}>
        <p className="text-xs font-medium text-gray-500">อัปโหลดเอกสารใหม่</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="text-sm text-gray-700"
          />
          <button onClick={handleUpload} disabled={uploading} className={primaryButton}>
            {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
          </button>
        </div>
      </div>

      <div className={card}>
        <div className="space-y-3">
          {documents.map((doc) => (
            <div key={doc.id} className="rounded-lg border border-gray-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {doc.ocrRawJson?.documentNumber ?? '(ยังไม่ระบุเลขที่เอกสาร)'}
                  </p>
                  <p className="text-xs text-gray-500">
                    อัปโหลดเมื่อ {formatDate(doc.createdAt)}
                    {doc.ocrRawJson?.contactName ? ` · ${doc.ocrRawJson.contactName}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={doc.status} />
                  {canReview && doc.status === 'PENDING_REVIEW' && (
                    <button
                      className={`${secondaryButton} px-3 py-1 text-xs`}
                      onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                    >
                      {expandedId === doc.id ? 'ปิด' : 'ตรวจสอบ'}
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
            </div>
          ))}
          {documents.length === 0 && <p className="py-4 text-center text-sm text-gray-400">ยังไม่มีเอกสาร</p>}
        </div>
      </div>
    </div>
  );
}
