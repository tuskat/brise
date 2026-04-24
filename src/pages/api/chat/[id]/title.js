import { dbOperations } from '../../../../db/index.js';

/**
 * PUT /api/chat/[id]/title - Rename conversation
 */
export async function PUT({ params, request }) {
    try {
        const { id } = params;
        const body = await request.json();
        const { title } = body;
        
        if (!title?.trim()) {
            return new Response(JSON.stringify({
                status: 'error',
                error: 'Title is required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        await dbOperations.updateConversationTitle(parseInt(id), title.trim());
        
        return new Response(JSON.stringify({
            status: 'success',
            data: { title: title.trim() }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error updating conversation title:', error);
        return new Response(JSON.stringify({
            status: 'error',
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
