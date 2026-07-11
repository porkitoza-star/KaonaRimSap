'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAuth } from '@/lib/require-auth';
import { useAuth } from '@/lib/auth-context';

interface NavItem {
  href: string;
  shortLabel: string;
  icon: string;
  color: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const BASE_NAV_GROUPS: NavGroup[] = [
  {
    title: 'ภาพรวม',
    items: [{ href: '/dashboard', shortLabel: 'แดชบอร์ด', icon: '📊', color: '#007AFF' }],
  },
  {
    title: 'การเงิน-บัญชี',
    items: [
      { href: '/cost-centers', shortLabel: 'ผังบัญชี', icon: '🗂️', color: '#8E8E93' },
      { href: '/contacts', shortLabel: 'คู่ค้า', icon: '👥', color: '#FF9500' },
      { href: '/invoices', shortLabel: 'ใบแจ้งหนี้', icon: '🧾', color: '#00C7BE' },
      { href: '/bills', shortLabel: 'บิล', icon: '💳', color: '#FF3B30' },
      { href: '/payments', shortLabel: 'จ่าย-รับเงิน', icon: '💰', color: '#34C759' },
      { href: '/wht-certificates', shortLabel: 'หัก ณ ที่จ่าย', icon: '🧮', color: '#636366' },
      { href: '/ledger-import', shortLabel: 'นำเข้า Excel', icon: '📥', color: '#30B0C7' },
    ],
  },
  {
    title: 'งานก่อสร้าง',
    items: [
      { href: '/materials', shortLabel: 'วัสดุ/สต๊อก', icon: '🧱', color: '#A2845E' },
      { href: '/boq-templates', shortLabel: 'เทมเพลต BOQ', icon: '📐', color: '#5AC8FA' },
      { href: '/construction', shortLabel: 'งานก่อสร้าง', icon: '🏗️', color: '#FF9F0A' },
    ],
  },
  {
    title: 'เอกสาร',
    items: [{ href: '/documents', shortLabel: 'เอกสาร/OCR', icon: '📄', color: '#AF52DE' }],
  },
  {
    title: 'บัญชีผู้ใช้งาน',
    items: [{ href: '/profile', shortLabel: 'โปรไฟล์', icon: '👤', color: '#5856D6' }],
  },
];

// Blends a hex color toward white (amount > 0) or black (amount < 0) by the
// given fraction, used to build the light-to-dark gradient that gives the
// icon tiles their glossy, App-Store-style 3D look.
function shadeHex(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (channel: number) => {
    const target = amount > 0 ? 255 : 0;
    const c = Math.round(channel + (target - channel) * Math.abs(amount));
    return Math.max(0, Math.min(255, c));
  };
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function AppIcon({ icon, color }: { icon: string; color: string }) {
  return (
    <span
      className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-[26%] text-[2.4rem] shadow-[0_10px_18px_rgba(0,0,0,0.24),0_3px_6px_rgba(0,0,0,0.18)] md:h-14 md:w-14 md:rounded-[24%] md:text-2xl md:shadow-[0_4px_9px_rgba(0,0,0,0.24),0_1px_3px_rgba(0,0,0,0.16)]"
      style={{
        background: `linear-gradient(160deg, ${shadeHex(color, 0.3)} 0%, ${color} 48%, ${shadeHex(color, -0.22)} 100%)`,
      }}
    >
      {/* Glass highlight across the top half, like a light source above the icon. */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-3/5 rounded-t-[26%] bg-gradient-to-b from-white/55 via-white/15 to-transparent" />
      {/* Soft bright rim at the top edge, dark rim at the bottom — the beveled "glass" look. */}
      <span className="pointer-events-none absolute inset-0 rounded-[26%] shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.7),inset_0_-8px_12px_rgba(0,0,0,0.3)] md:rounded-[24%] md:shadow-[inset_0_1px_1px_rgba(255,255,255,0.65),inset_0_-5px_8px_rgba(0,0,0,0.28)]" />
      <span className="relative drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)]">{icon}</span>
    </span>
  );
}

function NavTile({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} className="flex flex-col items-center gap-1 md:flex-row md:gap-2">
      <AppIcon icon={item.icon} color={item.color} />
      <span
        className={`line-clamp-2 text-center text-[11px] leading-tight md:text-left md:text-sm ${
          active ? 'font-semibold text-[#1B5E3A]' : 'text-gray-700'
        }`}
      >
        {item.shortLabel}
      </span>
    </Link>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const navGroups: NavGroup[] =
    user?.role === 'CEO'
      ? [
          ...BASE_NAV_GROUPS,
          {
            title: 'บัญชีผู้ใช้งาน',
            items: [{ href: '/users', shortLabel: 'ผู้ใช้งาน', icon: '⚙️', color: '#8E8E93' }],
          },
        ]
      : BASE_NAV_GROUPS;

  // The "บัญชีผู้ใช้งาน" group can appear twice above (once for โปรไฟล์, once
  // for ผู้ใช้งาน when CEO) — merge them into a single group by title.
  const mergedGroups: NavGroup[] = [];
  for (const group of navGroups) {
    const existing = mergedGroups.find((g) => g.title === group.title);
    if (existing) {
      existing.items.push(...group.items);
    } else {
      mergedGroups.push({ title: group.title, items: [...group.items] });
    }
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="w-full shrink-0 border-b border-gray-200 bg-white md:h-screen md:w-72 md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="sticky top-0 z-10 border-b-2 border-[#B8860B] bg-white px-4 py-4">
          <p className="text-sm font-semibold text-[#1B5E3A]">ก้าวหน้า อสังหาริมทรัพย์</p>
          <p className="text-xs text-gray-500">
            {user?.name} ({user?.role})
          </p>
        </div>

        {mergedGroups.map((group) => (
          <div key={group.title} className="px-3 py-3 md:px-4">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {group.title}
            </p>
            <div className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-5 md:flex md:flex-col md:gap-1">
              {group.items.map((item) => (
                <NavTile key={item.href} item={item} active={pathname.startsWith(item.href)} />
              ))}
            </div>
          </div>
        ))}

        <div className="px-4 py-3">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            ออกจากระบบ
          </p>
          <div className="grid grid-cols-4 gap-x-2 sm:grid-cols-5 md:flex">
            <button type="button" onClick={logout} className="flex flex-col items-center gap-1 md:flex-row md:gap-2">
              <AppIcon icon="🚪" color="#FF453A" />
              <span className="text-center text-[11px] leading-tight text-gray-700 md:text-left md:text-sm">
                ออกจากระบบ
              </span>
            </button>
          </div>
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
