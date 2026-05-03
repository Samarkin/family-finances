import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { initDb } from './init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DB_PATH = path.join(__dirname, '../../data/finance.db');

let db: Database.Database | null = null;

export function getDb(dbPath?: string): Database.Database {
  if (db) return db;

  const path_to_use = dbPath || process.env.DB_PATH || DEFAULT_DB_PATH;

  if (path_to_use !== ':memory:') {
    const dir = path.dirname(path_to_use);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Initialize the database (creates tables if they don't exist)
  db = initDb(path_to_use);

  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
