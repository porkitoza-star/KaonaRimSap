'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAuth } from '@/lib/require-auth';
import { useAuth } from '@/lib/auth-context';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'แดชบอร์ด', shortLabel: 'แดชบอร์ด', icon: '📊', color: '#007AFF' },
  { href: '/cost-centers', label: 'ผังบัญชี / Cost Center', shortLabel: 'ผังบัญชี', icon: '🗂️', color: '#8E8E93' },
  { href: '/contacts', label: 'คู่ค้า', shortLabel: 'คู่ค้า', icon: '👥', color: '#FF9500' },
  { href: '/invoices', label: 'ใบแจ้งหนี้ (AR)', shortLabel: 'ใบแจ้งหนี้', icon: '🧾', color: '#00C7BE' },
  { href: '/bills', label: 'บิล (AP)', shortLabel: 'บิล', icon: '💳', color: '#FF3B30' },
  { href: '/documents', label: 'เอกสาร / OCR', shortLabel: 'เอกสาร', icon: '📄', color: '#AF52DE' },
  { href: '/materials', label: 'วัสดุก่อสร้าง / สต๊อก', shortLabel: 'วัสดุ/สต๊อก', icon: '🧱', color: '#A2845E' },
  { href: '/boq-templates', label: 'เทมเพลต BOQ มาตรฐาน', shortLabel: 'เทมเพลต BOQ', icon: '📐', color: '#5AC8FA' },
  { href: '/construction', label: 'ขั้นตอนงาน / Timeline / Feasibility', shortLabel: 'งานก่อสร้าง', icon: '🏗️', color: '#FF9F0A' },
  { href: '/payments', label: 'การจ่าย-รับเงิน', shortLabel: 'จ่าย-รับเงิน', icon: '💰', color: '#34C759' },
  { href: '/wht-certificates', label: 'ใบหัก ณ ที่จ่าย', shortLabel: 'หัก ณ ที่จ่าย', icon: '🧮', color: '#636366' },
  { href: '/ledger-import', label: 'นำเข้าบัญชีจาก Excel', shortLabel: 'นำเข้า Excel', icon: '📥', color: '#30B0C7' },
  { href: '/profile', label: 'โปรไฟล์ของฉัน', shortLabel: 'โปรไฟล์', icon: '👤', color: '#5856D6' },
];

function AppIcon({ icon, color }: { icon: string; color: string }) {
  return (
    <span
      className="flex h-14 w-14 items-center justify-center rounded-[16px] text-2xl shadow-sm"
      style={{ backgroundColor: color }}
    >
      {icon}
    </span>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const navItems =
    user?.role === 'CEO'
      ? [...NAV_ITEMS, { href: '/users', label: 'จัดการผู้ใช้งาน', shortLabel: 'ผู้ใช้งาน', icon: '⚙️', color: '#8E8E93' }]
      : NAV_ITEMS;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="w-full shrink-0 border-b border-gray-200 bg-white md:w-56 md:border-b-0 md:border-r">
        <div className="border-b-2 border-[#B8860B] px-4 py-4">
          <p className="text-sm font-semibold text-[#1B5E3A]">ก้าวหน้า อสังหาริมทรัพย์</p>
          <p className="text-xs text-gray-500">
            {user?.name} ({user?.role})
          </p>
        </div>

        {/* Mobile: iOS-style home screen grid of app icons */}
        <nav className="grid grid-cols-4 gap-3 px-3 py-4 sm:grid-cols-5 md:hidden">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1">
              <AppIcon icon={item.icon} color={item.color} />
              <span
                className={`line-clamp-2 text-center text-[11px] leading-tight ${
                  pathname.startsWith(item.href) ? 'font-semibold text-[#1B5E3A]' : 'text-gray-700'
                }`}
              >
                {item.shortLabel}
              </span>
            </Link>
          ))}
          <button type="button" onClick={logout} className="flex flex-col items-center gap-1">
            <AppIcon icon="🚪" color="#FF453A" />
            <span className="text-center text-[11px] leading-tight text-gray-700">ออกจากระบบ</span>
          </button>
        </nav>

        {/* Desktop: text sidebar */}
        <nav className="hidden md:flex md:flex-col md:gap-1 md:px-2 md:pb-4">
          {navItems.map((item) => (
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
        <div className="hidden px-4 pb-4 md:block">
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
