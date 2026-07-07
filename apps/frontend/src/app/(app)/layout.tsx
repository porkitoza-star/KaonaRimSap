'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAuth } from '@/lib/require-auth';
import { useAuth } from '@/lib/auth-context';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'แดชบอร์ด' },
  { href: '/cost-centers', label: 'ผังบัญชี / Cost Center' },
  { href: '/contacts', label: 'คู่ค้า' },
  { href: '/invoices', label: 'ใบแจ้งหนี้ (AR)' },
  { href: '/bills', label: 'บิล (AP)' },
  { href: '/documents', label: 'เอกสาร / OCR' },
  { href: '/materials', label: 'วัสดุก่อสร้าง / สต๊อก' },
  { href: '/payments', label: 'การจ่าย-รับเงิน' },
  { href: '/wht-certificates', label: 'ใบหัก ณ ที่จ่าย' },
];

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="w-full shrink-0 border-b border-gray-200 bg-white md:w-56 md:border-b-0 md:border-r">
        <div className="border-b-2 border-[#B8860B] px-4 py-4">
          <p className="text-sm font-semibold text-[#1B5E3A]">ก้าวหน้า อสังหาริมทรัพย์</p>
          <p className="text-xs text-gray-500">
            {user?.name} ({user?.role})
          </p>
        </div>
        <nav className="flex flex-row flex-wrap gap-1 px-2 pb-2 md:flex-col md:pb-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm ${
                pathname.startsWith(item.href)
                  ? 'border-l-4 border-[#B8860B] bg-[#1B5E3A] text-white'
                  : 'border-l-4 border-transparent text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 pb-4">
          <button
            onClick={logout}
            className="text-sm text-gray-500 underline underline-offset-2 hover:text-gray-800"
          >
            ออกจากระบบ
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
