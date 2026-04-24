import { personaStore } from '../db/index.js';

export async function loadAllPersonas() {
  return personaStore.listAll();
}

export async function loadPersona(id) {
  return personaStore.get(id);
}

export async function savePersona(persona) {
  const existing = personaStore.get(persona.id);
  return existing ? personaStore.update(persona.id, persona) : personaStore.create(persona);
}

export async function deletePersona(id) {
  return personaStore.delete(id);
}
