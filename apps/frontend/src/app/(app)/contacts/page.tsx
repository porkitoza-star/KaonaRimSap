'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { Contact, ContactType } from '@/lib/types';
import { card, input, label, primaryButton, errorBanner } from '@/lib/ui';
import { ExportButton } from '@/components/export-button';

const CONTACT_TYPES: ContactType[] = ['CUSTOMER', 'SUPPLIER', 'CONTRACTOR', 'BOTH'];

export default function ContactsPage() {
  const { token, user } = useAuth();
  const canManage = user?.role === 'ACCOUNTANT' || user?.role === 'CFO' || user?.role === 'CEO';

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<ContactType>('CUSTOMER');
  const [taxId, setTaxId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  async function reload() {
    if (!token) return;
    try {
      setContacts(await api.get<Contact[]>('/contacts', token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดรายชื่อคู่ค้าไม่สำเร็จ');
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
        '/contacts',
        { name, type, taxId: taxId || undefined, phone: phone || undefined, email: email || undefined },
        token,
      );
      setName('');
      setTaxId('');
      setPhone('');
      setEmail('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'สร้างคู่ค้าไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">คู่ค้า</h1>
          <p className="text-sm text-gray-500">ลูกค้า ผู้รับเหมา และซัพพลายเออร์</p>
        </div>
        <ExportButton path="/contacts/export" filename="contacts.xlsx" onError={setError} />
      </div>

      {error && <p className={errorBanner}>{error}</p>}

      <div className={card}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="py-2 pr-4 font-medium">ชื่อ</th>
                <th className="py-2 pr-4 font-medium">ประเภท</th>
                <th className="py-2 pr-4 font-medium">เลขผู้เสียภาษี</th>
                <th className="py-2 font-medium">โทรศัพท์</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4">{c.name}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500">{c.type}</td>
                  <td className="py-2 pr-4 tabular-nums text-xs text-gray-500">{c.taxId ?? '-'}</td>
                  <td className="py-2 text-xs text-gray-500">{c.phone ?? '-'}</td>
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-sm text-gray-400">
                    ยังไม่มีคู่ค้า
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canManage && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3 border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-500">เพิ่มคู่ค้าใหม่</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>ชื่อ</label>
                <input className={input} value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label className={label}>ประเภท</label>
                <select className={input} value={type} onChange={(e) => setType(e.target.value as ContactType)}>
                  {CONTACT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>เลขผู้เสียภาษี</label>
                <input className={input} value={taxId} onChange={(e) => setTaxId(e.target.value)} />
              </div>
              <div>
                <label className={label}>โทรศัพท์</label>
                <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>อีเมล</label>
                <input
                  type="email"
                  className={input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" disabled={submitting} className={primaryButton}>
              {submitting ? 'กำลังบันทึก...' : 'เพิ่มคู่ค้า'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
