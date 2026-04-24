import { getMetrics } from '../../lib/db.js';

export async function GET() {
  try {
    const metrics = getMetrics();
    return new Response(JSON.stringify({ status: 'success', data: metrics }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ status: 'error', error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
