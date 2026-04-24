import { dbOperations } from '../../../db/index.js';
import { loadProxy } from '../../../lib/proxy-loader.js';
import { loadAllPersonas } from '../../../lib/persona-loader.js';

/**
 * Enrich conversations with persona_name from the personas directory.
 */
async function enrichConversations(conversations) {
    if (!conversations.length) return conversations;
    const personas = await loadAllPersonas();
    return conversations.map(conv => ({
        ...conv,
        persona_name: personas.find(p => p.id === conv.persona_id)?.name || null
    }));
}

/**
 * GET /api/chat/conversations - List all conversations
 * POST /api/chat/conversations - Create a new conversation
 */
export async function GET() {
    try {
        const conversations = await dbOperations.listConversations();
        const enriched = await enrichConversations(conversations);
        
        return new Response(JSON.stringify({
            status: 'success',
            data: enriched
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error listing conversations:', error);
        return new Response(JSON.stringify({
            status: 'error',
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function POST({ request }) {
    try {
        const body = await request.json();
        const { title, persona_id, proxy_id } = body;
        
        // Resolve model from proxy if not explicitly provided
        let model = body.model || null;
        if (!model && proxy_id) {
            const proxy = await loadProxy(proxy_id);
            if (proxy) model = proxy.model;
        }
        
        const conversation = await dbOperations.createConversation({
            title: title || 'New Conversation',
            persona_id,
            proxy_id,
            model
        });
        
        return new Response(JSON.stringify({
            status: 'success',
            data: conversation
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error creating conversation:', error);
        return new Response(JSON.stringify({
            status: 'error',
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
