import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Extract content from a fenced model output.
 * @param {string} raw - Raw model response
 * @param {string} format - Expected format (md, html, json, csv)
 * @returns {{ success: boolean, content?: string, error?: string }}
 */
export function extractFormatContent(raw, format) {
  // Strict match: entire response is the fenced block
  const strictRegex = new RegExp('^```' + format + '\\s*\\n([\\s\\S]*?)\\n```\\s*$');
  const strictMatch = raw.trim().match(strictRegex);

  if (strictMatch) {
    return { success: true, content: strictMatch[1] };
  }

  // Lenient fallback: find first fenced block matching the format
  const lenientRegex = new RegExp('```' + format + '\\s*\\n([\\s\\S]*?)\\n```');
  const lenientMatch = raw.match(lenientRegex);

  if (lenientMatch) {
    return { success: true, content: lenientMatch[1] };
  }

  return { success: false, error: `No \`\`\`${format} fenced block found in model output` };
}

/**
 * Validate extracted content against format rules.
 * @param {string} content - Extracted content
 * @param {string} format - Format identifier
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFormatContent(content, format) {
  switch (format) {
    case 'md':
      return content.trim().length > 0
        ? { valid: true }
        : { valid: false, error: 'Markdown output is empty' };

    case 'html':
      if (!content.includes('<html') || !content.includes('</html>')) {
        return { valid: false, error: 'HTML must contain <html> and </html> tags' };
      }
      return { valid: true };

    case 'json':
    case 'json-strict':
      try {
        JSON.parse(content);
        // json-strict: additional schema validation will be done by caller if schema provided
        return { valid: true };
      } catch (e) {
        return { valid: false, error: `Invalid JSON: ${e.message}` };
      }

    case 'csv':
      const lines = content.trim().split('\n');
      if (lines.length < 2) {
        return { valid: false, error: 'CSV must have at least a header row and one data row' };
      }
      if (!content.includes(',')) {
        return { valid: false, error: 'CSV must contain comma delimiters' };
      }
      return { valid: true };

    default:
      return { valid: false, error: `Unknown format: ${format}` };
  }
}

/**
 * Get the file extension for a format.
 */
export function formatExtension(format) {
  const map = { md: 'md', html: 'html', json: 'json', 'json-strict': 'json', csv: 'csv' };
  return map[format] || 'txt';
}

/**
 * Load format schema from /format-schemas/<format>.json
 * @param {string} format - Format identifier
 * @returns {Promise<object|null>}
 */
export async function loadFormatSchema(format) {
  const schemasDir = path.resolve(process.cwd(), 'format-schemas');
  const filePath = path.join(schemasDir, `${format}.json`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Extract multiple fenced blocks from a model response.
 * @param {string} raw - Raw model response
 * @param {string} format - Expected format (md, html, json, csv)
 * @returns {string[]} Array of extracted contents (may be empty)
 */
export function extractMultipleFormatContent(raw, format) {
  const regex = new RegExp('```' + format + '\\s*\\n([\\s\\S]*?)\\n```', 'g');
  const results = [];
  let match;
  while ((match = regex.exec(raw)) !== null) {
    results.push(match[1]);
  }
  return results;
}

/**
 * Build the format instruction string to append to the system prompt.
 * @param {string} format - Format identifier
 * @param {object} schema - Loaded schema from format-schemas/<format>.json
 * @param {number} [filesPerCall=1] - Number of separate format blocks to produce
 * @returns {string}
 */
export function buildFormatInstruction(format, schema, filesPerCall = 1) {
  let instruction = `\n\n--- FORMAT INSTRUCTION ---\n`;

  if (filesPerCall > 1) {
    instruction += `You must generate exactly **${filesPerCall}** separate \`\`\`${format}\`\`\` blocks in your response. Each block is one file.\n`;
  } else {
    instruction += `You must generate output in the ${format.toUpperCase()} format.\n`;
  }

  if (schema) {
    if (schema.type === 'template' && schema.template) {
      instruction += `\nUse this template and replace {{placeholders}} with content:\n${schema.template}\n`;
    } else if (schema.type === 'suggestion' && schema.suggestions) {
      instruction += `\nFollow these formatting suggestions:\n`;
      schema.suggestions.forEach(s => {
        instruction += `- ${s}\n`;
      });
    } else if (schema.type === 'strict' && schema.schema) {
      instruction += `\nYour output MUST strictly validate against this JSON Schema:\n${JSON.stringify(schema.schema, null, 2)}\n`;
      instruction += `If your output does not match this schema, it will be rejected.\n`;
    }
  }

  if (filesPerCall > 1) {
    instruction += `\nOutput EXACTLY:\n`;
    for (let i = 1; i <= filesPerCall; i++) {
      instruction += `\`\`\`${format}\n[file ${i} content]\n\`\`\`\n`;
    }
    instruction += `Nothing else. No preamble. No explanation.`;
  } else {
    instruction += `\nOutput EXACTLY:\n\`\`\`${format}\n[your content]\n\`\`\`\nNothing else. No preamble. No explanation.`;
  }

  return instruction;
}
