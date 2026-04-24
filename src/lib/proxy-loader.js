import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const proxiesDir = path.join(__dirname, '../../proxies');

/**
 * Ensure proxies directory exists
 */
async function ensureProxiesDir() {
  try {
    await fs.mkdir(proxiesDir, { recursive: true });
  } catch (err) {
    // Directory exists, ignore
  }
}

/**
 * Load all proxy configurations
 * @returns {Promise<Array>}
 */
export async function loadAllProxies() {
  await ensureProxiesDir();
  
  const files = await fs.readdir(proxiesDir);
  const proxies = [];
  
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const content = await fs.readFile(path.join(proxiesDir, file), 'utf-8');
        const proxy = JSON.parse(content);
        // Handle both array and single-object files
        if (Array.isArray(proxy)) {
          proxies.push(...proxy);
        } else {
          proxies.push(proxy);
        }
      } catch (err) {
        console.error(`Failed to load proxy file ${file}:`, err.message);
      }
    }
  }
  
  return proxies;
}

/**
 * Load a single proxy by ID
 * @param {string} id - Proxy ID
 * @returns {Promise<Object|null>}
 */
export async function loadProxy(id) {
  const proxies = await loadAllProxies();
  return proxies.find(p => p.id === id) || null;
}

/**
 * Save a proxy configuration
 * @param {Object} proxy - Proxy config object
 * @returns {Promise<void>}
 */
export async function saveProxy(proxy) {
  await ensureProxiesDir();
  
  // Load existing proxies
  const proxies = await loadAllProxies();
  const existingIndex = proxies.findIndex(p => p.id === proxy.id);
  
  if (existingIndex >= 0) {
    // Update existing
    proxies[existingIndex] = { ...proxies[existingIndex], ...proxy };
  } else {
    // Add new
    proxies.push({
      ...proxy,
      created_at: new Date().toISOString(),
      last_used: null
    });
  }
  
  // Write to default.json (single file for all proxies)
  await fs.writeFile(
    path.join(proxiesDir, 'default.json'),
    JSON.stringify(proxies, null, 2)
  );
}

/**
 * Delete a proxy by ID
 * @param {string} id - Proxy ID
 * @returns {Promise<boolean>}
 */
export async function deleteProxy(id) {
  await ensureProxiesDir();
  
  const proxies = await loadAllProxies();
  const filtered = proxies.filter(p => p.id !== id);
  
  if (filtered.length === proxies.length) {
    return false; // Not found
  }
  
  await fs.writeFile(
    path.join(proxiesDir, 'default.json'),
    JSON.stringify(filtered, null, 2)
  );
  
  return true;
}

/**
 * Update last_used timestamp for a proxy
 * @param {string} id - Proxy ID
 * @returns {Promise<void>}
 */
export async function touchProxy(id) {
  const proxies = await loadAllProxies();
  const proxy = proxies.find(p => p.id === id);
  
  if (proxy) {
    proxy.last_used = new Date().toISOString();
    await fs.writeFile(
      path.join(proxiesDir, 'default.json'),
      JSON.stringify(proxies, null, 2)
    );
  }
}
