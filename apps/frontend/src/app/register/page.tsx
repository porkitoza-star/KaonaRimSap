'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }
    setSubmitting(true);
    try {
      await register(name, email, password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border-t-4 border-[#B8860B] bg-white p-8 shadow-sm ring-1 ring-gray-100">
        <h1 className="text-center text-xl font-semibold text-[#1B5E3A]">สมัครสมาชิก</h1>
        <p className="mt-1 text-center text-sm text-gray-500">
          บัญชีใหม่จะได้สิทธิ์ &quot;ดูอย่างเดียว&quot; ก่อน — ให้ CEO เข้าไปปรับสิทธิ์ในหน้าจัดการผู้ใช้งาน
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              ชื่อ
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B5E3A] focus:outline-none focus:ring-1 focus:ring-[#1B5E3A]"
              placeholder="ชื่อ-นามสกุล"
            />
          </div>
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
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B5E3A] focus:outline-none focus:ring-1 focus:ring-[#1B5E3A]"
              placeholder="อย่างน้อย 8 ตัวอักษร"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              ยืนยันรหัสผ่าน
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {submitting ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          มีบัญชีอยู่แล้ว?{' '}
          <Link href="/login" className="font-medium text-[#1B5E3A] underline underline-offset-2">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}
