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
