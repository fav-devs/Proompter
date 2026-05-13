import type { IncomingMessage, ServerResponse } from "node:http";

type Room = { body: string; updatedAt: number; ping: boolean };

// In-memory relay — ephemeral but fine for a personal tool
const rooms = new Map<string, Room>();

// Clean up rooms older than 2 hours
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [code, room] of rooms) {
    if (room.updatedAt < cutoff) rooms.delete(code);
  }
}, 30 * 60 * 1000);

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  const code = url.searchParams.get("code")?.toUpperCase();

  if (!code || !/^[A-Z0-9]{6}$/.test(code)) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid code" }));
    return;
  }

  if (req.method === "GET") {
    const room = rooms.get(code);
    if (!room) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Room not found" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(room));
    return;
  }

  if (req.method === "POST") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString();
    let payload: { body?: string };
    try { payload = JSON.parse(text); } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Bad JSON" }));
      return;
    }
    if (typeof payload.body !== "string") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing body" }));
      return;
    }
    rooms.set(code, { body: payload.body, updatedAt: Date.now(), ping: rooms.get(code)?.ping ?? false });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Client pings host: POST /api/sync?code=X&ping=1
  if (req.method === "POST" && url.searchParams.get("ping") === "1") {
    const room = rooms.get(code);
    if (room) room.ping = true;
    else rooms.set(code, { body: "", updatedAt: 0, ping: true });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Host checks for ping: GET /api/sync?code=X&ping=1  — returns flag and clears it
  if (req.method === "GET" && url.searchParams.get("ping") === "1") {
    const room = rooms.get(code);
    const pending = room?.ping ?? false;
    if (room) room.ping = false;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ pending }));
    return;
  }

  res.writeHead(405);
  res.end();
}
