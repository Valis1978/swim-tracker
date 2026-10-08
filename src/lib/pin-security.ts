// A small family app has one shared PIN budget per server process. Forwarded IP
// headers cannot bypass it. Replicas need a shared limiter at the reverse proxy.
export function createPinLimiter(clock = Date.now, limit = 10, windowMs = 15 * 60_000) {
  let attempts = 0, started = 0;
  return () => {
    const now = clock();
    if (now >= started + windowMs || now < started) { attempts = 0; started = now; }
    if (attempts >= limit) return Math.max(1, Math.ceil((started + windowMs - now) / 1000));
    attempts++;
    return 0;
  };
}

export async function readPin(request: Request): Promise<string | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return raw && typeof raw.pin === "string" && raw.pin.length > 0 && raw.pin.length <= 128 ? raw.pin : null;
  } catch { return null; }
  finally { reader.releaseLock(); }
}
