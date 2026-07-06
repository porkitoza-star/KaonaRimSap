'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { Account, AccountType, CostCenter, CostCenterType } from '@/lib/types';
import { card, input, label, primaryButton, errorBanner } from '@/lib/ui';

const COST_CENTER_TYPES: CostCenterType[] = ['PROJECT', 'HOUSE', 'OVERHEAD'];
const ACCOUNT_TYPES: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

export default function CostCentersPage() {
  const { token, user } = useAuth();
  const canManage = user?.role === 'CFO' || user?.role === 'CEO';

  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [ccName, setCcName] = useState('');
  const [ccType, setCcType] = useState<CostCenterType>('PROJECT');
  const [ccParentId, setCcParentId] = useState('');
  const [ccSubmitting, setCcSubmitting] = useState(false);

  const [accCode, setAccCode] = useState('');
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType>('EXPENSE');
  const [accSubmitting, setAccSubmitting] = useState(false);

  async function reload() {
    if (!token) return;
    try {
      const [ccRes, accRes] = await Promise.all([
        api.get<CostCenter[]>('/cost-centers', token),
        api.get<Account[]>('/chart-of-accounts', token),
      ]);
      setCostCenters(ccRes);
      setAccounts(accRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreateCostCenter(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCcSubmitting(true);
    setError(null);
    try {
      await api.post(
        '/cost-centers',
        { name: ccName, type: ccType, parentId: ccParentId || undefined },
        token,
      );
      setCcName('');
      setCcParentId('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'สร้าง Cost Center ไม่สำเร็จ');
    } finally {
      setCcSubmitting(false);
    }
  }

  async function handleCreateAccount(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setAccSubmitting(true);
    setError(null);
    try {
      await api.post('/chart-of-accounts', { code: accCode, name: accName, type: accType }, token);
      setAccCode('');
      setAccName('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'สร้างผังบัญชีไม่สำเร็จ');
    } finally {
      setAccSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">ผังบัญชี และ Cost Center</h1>
        <p className="text-sm text-gray-500">โครงสร้างบัญชีและศูนย์ต้นทุนของบริษัท</p>
      </div>

      {error && <p className={errorBanner}>{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={card}>
          <h2 className="text-sm font-semibold text-gray-900">Cost Center (โครงการ / บ้าน / ส่วนกลาง)</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="py-2 pr-4 font-medium">ชื่อ</th>
                  <th className="py-2 font-medium">ประเภท</th>
                </tr>
              </thead>
              <tbody>
                {costCenters.map((cc) => (
                  <tr key={cc.id} className="border-b border-gray-50">
                    <td className="py-2 pr-4">{cc.name}</td>
                    <td className="py-2 text-xs text-gray-500">{cc.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canManage && (
            <form onSubmit={handleCreateCostCenter} className="mt-6 space-y-3 border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500">เพิ่ม Cost Center ใหม่</p>
              <div>
                <label className={label}>ชื่อ</label>
                <input className={input} value={ccName} onChange={(e) => setCcName(e.target.value)} required />
              </div>
              <div>
                <label className={label}>ประเภท</label>
                <select
                  className={input}
                  value={ccType}
                  onChange={(e) => setCcType(e.target.value as CostCenterType)}
                >
                  {COST_CENTER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>โครงการแม่ (ถ้ามี)</label>
                <select className={input} value={ccParentId} onChange={(e) => setCcParentId(e.target.value)}>
                  <option value="">-- ไม่มี --</option>
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={ccSubmitting} className={primaryButton}>
                {ccSubmitting ? 'กำลังบันทึก...' : 'เพิ่ม Cost Center'}
              </button>
            </form>
          )}
        </div>

        <div className={card}>
          <h2 className="text-sm font-semibold text-gray-900">ผังบัญชี (Chart of Accounts)</h2>
          <div className="mt-4 max-h-96 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="sticky top-0 border-b border-gray-100 bg-white text-xs text-gray-500">
                  <th className="py-2 pr-4 font-medium">รหัส</th>
                  <th className="py-2 pr-4 font-medium">ชื่อบัญชี</th>
                  <th className="py-2 font-medium">ประเภท</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr key={acc.id} className="border-b border-gray-50">
                    <td className="py-2 pr-4 tabular-nums">{acc.code}</td>
                    <td className="py-2 pr-4">{acc.name}</td>
                    <td className="py-2 text-xs text-gray-500">{acc.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canManage && (
            <form onSubmit={handleCreateAccount} className="mt-6 space-y-3 border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500">เพิ่มบัญชีใหม่</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>รหัสบัญชี</label>
                  <input className={input} value={accCode} onChange={(e) => setAccCode(e.target.value)} required />
                </div>
                <div>
                  <label className={label}>ประเภท</label>
                  <select
                    className={input}
                    value={accType}
                    onChange={(e) => setAccType(e.target.value as AccountType)}
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={label}>ชื่อบัญชี</label>
                <input className={input} value={accName} onChange={(e) => setAccName(e.target.value)} required />
              </div>
              <button type="submit" disabled={accSubmitting} className={primaryButton}>
                {accSubmitting ? 'กำลังบันทึก...' : 'เพิ่มบัญชี'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
