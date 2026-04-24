import {
  loadAllPersonas,
  loadPersona,
  savePersona,
  deletePersona,
} from '../../lib/persona-loader.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** GET /api/personas — list all personas */
export async function GET() {
  try {
    return json(await loadAllPersonas());
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

/** POST /api/personas — create a new persona */
export async function POST({ request }) {
  try {
    const body = await request.json();
    const { id, name, system_prompt, parameters } = body;

    if (!id || !name || !system_prompt) {
      return json({ error: 'id, name, and system_prompt are required' }, 400);
    }
    if (!/^[a-z0-9-]+$/.test(id)) {
      return json({ error: 'id must be lowercase alphanumeric with hyphens only' }, 400);
    }
    if (await loadPersona(id)) {
      return json({ error: `Persona "${id}" already exists` }, 409);
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

    const saved = await savePersona(persona);
    return json({ status: 'success', data: saved }, 201);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

/** PUT /api/personas — update an existing persona */
export async function PUT({ request }) {
  try {
    const body = await request.json();
    const { id, name, system_prompt, parameters } = body;

    if (!id) return json({ error: 'id is required' }, 400);

    const existing = await loadPersona(id);
    if (!existing) return json({ error: `Persona "${id}" not found` }, 404);

    const updated = await savePersona({
      id,
      name: name ?? existing.name,
      system_prompt: system_prompt ?? existing.system_prompt,
      parameters: {
        temperature: parameters?.temperature ?? existing.parameters?.temperature ?? 0.7,
        top_p: parameters?.top_p ?? existing.parameters?.top_p ?? 0.9,
        max_tokens: parameters?.max_tokens ?? existing.parameters?.max_tokens ?? 2000,
      },
    });

    return json({ status: 'success', data: updated });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

/** DELETE /api/personas — delete a persona by id */
export async function DELETE({ request }) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) return json({ error: 'id is required' }, 400);

    const deleted = await deletePersona(id);
    if (!deleted) return json({ error: `Persona "${id}" not found` }, 404);

    return json({ status: 'success', message: `Persona "${id}" deleted` });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
