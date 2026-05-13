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

// Host: debounced push whenever script body changes
export function useRemoteHost(remote: RemoteState, body: string) {
  const lastPushed = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      } catch {
        // silently ignore — next change will retry
      }
    }, 600);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [remote, body]);
}

// Client: poll every 3s, manual reload via returned fn
export function useRemoteClient(
  remote: RemoteState,
  onBody: (body: string) => void,
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async (code: string) => {
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

  const reload = useCallback(() => {
    if (remote?.role === "client") fetch_(remote.code);
  }, [remote, fetch_]);

  useEffect(() => {
    if (!remote || remote.role !== "client") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    fetch_(remote.code);
    intervalRef.current = setInterval(() => fetch_(remote.code), 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [remote, fetch_]);

  return { reload, lastSync, error };
}

export { genCode };
