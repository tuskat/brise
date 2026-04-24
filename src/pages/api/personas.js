import fs from 'node:fs/promises';
import path from 'node:path';

const PERSONAS_DIR = path.resolve(process.cwd(), 'personas');

/** GET /api/personas — list all personas */
export async function GET() {
  try {
    const files = await fs.readdir(PERSONAS_DIR);
    const personaFiles = files.filter((f) => f.endsWith('.json'));
    const personas = await Promise.all(
      personaFiles.map(async (file) => {
        const content = await fs.readFile(path.join(PERSONAS_DIR, file), 'utf-8');
        return JSON.parse(content);
      }),
    );
    return new Response(JSON.stringify(personas), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/** POST /api/personas — create a new persona */
export async function POST({ request }) {
  try {
    const body = await request.json();
    const { id, name, system_prompt, parameters } = body;

    if (!id || !name || !system_prompt) {
      return new Response(
        JSON.stringify({ error: 'id, name, and system_prompt are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Validate id format (alphanumeric, hyphens)
    if (!/^[a-z0-9-]+$/.test(id)) {
      return new Response(
        JSON.stringify({ error: 'id must be lowercase alphanumeric with hyphens only' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const filePath = path.join(PERSONAS_DIR, `${id}.json`);

    // Check if already exists
    try {
      await fs.access(filePath);
      return new Response(
        JSON.stringify({ error: `Persona "${id}" already exists` }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      );
    } catch {
      // File doesn't exist — proceed
    }

    const persona = {
      id,
      name,
      system_prompt,
      parameters: {
        temperature: parameters?.temperature ?? 0.7,
        top_p: parameters?.top_p ?? 0.9,
        max_tokens: parameters?.max_tokens ?? 2000,
      },
    };

    await fs.mkdir(PERSONAS_DIR, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(persona, null, 2), 'utf-8');

    return new Response(JSON.stringify({ status: 'success', data: persona }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/** PUT /api/personas — update an existing persona */
export async function PUT({ request }) {
  try {
    const body = await request.json();
    const { id, name, system_prompt, parameters } = body;

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const filePath = path.join(PERSONAS_DIR, `${id}.json`);

    let existing;
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      existing = JSON.parse(content);
    } catch {
      return new Response(
        JSON.stringify({ error: `Persona "${id}" not found` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const updated = {
      id,
      name: name ?? existing.name,
      system_prompt: system_prompt ?? existing.system_prompt,
      parameters: {
        temperature: parameters?.temperature ?? existing.parameters?.temperature ?? 0.7,
        top_p: parameters?.top_p ?? existing.parameters?.top_p ?? 0.9,
        max_tokens: parameters?.max_tokens ?? existing.parameters?.max_tokens ?? 2000,
      },
    };

    await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8');

    return new Response(JSON.stringify({ status: 'success', data: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/** DELETE /api/personas — delete a persona by id */
export async function DELETE({ request }) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const filePath = path.join(PERSONAS_DIR, `${id}.json`);

    try {
      await fs.access(filePath);
    } catch {
      return new Response(
        JSON.stringify({ error: `Persona "${id}" not found` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    await fs.unlink(filePath);

    return new Response(JSON.stringify({ status: 'success', message: `Persona "${id}" deleted` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
