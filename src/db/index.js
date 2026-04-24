import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.resolve('data');
const DB_PATH = path.join(DB_DIR, 'history.db');

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Initialize Table
db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        persona_id TEXT,
        user_prompt TEXT,
        ai_response TEXT,
        latency INTEGER,
        status TEXT
    )
`);

// Initialize Conversations Table
db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        persona_id TEXT,
        proxy_id TEXT,
        model TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Initialize Conversation Messages Table
db.exec(`
    CREATE TABLE IF NOT EXISTS conversation_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        persona_name TEXT,
        latency INTEGER,
        status TEXT DEFAULT 'success',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
`);

// Migrate: add persona_name column if missing (new column in INC-006)
const msgCols = db.prepare('PRAGMA table_info(conversation_messages)').all();
if (!msgCols.find(c => c.name === 'persona_name')) {
    db.exec(`ALTER TABLE conversation_messages ADD COLUMN persona_name TEXT`);
}

// Personas & Proxies (previously stored as JSON files on disk)
db.exec(`
    CREATE TABLE IF NOT EXISTS personas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        system_prompt TEXT NOT NULL,
        parameters TEXT NOT NULL DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS proxies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        model TEXT NOT NULL,
        is_local_network INTEGER NOT NULL DEFAULT 1,
        api_key TEXT,
        api_schema TEXT NOT NULL DEFAULT 'ollama',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME
    );
`);

// Seed defaults on first boot (tables empty)
const SEED_PERSONAS = [
    {
        id: 'coder-pro',
        name: 'Senior Software Engineer',
        system_prompt: 'You are an expert developer. Write clean, modular, and well-documented code. Use best practices.',
        parameters: { temperature: 0.2, top_p: 0.9, max_tokens: 2000 },
    },
    {
        id: 'creative-writer',
        name: 'Creative Writer',
        system_prompt: 'You are a talented and imaginative creative writer. Use evocative language and rich metaphors.',
        parameters: { temperature: 0.9, top_p: 1.0, max_tokens: 2000 },
    },
];

const SEED_PROXIES = [
    {
        id: 'ollama-local',
        name: 'Ollama Local',
        url: 'http://localhost:11434/api/generate',
        model: 'your-model',
        is_local_network: 1,
        api_key: null,
        api_schema: 'ollama',
    },
];

if (db.prepare('SELECT COUNT(*) as c FROM personas').get().c === 0) {
    const insert = db.prepare(`
        INSERT INTO personas (id, name, system_prompt, parameters)
        VALUES (?, ?, ?, ?)
    `);
    for (const p of SEED_PERSONAS) {
        insert.run(p.id, p.name, p.system_prompt, JSON.stringify(p.parameters));
    }
}

if (db.prepare('SELECT COUNT(*) as c FROM proxies').get().c === 0) {
    const insert = db.prepare(`
        INSERT INTO proxies (id, name, url, model, is_local_network, api_key, api_schema)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of SEED_PROXIES) {
        insert.run(p.id, p.name, p.url, p.model, p.is_local_network, p.api_key, p.api_schema);
    }
}

function rowToPersona(row) {
    if (!row) return null;
    let parameters = {};
    try { parameters = JSON.parse(row.parameters || '{}'); } catch { parameters = {}; }
    return { id: row.id, name: row.name, system_prompt: row.system_prompt, parameters };
}

function rowToProxy(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        url: row.url,
        model: row.model,
        is_local_network: !!row.is_local_network,
        api_key: row.api_key,
        api_schema: row.api_schema || 'ollama',
        created_at: row.created_at,
        last_used: row.last_used,
    };
}

export const personaStore = {
    listAll() {
        return db.prepare('SELECT * FROM personas ORDER BY name').all().map(rowToPersona);
    },
    get(id) {
        return rowToPersona(db.prepare('SELECT * FROM personas WHERE id = ?').get(id));
    },
    create(persona) {
        const params = JSON.stringify(persona.parameters || {});
        db.prepare(`
            INSERT INTO personas (id, name, system_prompt, parameters)
            VALUES (?, ?, ?, ?)
        `).run(persona.id, persona.name, persona.system_prompt, params);
        return this.get(persona.id);
    },
    update(id, patch) {
        const existing = this.get(id);
        if (!existing) return null;
        const merged = {
            name: patch.name ?? existing.name,
            system_prompt: patch.system_prompt ?? existing.system_prompt,
            parameters: {
                temperature: patch.parameters?.temperature ?? existing.parameters?.temperature ?? 0.7,
                top_p: patch.parameters?.top_p ?? existing.parameters?.top_p ?? 0.9,
                max_tokens: patch.parameters?.max_tokens ?? existing.parameters?.max_tokens ?? 2000,
            },
        };
        db.prepare(`
            UPDATE personas SET name = ?, system_prompt = ?, parameters = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(merged.name, merged.system_prompt, JSON.stringify(merged.parameters), id);
        return this.get(id);
    },
    delete(id) {
        return db.prepare('DELETE FROM personas WHERE id = ?').run(id).changes > 0;
    },
};

export const proxyStore = {
    listAll() {
        return db.prepare('SELECT * FROM proxies ORDER BY name').all().map(rowToProxy);
    },
    get(id) {
        return rowToProxy(db.prepare('SELECT * FROM proxies WHERE id = ?').get(id));
    },
    upsert(proxy) {
        const existing = this.get(proxy.id);
        if (existing) {
            const merged = { ...existing, ...proxy };
            db.prepare(`
                UPDATE proxies SET name = ?, url = ?, model = ?, is_local_network = ?, api_key = ?, api_schema = ?
                WHERE id = ?
            `).run(
                merged.name, merged.url, merged.model,
                merged.is_local_network ? 1 : 0,
                merged.api_key ?? null,
                merged.api_schema || 'ollama',
                proxy.id,
            );
        } else {
            db.prepare(`
                INSERT INTO proxies (id, name, url, model, is_local_network, api_key, api_schema)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                proxy.id, proxy.name, proxy.url, proxy.model,
                proxy.is_local_network ? 1 : 0,
                proxy.api_key ?? null,
                proxy.api_schema || 'ollama',
            );
        }
        return this.get(proxy.id);
    },
    delete(id) {
        return db.prepare('DELETE FROM proxies WHERE id = ?').run(id).changes > 0;
    },
    touch(id) {
        db.prepare('UPDATE proxies SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    },
};

export const dbOperations = {
    async logInteraction(interaction) {
        const { persona_id, user_prompt, ai_response, latency, status } = interaction;
        const stmt = db.prepare(`
            INSERT INTO prompt_logs (persona_id, user_prompt, ai_response, latency, status)
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(persona_id, user_prompt, ai_response, latency, status);
    },
    
    async getLogs() {
        return db.prepare('SELECT * FROM prompt_logs ORDER BY timestamp DESC').all();
    },

    // ═══════════════════════════════════════════════════════════════
    // CONVERSATION OPERATIONS
    // ═══════════════════════════════════════════════════════════════

    async listConversations() {
        return db.prepare(`
            SELECT
                c.*,
                (SELECT COUNT(*) FROM conversation_messages WHERE conversation_id = c.id) as message_count,
                (SELECT content FROM conversation_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
            FROM conversations c
            ORDER BY c.updated_at DESC
        `).all();
    },

    async createConversation({ title = 'New Conversation', persona_id, proxy_id, model }) {
        const stmt = db.prepare(`
            INSERT INTO conversations (title, persona_id, proxy_id, model)
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(title, persona_id || null, proxy_id || null, model || null);
        return { id: result.lastInsertRowid, title, persona_id, proxy_id, model };
    },

    async getConversation(id) {
        const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
        if (!conversation) return null;
        
        const messages = db.prepare(`
            SELECT * FROM conversation_messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
        `).all(id);
        
        return { ...conversation, messages };
    },

    async updateConversationTitle(id, title) {
        const stmt = db.prepare(`
            UPDATE conversations 
            SET title = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        return stmt.run(title, id);
    },

    async deleteConversation(id) {
        const stmt = db.prepare('DELETE FROM conversations WHERE id = ?');
        return stmt.run(id);
    },

    async touchConversation(id) {
        const stmt = db.prepare(`
            UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `);
        return stmt.run(id);
    },

    async addMessage({ conversation_id, role, content, persona_name = null, latency = null, status = 'success' }) {
        const stmt = db.prepare(`
            INSERT INTO conversation_messages (conversation_id, role, content, persona_name, latency, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(conversation_id, role, content, persona_name, latency, status);
        await this.touchConversation(conversation_id);
        return { id: result.lastInsertRowid, conversation_id, role, content, persona_name, latency, status };
    },

    async updateMessageLatency(messageId, latency, status = 'success') {
        const stmt = db.prepare(`
            UPDATE conversation_messages SET latency = ?, status = ? WHERE id = ?
        `);
        return stmt.run(latency, status, messageId);
    },

    async updateMessageContent(messageId, content, latency = null, status = 'success', persona_name = null) {
        const stmt = db.prepare(`
            UPDATE conversation_messages SET content = ?, latency = ?, status = ?, persona_name = COALESCE(?, persona_name) WHERE id = ?
        `);
        return stmt.run(content, latency, status, persona_name, messageId);
    },

    async updateConversationModel(id, model) {
        const stmt = db.prepare(`
            UPDATE conversations SET model = ? WHERE id = ?
        `);
        return stmt.run(model, id);
    },

    async deleteLastAssistantMessage(conversation_id) {
        const stmt = db.prepare(`
            DELETE FROM conversation_messages 
            WHERE conversation_id = ? AND role = 'assistant'
            ORDER BY id DESC LIMIT 1
        `);
        return stmt.run(conversation_id);
    }
};
