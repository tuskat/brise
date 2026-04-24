import { dbOperations } from '../../../db/index.js';
import { loadAllPersonas } from '../../../lib/persona-loader.js';

/**
 * GET /api/chat/[id] - Get conversation detail
 * DELETE /api/chat/[id] - Delete conversation
 */
export async function GET({ params, request }) {
    try {
        const { id } = params;
        const conversation = await dbOperations.getConversation(parseInt(id));
        
        if (!conversation) {
            return new Response(JSON.stringify({
                status: 'error',
                error: 'Conversation not found'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Enrich with persona name for the UI badge
        if (conversation.persona_id) {
            try {
                const personas = await loadAllPersonas();
                const persona = personas.find(p => p.id === conversation.persona_id);
                conversation.persona_name = persona?.name || null;
            } catch {
                conversation.persona_name = null;
            }
        }
        
        return new Response(JSON.stringify({
            status: 'success',
            data: conversation
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error getting conversation:', error);
        return new Response(JSON.stringify({
            status: 'error',
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function DELETE({ params }) {
    try {
        const { id } = params;
        await dbOperations.deleteConversation(parseInt(id));
        
        return new Response(JSON.stringify({
            status: 'success',
            data: { deleted: true }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        return new Response(JSON.stringify({
            status: 'error',
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
