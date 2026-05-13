import { useCallback, useEffect, useRef, useState } from "react";

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

// Host: debounced push on script change + poll for client pings every 2s
export function useRemoteHost(remote: RemoteState, body: string, onPing: () => void) {
  const lastPushed = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const onPingRef = useRef(onPing);
  onPingRef.current = onPing;

  // Push script on change
  useEffect(() => {
    if (!remote || remote.role !== "host") return;
    if (lastPushed.current === body) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await fetch(`${apiBase()}?code=${remote.code}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });
        lastPushed.current = body;
      } catch { /* retry on next change */ }
    }, 600);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [remote, body]);

  // Poll for client pings
  useEffect(() => {
    if (!remote || remote.role !== "host") return;
    pingInterval.current = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase()}?code=${remote.code}&ping=1`);
        if (!res.ok) return;
        const { pending } = await res.json();
        if (pending) onPingRef.current();
      } catch { /* ignore */ }
    }, 2000);
    return () => { if (pingInterval.current) clearInterval(pingInterval.current); };
  }, [remote]);
}

// Client: manual reload + send ping to request host push
export function useRemoteClient(
  remote: RemoteState,
  onBody: (body: string) => void,
) {
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pull = useCallback(async (code: string) => {
    try {
      const res = await fetch(`${apiBase()}?code=${code}`);
      if (!res.ok) { setError(res.status === 404 ? "Room not found" : "Sync error"); return; }
      const data: { body: string; updatedAt: number } = await res.json();
      onBody(data.body);
      setLastSync(new Date(data.updatedAt));
      setError(null);
    } catch {
      setError("Network error");
    }
  }, [onBody]);

  // Ping host then pull after a short delay for the host to push
  const reload = useCallback(async () => {
    if (!remote || remote.role !== "client") return;
    try {
      await fetch(`${apiBase()}?code=${remote.code}&ping=1`, { method: "POST" });
    } catch { /* ignore */ }
    setTimeout(() => pull(remote.code), 1500);
  }, [remote, pull]);

  return { reload, lastSync, error };
}

export { genCode };
