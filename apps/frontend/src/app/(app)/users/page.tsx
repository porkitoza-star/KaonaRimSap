'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { Role, UserRecord } from '@/lib/types';
import { card, errorBanner } from '@/lib/ui';

const ROLES: Role[] = ['CEO', 'CFO', 'ACCOUNTANT', 'PROJECT_MANAGER', 'VIEWER'];

const ROLE_LABELS: Record<Role, string> = {
  CEO: 'CEO',
  CFO: 'CFO',
  ACCOUNTANT: 'ผู้ทำบัญชี',
  PROJECT_MANAGER: 'ผู้จัดการโครงการ',
  VIEWER: 'ดูอย่างเดียว',
};

export default function UsersPage() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function reload() {
    if (!token) return;
    try {
      setUsers(await api.get<UserRecord[]>('/users', token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดรายชื่อผู้ใช้งานไม่สำเร็จ');
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleRoleChange(id: string, role: Role) {
    if (!token) return;
    setSavingId(id);
    setError(null);
    try {
      await api.patch(`/users/${id}/role`, { role }, token);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'เปลี่ยนสิทธิ์ไม่สำเร็จ');
    } finally {
      setSavingId(null);
    }
  }

  if (user?.role !== 'CEO') {
    return <p className={errorBanner}>เฉพาะ CEO เท่านั้นที่จัดการผู้ใช้งานได้</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">จัดการผู้ใช้งาน</h1>
        <p className="text-sm text-gray-500">
          บัญชีที่สมัครใหม่จะได้สิทธิ์ &quot;ดูอย่างเดียว&quot; ก่อน ปรับสิทธิ์ที่นี่ได้
        </p>
      </div>

      {error && <p className={errorBanner}>{error}</p>}

      <div className={card}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="py-2 pr-4 font-medium">ชื่อ</th>
                <th className="py-2 pr-4 font-medium">อีเมล</th>
                <th className="py-2 pr-4 font-medium">สิทธิ์</th>
                <th className="py-2 font-medium">สมัครเมื่อ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4">{u.name}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500">{u.email}</td>
                  <td className="py-2 pr-4">
                    <select
                      value={u.role}
                      disabled={savingId === u.id || u.id === user.id}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-[#1B5E3A] focus:outline-none focus:ring-1 focus:ring-[#1B5E3A] disabled:opacity-60"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 text-xs text-gray-500">
                    {new Date(u.createdAt).toLocaleDateString('th-TH')}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-sm text-gray-400">
                    ยังไม่มีผู้ใช้งาน
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
