import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = path.join(__dirname, '../../data/history.db');

import fs from 'fs';
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS prompt_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    persona_id TEXT,
    user_prompt TEXT,
    ai_response TEXT,
    latency INTEGER,
    status TEXT,
    format TEXT,
    batch_id TEXT,
    files_count INTEGER DEFAULT 1
  )
`);

// Migration: add columns if they don't exist (SQLite ALTER TABLE)
const columns = db.prepare("PRAGMA table_info(prompt_logs)").all().map(c => c.name);
if (!columns.includes('format')) {
  db.exec('ALTER TABLE prompt_logs ADD COLUMN format TEXT');
}
if (!columns.includes('batch_id')) {
  db.exec('ALTER TABLE prompt_logs ADD COLUMN batch_id TEXT');
}
if (!columns.includes('files_count')) {
  db.exec('ALTER TABLE prompt_logs ADD COLUMN files_count INTEGER DEFAULT 1');
}

export function logInteraction(interaction) {
  const { personaId, userPrompt, aiResponse, latency, status, format, batchId, filesCount } = interaction;
  const stmt = db.prepare(`
    INSERT INTO prompt_logs (persona_id, user_prompt, ai_response, latency, status, format, batch_id, files_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(personaId, userPrompt, aiResponse, latency, status, format || null, batchId || null, filesCount || 1);
}

export function getHistory(limit = 50) {
  const stmt = db.prepare(`SELECT * FROM prompt_logs ORDER BY timestamp DESC LIMIT ?`);
  return stmt.all(limit);
}

export function getHistoryDetail(id) {
  const stmt = db.prepare(`SELECT * FROM prompt_logs WHERE id = ?`);
  return stmt.get(id);
}

export function getHistoryForExport(id = null) {
  if (id) {
    const stmt = db.prepare(`SELECT * FROM prompt_logs WHERE id = ?`);
    return [stmt.get(id)];
  }
  const stmt = db.prepare(`SELECT * FROM prompt_logs ORDER BY timestamp DESC`);
  return stmt.all();
}

export function getMetrics() {
  const totalRequests = db.prepare(`SELECT COUNT(*) as count FROM prompt_logs`).get().count;

  const successfulRequests = db.prepare(
    `SELECT COUNT(*) as count FROM prompt_logs WHERE status = 'success'`,
  ).get().count;

  const failedRequests = totalRequests - successfulRequests;

  const avgLatency =
    db.prepare(`SELECT AVG(latency) as avg FROM prompt_logs WHERE status = 'success'`).get().avg ??
    0;

  const minLatency =
    db.prepare(`SELECT MIN(latency) as min FROM prompt_logs WHERE status = 'success'`).get().min ??
    0;

  const maxLatency =
    db.prepare(`SELECT MAX(latency) as max FROM prompt_logs WHERE status = 'success'`).get().max ??
    0;

  // Average latency over last 10 requests (recent performance)
  const recentAvgLatency =
    db.prepare(
      `SELECT AVG(latency) as avg FROM (
        SELECT latency FROM prompt_logs WHERE status = 'success' ORDER BY timestamp DESC LIMIT 10
      )`,
    ).get().avg ?? 0;

  // Persona usage frequency
  const personaUsage = db
    .prepare(
      `SELECT persona_id, COUNT(*) as count FROM prompt_logs GROUP BY persona_id ORDER BY count DESC`,
    )
    .all();

  // Requests per day (last 7 days)
  const dailyUsage = db
    .prepare(
      `SELECT DATE(timestamp) as date, COUNT(*) as count FROM prompt_logs
       WHERE timestamp >= datetime('now', '-7 days')
       GROUP BY DATE(timestamp) ORDER BY date ASC`,
    )
    .all();

  // Success rate
  const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    successRate: Math.round(successRate * 10) / 10,
    avgLatency: Math.round(avgLatency),
    minLatency,
    maxLatency,
    recentAvgLatency: Math.round(recentAvgLatency),
    personaUsage,
    dailyUsage,
  };
}
