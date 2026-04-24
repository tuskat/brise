import { dbOperations } from '../../../../db/index.js';
import { chatWithProxy } from '../../../../lib/proxy-client.js';
import { loadProxy } from '../../../../lib/proxy-loader.js';

/**
 * POST /api/chat/[id]/messages - Send message to conversation
 * Supports both streaming (SSE) and non-streaming responses.
 * Handles both Ollama (NDJSON) and OpenAI-compatible (SSE) formats.
 */
export async function POST({ params, request }) {
    const { id } = params;
    const conversationId = parseInt(id);

    try {
        const body = await request.json();
        const { content, stream = false } = body;

        if (!content?.trim()) {
            return new Response(JSON.stringify({
                status: 'error',
                error: 'Message content is required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get conversation
        const conversation = await dbOperations.getConversation(conversationId);
        if (!conversation) {
            return new Response(JSON.stringify({
                status: 'error',
                error: 'Conversation not found'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Save user message
        const userMessage = await dbOperations.addMessage({
            conversation_id: conversationId,
            role: 'user',
            content: content.trim()
        });

        // Build message history for proxy
        const messages = conversation.messages.map(m => ({
            role: m.role,
            content: m.content
        }));
        messages.push({ role: 'user', content: content.trim() });

        // Get persona if persona_id is set (for parameters and name display)
        let persona = null;
        if (conversation.persona_id) {
            try {
                const personaResponse = await fetch(`${request.headers.get('origin')}/api/personas`);
                const personaData = await personaResponse.json();
                persona = personaData.find(p => p.id === conversation.persona_id);
            } catch {
                // Persona not found, continue without it
            }
        }
        const parameters = persona?.parameters || {};
        const systemPrompt = persona?.system_prompt || null;
        const personaName = persona?.name || null;

        // Get proxy info for model
        let model = conversation.model;
        if (conversation.proxy_id) {
            const proxy = await loadProxy(conversation.proxy_id);
            if (proxy) {
                model = proxy.model;
            }
        }

        // Update conversation model if not set
        if (!conversation.model && model) {
            await dbOperations.updateConversationModel(conversationId, model);
        }

        // Auto-title conversation from first message if still "New Conversation"
        if (conversation.title === 'New Conversation' && conversation.messages.length === 0) {
            const title = content.trim().substring(0, 40) + (content.length > 40 ? '...' : '');
            await dbOperations.updateConversationTitle(conversationId, title);
        }

        // Send to proxy
        if (stream) {
            // Streaming response (SSE)
            const result = await chatWithProxy(conversation.proxy_id, messages, parameters, {
                stream: true,
                systemPrompt
            });

            if (!result.success && !result.stream) {
                return new Response(JSON.stringify({
                    status: 'error',
                    error: result.error
                }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Process streaming response - detect schema from result
            const { response, schema = 'ollama', latency } = result;
            const reader = response.body?.getReader();

            if (!reader) {
                return new Response(JSON.stringify({
                    status: 'error',
                    error: 'No response body'
                }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const decoder = new TextDecoder();
            let fullContent = '';
            let messageId = userMessage.id;

            // Create assistant message placeholder
            const assistantMessage = await dbOperations.addMessage({
                conversation_id: conversationId,
                role: 'assistant',
                content: ''
            });
            messageId = assistantMessage.id;

            const stream = new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();

                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            const chunk = decoder.decode(value, { stream: true });

                            if (schema === 'openai') {
                                // OpenAI SSE format: "data: {...}" lines
                                const lines = chunk.split('\n');
                                for (const line of lines) {
                                    const trimmed = line.trim();
                                    if (!trimmed || !trimmed.startsWith('data:')) continue;
                                    const data = trimmed.slice(5).trim();
                                    if (data === '[DONE]') break;

                                    try {
                                        const parsed = JSON.parse(data);
                                        const delta = parsed.choices?.[0]?.delta?.content;
                                        if (delta) {
                                            fullContent += delta;
                                            controller.enqueue(encoder.encode(
                                                `event: message\ndata: ${JSON.stringify({ delta, done: false })}\n\n`
                                            ));
                                        }
                                        if (parsed.choices?.[0]?.finish_reason) {
                                            break;
                                        }
                                    } catch {
                                        // Skip malformed JSON
                                    }
                                }
                            } else {
                                // Ollama NDJSON format: one JSON object per line
                                const lines = chunk.split('\n');
                                for (const line of lines) {
                                    if (!line.trim() || !line.startsWith('{')) continue;
                                    try {
                                        const parsed = JSON.parse(line);
                                        if (parsed.message?.content) {
                                            fullContent += parsed.message.content;
                                            controller.enqueue(encoder.encode(
                                                `event: message\ndata: ${JSON.stringify({ delta: parsed.message.content, done: false })}\n\n`
                                            ));
                                        }
                                    } catch {
                                        // Skip malformed JSON
                                    }
                                }
                            }
                        }

                        // Send completion event with final content
                        controller.enqueue(encoder.encode(
                            `event: done\ndata: ${JSON.stringify({ message_id: messageId, content: fullContent, latency, status: 'success', done: true, persona_name: personaName })}\n\n`
                        ));

                    } catch (streamError) {
                        controller.enqueue(encoder.encode(
                            `event: error\ndata: ${JSON.stringify({ error: streamError.message })}\n\n`
                        ));
                    } finally {
                        controller.close();

                        // Save final content to DB after stream completes
                        try {
                            await dbOperations.updateMessageContent(messageId, fullContent, latency, 'success', personaName);
                        } catch (dbErr) {
                            console.error('Failed to save streamed message:', dbErr);
                        }
                    }
                }
            });

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                }
            });

        } else {
            // Non-streaming response
            const result = await chatWithProxy(conversation.proxy_id, messages, parameters, {
                stream: false,
                systemPrompt
            });

            if (!result.success) {
                // Add error message to conversation
                const errorMsg = await dbOperations.addMessage({
                    conversation_id: conversationId,
                    role: 'assistant',
                    content: `Error: ${result.error}`,
                    latency: result.latency,
                    status: 'error',
                    persona_name: personaName
                });

                return new Response(JSON.stringify({
                    status: 'success',
                    data: { message: errorMsg },
                    latency_ms: result.latency,
                    persona_name: personaName
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Save assistant message
            const assistantMessage = await dbOperations.addMessage({
                conversation_id: conversationId,
                role: 'assistant',
                content: result.data,
                latency: result.latency,
                status: 'success',
                persona_name: personaName
            });

            return new Response(JSON.stringify({
                status: 'success',
                data: { message: assistantMessage },
                latency_ms: result.latency,
                persona_name: personaName
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

    } catch (error) {
        console.error('Error sending message:', error);

        return new Response(JSON.stringify({
            status: 'error',
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
