'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export function useAvatarUrl(userId: string | undefined, avatarUrl: string | null | undefined, token: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !avatarUrl || !token) {
      setBlobUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;

    fetch(`${API_URL}/users/${userId}/avatar`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => setBlobUrl(null));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [userId, avatarUrl, token]);

  return blobUrl;
}
