import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Thai } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { RegisterServiceWorker } from '@/lib/register-sw';

const notoSansThai = Noto_Sans_Thai({
  variable: '--font-thai',
  subsets: ['thai', 'latin'],
});

export const metadata: Metadata = {
  title: 'ระบบ ERP ก้าวหน้า อสังหาริมทรัพย์',
  description: 'ระบบบริหารการเงินและบัญชีสำหรับธุรกิจอสังหาริมทรัพย์และก่อสร้าง',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#123458',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${notoSansThai.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-gray-50 font-sans text-gray-900">
        <AuthProvider>
          <RegisterServiceWorker />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
