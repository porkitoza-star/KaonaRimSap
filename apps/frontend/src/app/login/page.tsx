'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { PasswordInput } from '@/components/password-input';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border-t-4 border-[#B8860B] bg-white p-8 shadow-sm ring-1 ring-gray-100">
        <h1 className="text-center text-xl font-semibold text-[#1B5E3A]">
          ระบบ ERP ก้าวหน้า อสังหาริมทรัพย์
        </h1>
        <p className="mt-1 text-center text-sm text-gray-500">เข้าสู่ระบบเพื่อดำเนินการต่อ</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              อีเมล
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B5E3A] focus:outline-none focus:ring-1 focus:ring-[#1B5E3A]"
              placeholder="you@kaonaa.co.th"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              รหัสผ่าน
            </label>
            <PasswordInput
              id="password"
              required
              minLength={8}
              value={password}
              onChange={setPassword}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B5E3A] focus:outline-none focus:ring-1 focus:ring-[#1B5E3A]"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#1B5E3A] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#154a2e] disabled:opacity-60"
          >
            {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          ยังไม่มีบัญชี?{' '}
          <Link href="/register" className="font-medium text-[#1B5E3A] underline underline-offset-2">
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </div>
  );
}
