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

// Jewel-tone version of the icon color: deeper and more saturated than the
// flat iOS hue, closer to a cut gemstone (sapphire/emerald/ruby/citrine).
function jewelTone(hex: string): string {
  return shadeHex(hex, -0.12);
}

function AppIcon({ icon, color }: { icon: string; color: string }) {
  const gem = jewelTone(color);
  // Simulated facets: a conic gradient sweeping through several
  // light/dark passes of the gem color, like light catching the cut faces
  // of a gemstone, instead of one smooth linear gradient.
  const facetGradient = `conic-gradient(from 220deg at 32% 28%, ${shadeHex(gem, 0.55)} 0deg, ${shadeHex(gem, 0.1)} 55deg, ${gem} 120deg, ${shadeHex(gem, -0.35)} 195deg, ${shadeHex(gem, -0.15)} 280deg, ${shadeHex(gem, 0.4)} 360deg)`;

  return (
    <span
      className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-[28%] p-[2px] shadow-[0_10px_18px_rgba(0,0,0,0.26),0_3px_6px_rgba(0,0,0,0.2)] md:h-14 md:w-14 md:rounded-[25%] md:p-px md:shadow-[0_4px_9px_rgba(0,0,0,0.24),0_1px_3px_rgba(0,0,0,0.16)]"
      style={{
        // Thin gold bezel "setting" around the gem, like a jewelry mount.
        background: 'linear-gradient(135deg, #fdf1c8 0%, #b8860b 45%, #6e4d05 60%, #f4d874 100%)',
      }}
    >
      <span
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[26%] text-[2.3rem] md:rounded-[23%] md:text-2xl"
        style={{ background: facetGradient }}
      >
        {/* Glass highlight across the top half, like a light source above the icon. */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-3/5 rounded-t-[26%] bg-gradient-to-b from-white/55 via-white/12 to-transparent" />
        {/* Soft bright rim at the top edge, dark rim at the bottom — the beveled "glass" look. */}
        <span className="pointer-events-none absolute inset-0 rounded-[26%] shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.75),inset_0_-8px_12px_rgba(0,0,0,0.35)] md:rounded-[23%] md:shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),inset_0_-5px_8px_rgba(0,0,0,0.32)]" />
        {/* A small sparkle catch-light, like a gem-cut reflection. */}
        <span className="pointer-events-none absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-white/95 blur-[0.5px] md:h-1 md:w-1" />
        <span className="relative drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]">{icon}</span>
      </span>
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
      <aside
        className="w-full shrink-0 border-b border-gray-200 bg-white bg-cover bg-top md:h-screen md:w-72 md:overflow-y-auto md:border-b-0 md:border-r"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.9), rgba(255,255,255,0.9)), url(/nav-bg.jpg)`,
        }}
      >
        <div className="sticky top-0 z-10 border-b-2 border-[#B8860B] bg-white/95 px-4 py-4 backdrop-blur-sm">
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
      <main className="relative flex-1 p-4 md:p-8">
        {/* Fixed (viewport-relative, not content-height-relative) so the image
            doesn't stretch/tile oddly on long scrolling pages, and avoids
            iOS Safari's buggy background-attachment:fixed. */}
        <div
          className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.78), rgba(255,255,255,0.78)), url(/content-bg.jpg)`,
          }}
        />
        {/* Its own positioned stacking context so it reliably paints above
            the fixed background div regardless of DOM order (a positioned
            z-indexed element doesn't automatically outrank plain static
            content just by coming later in the tree). */}
        <div className="relative z-10">{children}</div>
      </main>
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
