import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'pigmalea.db');

// Connect to SQLite database
export const db = new Database(dbPath);

// Enable WAL mode (Write-Ahead Logging) for better concurrency and speed
db.pragma('journal_mode = WAL');

// Promise-based query helpers for backward compatibility with server.mjs
export const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const result = stmt.run(params);
      resolve({ id: result.lastInsertRowid, changes: result.changes });
    } catch (err) {
      reject(err);
    }
  });
};

export const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const row = stmt.get(params);
      resolve(row);
    } catch (err) {
      reject(err);
    }
  });
};

export const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all(params);
      resolve(rows);
    } catch (err) {
      reject(err);
    }
  });
};

// Initialize schema
export const initDb = async () => {
  try {
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        original_name TEXT NOT NULL,
        size INTEGER NOT NULL,
        width INTEGER,
        height INTEGER,
        status TEXT DEFAULT 'uploaded',
        ai_analysis TEXT,
        enhanced_filepath TEXT,
        enhanced_filename TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Database schema checked/initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize database schema:', err);
    throw err;
  }
};
