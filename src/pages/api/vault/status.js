import { vaultStore } from '../../../db/index.js';
import { useSession, getTokenFromRequest } from '../../../lib/vault-session.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** GET /api/vault/status — { initialized, unlocked } */
export async function GET({ request }) {
  const initialized = !!vaultStore.getMeta('verifier');
  const unlocked = !!useSession(getTokenFromRequest(request));
  return json({ initialized, unlocked });
}
