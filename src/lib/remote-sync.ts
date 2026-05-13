import { useCallback, useState } from "react";

export type RemoteRole = "host" | "client";

export type RemoteState = {
  role: RemoteRole;
  code: string;
} | null;

function apiBase() {
  if (import.meta.env.VITE_SYNC_URL) return import.meta.env.VITE_SYNC_URL;
  return "/api/sync";
}

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// Host: manual push
export function useRemoteHost(remote: RemoteState) {
  const [lastPush, setLastPush] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const push = useCallback(async (body: string) => {
    if (!remote || remote.role !== "host") return;
    try {
      const res = await fetch(`${apiBase()}?code=${remote.code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) { setError("Push failed"); return; }
      setLastPush(new Date());
      setError(null);
    } catch {
      setError("Network error");
    }
  }, [remote]);

  return { push, lastPush, error };
}

// Client: manual pull
export function useRemoteClient(
  remote: RemoteState,
  onBody: (body: string) => void,
) {
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pull = useCallback(async () => {
    if (!remote || remote.role !== "client") return;
    try {
      const res = await fetch(`${apiBase()}?code=${remote.code}`);
      if (!res.ok) { setError(res.status === 404 ? "Room not found" : "Sync error"); return; }
      const data: { body: string; updatedAt: number } = await res.json();
      onBody(data.body);
      setLastSync(new Date(data.updatedAt));
      setError(null);
    } catch {
      setError("Network error");
    }
  }, [remote, onBody]);

  return { pull, lastSync, error };
}

export { genCode };
