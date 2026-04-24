import { getHistoryForExport } from '../../lib/db.js';

export async function GET({ request }) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    const id = url.searchParams.get('id');

    const rows = getHistoryForExport(id);

    // Filter out undefined rows (happens when id doesn't exist)
    const validRows = rows.filter(r => r !== undefined && r !== null);

    if (validRows.length === 0) {
      return new Response(JSON.stringify({ status: 'error', error: 'No record found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (format === 'csv') {
      const header = 'id,timestamp,persona_id,user_prompt,ai_response,latency_ms,status';
      const escapeCsv = (val) => {
        const s = String(val ?? '');
        if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      const csvRows = validRows.map((r) =>
        [r.id, r.timestamp, r.persona_id, r.user_prompt, r.ai_response, r.latency, r.status]
          .map(escapeCsv)
          .join(','),
      );
      const csv = [header, ...csvRows].join('\n');

      const filename = id ? `history-${id}.csv` : 'history-export.csv';
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Default: JSON
    const filename = id ? `history-${id}.json` : 'history-export.json';
    return new Response(JSON.stringify(validRows, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ status: 'error', error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
