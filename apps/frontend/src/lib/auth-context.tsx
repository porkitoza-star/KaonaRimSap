'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

export type Role = 'CEO' | 'CFO' | 'ACCOUNTANT' | 'PROJECT_MANAGER' | 'VIEWER';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  updateUser: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem('kaonaa_token');
    const storedUser = localStorage.getItem('kaonaa_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  function persistSession(result: { accessToken: string; user: AuthUser }) {
    localStorage.setItem('kaonaa_token', result.accessToken);
    localStorage.setItem('kaonaa_user', JSON.stringify(result.user));
    setToken(result.accessToken);
    setUser(result.user);
  }

  async function login(email: string, password: string) {
    const result = await api.post<{ accessToken: string; user: AuthUser }>('/auth/login', {
      email,
      password,
    });
    persistSession(result);
  }

  async function register(name: string, email: string, password: string) {
    const result = await api.post<{ accessToken: string; user: AuthUser }>('/auth/register', {
      name,
      email,
      password,
    });
    persistSession(result);
  }

  function updateUser(nextUser: AuthUser) {
    localStorage.setItem('kaonaa_user', JSON.stringify(nextUser));
    setUser(nextUser);
  }

  function logout() {
    localStorage.removeItem('kaonaa_token');
    localStorage.removeItem('kaonaa_user');
    setToken(null);
    setUser(null);
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth ต้องถูกเรียกใช้ภายใน AuthProvider เท่านั้น');
  }
  return ctx;
}
