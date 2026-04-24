import fs from 'node:fs/promises';
import path from 'node:path';
import { logInteraction } from '../../lib/db.js';
import { loadAllProxies } from '../../lib/proxy-loader.js';
import { extractFormatContent, extractMultipleFormatContent, validateFormatContent, formatExtension, loadFormatSchema, buildFormatInstruction } from '../../lib/format-extractor.js';

// Default proxy ID to use when none specified
const DEFAULT_PROXY_ID = 'ollama-local';

export async function POST({ request }) {
    const startTime = Date.now();
    let persona_id = null;
    let proxy_id = null;
    let userPrompt = "";
    let aiResponse = "";
    let status = "error";

    try {
        const body = await request.json();
        const { prompt, persona_id: pid, proxy_id: prid, format, files_per_call, batch_id } = body;
        persona_id = pid;
        proxy_id = prid || DEFAULT_PROXY_ID;
        userPrompt = prompt;
        const selectedFormat = format || null;
        const filesPerCall = (selectedFormat && files_per_call && files_per_call > 1) ? files_per_call : 1;
        const batchId = batch_id || null;

        if (!prompt) {
            return new Response(JSON.stringify({ error: 'Prompt is required' }), { status: 400 });
        }

        let finalPrompt = prompt;
        let parameters = {};

        if (persona_id) {
            const personasDir = path.resolve(process.cwd(), 'personas');
            const personaPath = path.join(personasDir, `${persona_id}.json`);
            try {
                const content = await fs.readFile(personaPath, 'utf-8');
                const persona = JSON.parse(content);
                finalPrompt = `${persona.system_prompt}\n\nUser: ${prompt}`;
                parameters = persona.parameters || {};
            } catch (e) {
                console.error("Persona loading error:", e);
                // Continue without persona if loading fails
            }
        }

        // Inject format instruction if a format is selected
        if (selectedFormat) {
            const schema = await loadFormatSchema(selectedFormat);
            const formatInstruction = buildFormatInstruction(selectedFormat, schema, filesPerCall);
            finalPrompt += formatInstruction;
        }

        // Import the client and forward to selected proxy
        const { forwardToProxy } = await import('../../lib/proxy-client.js');
        const result = await forwardToProxy(proxy_id, finalPrompt, parameters);

        if (result.success) {
            aiResponse = result.data;
            status = "success";
            const latency = Date.now() - startTime;

            // Log success with new fields
            logInteraction({ personaId: persona_id, userPrompt: userPrompt, aiResponse, latency, status, format: selectedFormat, batchId, filesCount: filesPerCall });

            // If a format was selected, extract and validate the fenced content
            if (selectedFormat) {
                // Multi-file extraction
                if (filesPerCall > 1) {
                    const extracted = extractMultipleFormatContent(aiResponse, selectedFormat);
                    if (extracted.length === 0) {
                        return new Response(JSON.stringify({
                            status: 'error',
                            error: `No \`\`\`${selectedFormat} fenced blocks found in model output`,
                            raw: aiResponse,
                        }), {
                            status: 422,
                            headers: { 'Content-Type': 'application/json' },
                        });
                    }

                    const files = [];
                    let hasError = false;
                    for (let i = 0; i < extracted.length; i++) {
                        const validation = validateFormatContent(extracted[i], selectedFormat);
                        if (validation.valid) {
                            files.push({ index: i + 1, data: extracted[i], format: selectedFormat, download_ready: true });
                        } else {
                            hasError = true;
                            files.push({ index: i + 1, error: `File ${i + 1} failed ${selectedFormat} validation: ${validation.error}`, raw: extracted[i] });
                        }
                    }

                    return new Response(JSON.stringify({
                        status: hasError ? 'partial' : 'success',
                        files,
                        format: selectedFormat,
                        latency_ms: latency,
                    }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }

                // Single-file extraction (backward compatible)
                const extracted = extractFormatContent(aiResponse, selectedFormat);
                if (!extracted.success) {
                    return new Response(JSON.stringify({
                        status: 'error',
                        error: extracted.error,
                        raw: aiResponse,
                    }), {
                        status: 422,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }

                const validation = validateFormatContent(extracted.content, selectedFormat);
                if (!validation.valid) {
                    return new Response(JSON.stringify({
                        status: 'error',
                        error: `Output failed ${selectedFormat} validation: ${validation.error}`,
                        raw: aiResponse,
                    }), {
                        status: 422,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }

                return new Response(JSON.stringify({
                    status: 'success',
                    data: extracted.content,
                    format: selectedFormat,
                    download_ready: true,
                    latency_ms: latency,
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            return new Response(JSON.stringify({ status: 'success', data: result.data, latency_ms: latency }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            aiResponse = result.error;
            status = "error";
            const latency = Date.now() - startTime;

            logInteraction({ personaId: persona_id, userPrompt: userPrompt, aiResponse, latency, status, format: selectedFormat, batchId, filesCount: filesPerCall });

            return new Response(JSON.stringify({ status: 'error', error: result.error }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    } catch (error) {
        status = "error";
        aiResponse = error.message;
        const latency = Date.now() - startTime;
        
        logInteraction({ personaId: persona_id, userPrompt: userPrompt, aiResponse, latency, status, format: null, batchId: null, filesCount: 1 });

        return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
    }
}
