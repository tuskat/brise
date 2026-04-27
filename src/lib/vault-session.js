import { randomBytes } from 'node:crypto';

const IDLE_MS = (Number(process.env.VAULT_IDLE_MINUTES) || 15) * 60 * 1000;

// token -> { key: Buffer, lastActivityAt: number }
const sessions = new Map();

function sweep() {
  const now = Date.now();
  for (const [token, s] of sessions) {
    if (now - s.lastActivityAt > IDLE_MS) {
      s.key.fill(0);
      sessions.delete(token);
    }
  }
}

export function openSession(key) {
  sweep();
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { key, lastActivityAt: Date.now() });
  return { token, expiresInMs: IDLE_MS };
}

export function closeSession(token) {
  const s = sessions.get(token);
  if (s) {
    s.key.fill(0);
    sessions.delete(token);
  }
}

/** Returns the session key for token, or null if missing/expired. Refreshes activity. */
export function useSession(token) {
  if (!token) return null;
  sweep();
  const s = sessions.get(token);
  if (!s) return null;
  s.lastActivityAt = Date.now();
  return s.key;
}

export function getTokenFromRequest(request) {
  return request.headers.get('x-vault-token') || null;
}
