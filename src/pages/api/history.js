import { getHistory } from '../../lib/db.js';

export async function GET({ request }) {
    try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);

        const history = getHistory(limit);

        return new Response(JSON.stringify({
            status: 'success',
            data: history
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            status: 'error',
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
