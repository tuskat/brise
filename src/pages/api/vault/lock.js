import { closeSession, getTokenFromRequest } from '../../../lib/vault-session.js';

/** POST /api/vault/lock — close the current session. */
export async function POST({ request }) {
  closeSession(getTokenFromRequest(request));
  return new Response(null, { status: 204 });
}
