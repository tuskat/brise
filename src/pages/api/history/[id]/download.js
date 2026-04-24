import { getHistoryDetail } from '../../../../lib/db.js';
import { extractMultipleFormatContent, formatExtension } from '../../../../lib/format-extractor.js';

export async function GET({ params, request }) {
    try {
        const id = parseInt(params.id, 10);
        const entry = getHistoryDetail(id);

        if (!entry) {
            return new Response(JSON.stringify({ error: 'History entry not found' }), { status: 404 });
        }

        if (!entry.format) {
            return new Response(JSON.stringify({ error: 'Not a file generation entry' }), { status: 404 });
        }

        const url = new URL(request.url);
        const fileIndex = parseInt(url.searchParams.get('file') || '1', 10);

        // Extract all fenced blocks for this format
        const blocks = extractMultipleFormatContent(entry.ai_response, entry.format);

        if (fileIndex < 1 || fileIndex > blocks.length) {
            return new Response(JSON.stringify({ error: `File index ${fileIndex} out of range (1–${blocks.length})` }), { status: 404 });
        }

        const content = blocks[fileIndex - 1];
        const ext = formatExtension(entry.format);
        const filename = entry.files_count > 1
            ? `output-${fileIndex}.${ext}`
            : `output.${ext}`;

        return new Response(content, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
