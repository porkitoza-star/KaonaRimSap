'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { useAvatarUrl } from '@/lib/use-avatar-url';
import { PasswordInput } from '@/components/password-input';

export default function ProfilePage() {
  const { user, token, updateUser } = useAuth();
  const avatarSrc = useAvatarUrl(user?.id, user?.avatarUrl, token);

  const [name, setName] = useState(user?.name ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function handleNameSubmit(e: FormEvent) {
    e.preventDefault();
    setNameError(null);
    setNameMessage(null);
    setNameSaving(true);
    try {
      const updated = await api.patch<{ id: string; name: string }>('/users/me', { name }, token);
      if (user) updateUser({ ...user, name: updated.name });
      setNameMessage('บันทึกชื่อเรียบร้อยแล้ว');
    } catch (err) {
      setNameError(err instanceof ApiError ? err.message : 'บันทึกชื่อไม่สำเร็จ');
    } finally {
      setNameSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const updated = await api.post<{ id: string; avatarUrl: string }>(
        '/users/me/avatar',
        formData,
        token,
      );
      if (user) updateUser({ ...user, avatarUrl: updated.avatarUrl });
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordError('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
      return;
    }
    setPasswordSaving(true);
    try {
      await api.patch('/auth/change-password', { currentPassword, newPassword }, token);
      setPasswordMessage('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">โปรไฟล์ของฉัน</h1>
        <p className="text-sm text-gray-500">แก้ไขชื่อ รูปโปรไฟล์ และรหัสผ่าน</p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">รูปโปรไฟล์</h2>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#1B5E3A] text-lg font-semibold text-white">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- runtime blob: URL, not eligible for next/image optimization
              <img src={avatarSrc} alt={user?.name ?? ''} className="h-16 w-16 object-cover" />
            ) : (
              (user?.name ?? '?').charAt(0)
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              disabled={avatarUploading}
              className="text-sm text-gray-600"
            />
            {avatarUploading && <p className="mt-1 text-xs text-gray-500">กำลังอัปโหลด...</p>}
            {avatarError && <p className="mt-1 text-xs text-red-600">{avatarError}</p>}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">ชื่อ</h2>
        <form onSubmit={handleNameSubmit} className="mt-4 flex items-end gap-3">
          <div className="flex-1">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B5E3A] focus:outline-none focus:ring-1 focus:ring-[#1B5E3A]"
            />
          </div>
          <button
            type="submit"
            disabled={nameSaving}
            className="rounded-lg bg-[#1B5E3A] px-4 py-2 text-sm font-medium text-white hover:bg-[#154a2e] disabled:opacity-60"
          >
            {nameSaving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </form>
        {nameMessage && <p className="mt-2 text-xs text-[#1B5E3A]">{nameMessage}</p>}
        {nameError && <p className="mt-2 text-xs text-red-600">{nameError}</p>}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">เปลี่ยนรหัสผ่าน</h2>
        <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">รหัสผ่านปัจจุบัน</label>
            <PasswordInput
              required
              value={currentPassword}
              onChange={setCurrentPassword}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B5E3A] focus:outline-none focus:ring-1 focus:ring-[#1B5E3A]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">รหัสผ่านใหม่</label>
            <PasswordInput
              required
              minLength={8}
              value={newPassword}
              onChange={setNewPassword}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B5E3A] focus:outline-none focus:ring-1 focus:ring-[#1B5E3A]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">ยืนยันรหัสผ่านใหม่</label>
            <PasswordInput
              required
              minLength={8}
              value={confirmPassword}
              onChange={setConfirmPassword}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B5E3A] focus:outline-none focus:ring-1 focus:ring-[#1B5E3A]"
            />
          </div>
          {passwordMessage && <p className="text-xs text-[#1B5E3A]">{passwordMessage}</p>}
          {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
          <button
            type="submit"
            disabled={passwordSaving}
            className="rounded-lg bg-[#1B5E3A] px-4 py-2 text-sm font-medium text-white hover:bg-[#154a2e] disabled:opacity-60"
          >
            {passwordSaving ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
          </button>
        </form>
      </section>
    </div>
  );
}
