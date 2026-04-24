import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PERSONAS_DIR = path.join(__dirname, '../../personas');

/**
 * Ensure personas directory exists
 */
async function ensurePersonasDir() {
  try {
    await fs.mkdir(PERSONAS_DIR, { recursive: true });
  } catch {
    // Already exists, ignore
  }
}

/**
 * Load all personas from the personas directory.
 * @returns {Promise<Array>}
 */
export async function loadAllPersonas() {
  await ensurePersonasDir();
  const files = await fs.readdir(PERSONAS_DIR);
  const personas = [];
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const content = await fs.readFile(path.join(PERSONAS_DIR, file), 'utf-8');
        personas.push(JSON.parse(content));
      } catch (err) {
        console.error(`Failed to load persona file ${file}:`, err.message);
      }
    }
  }
  return personas;
}

/**
 * Load a single persona by id.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function loadPersona(id) {
  const personas = await loadAllPersonas();
  return personas.find(p => p.id === id) || null;
}
