'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { secondaryButton } from '@/lib/ui';

interface ImportResult {
  createdCount: number;
  errors: { row: number; reason: string }[];
}

export function ImportButton({
  path,
  label = 'นำเข้า Excel',
  onImported,
  onError,
}: {
  path: string;
  label?: string;
  onImported?: () => void;
  onError?: (message: string) => void;
}) {
  const { token } = useAuth();
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setImporting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post<ImportResult>(path, formData, token);
      setResult(res);
      onImported?.();
    } catch (err) {
      onError?.(err instanceof ApiError ? err.message : 'นำเข้าไฟล์ Excel ไม่สำเร็จ');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={importing}
        onClick={() => fileInputRef.current?.click()}
        className={`${secondaryButton} px-3 py-1 text-xs`}
      >
        {importing ? 'กำลังนำเข้า...' : label}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />
      {result && (
        <div className="text-xs">
          <p className="text-[#1B5E3A]">นำเข้าสำเร็จ {result.createdCount} รายการ</p>
          {result.errors.length > 0 && (
            <ul className="mt-1 max-w-xs list-disc space-y-0.5 pl-4 text-red-600">
              {result.errors.map((e, i) => (
                <li key={i}>
                  แถว {e.row}: {e.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
