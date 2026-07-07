'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { downloadExport } from '@/lib/download';
import { secondaryButton } from '@/lib/ui';

export function ExportButton({
  path,
  filename,
  label = 'ส่งออก Excel',
  onError,
}: {
  path: string;
  filename: string;
  label?: string;
  onError?: (message: string) => void;
}) {
  const { token } = useAuth();
  const [exporting, setExporting] = useState(false);

  async function handleClick() {
    if (!token) return;
    setExporting(true);
    try {
      await downloadExport(path, token, filename);
    } catch {
      onError?.('ส่งออกไฟล์ Excel ไม่สำเร็จ');
    } finally {
      setExporting(false);
    }
  }

  return (
    <button onClick={handleClick} disabled={exporting} className={`${secondaryButton} px-3 py-1 text-xs`}>
      {exporting ? 'กำลังส่งออก...' : label}
    </button>
  );
}
