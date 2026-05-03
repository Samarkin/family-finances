import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/finance.db');

/**
 * Initializes the database with the required schema and seed data.
 * @param dbPath Path to the SQLite database file.
 * @returns The better-sqlite3 Database instance.
 */
export function initDb(dbPath: string = DB_PATH) {
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS Person (
      PersonId INTEGER PRIMARY KEY AUTOINCREMENT,
      Name TEXT UNIQUE NOT NULL,
      MemberRegex TEXT
    );

    CREATE TABLE IF NOT EXISTS Account (
      AccountId INTEGER PRIMARY KEY AUTOINCREMENT,
      Name TEXT UNIQUE NOT NULL,
      FilenameRegex TEXT,
      Sign INTEGER NOT NULL DEFAULT 0,
      AccountRegex TEXT,
      DefaultPersonId INTEGER,
      FOREIGN KEY (DefaultPersonId) REFERENCES Person(PersonId)
    );

    CREATE TABLE IF NOT EXISTS "File" (
      FileId INTEGER PRIMARY KEY AUTOINCREMENT,
      Filename TEXT NOT NULL,
      AccountId INTEGER NOT NULL,
      FOREIGN KEY (AccountId) REFERENCES Account(AccountId)
    );

    CREATE TABLE IF NOT EXISTS "Transaction" (
      Hash TEXT PRIMARY KEY,
      Month TEXT NOT NULL,
      DayOfMonth INTEGER NOT NULL,
      Description TEXT NOT NULL,
      CategoryId TEXT NOT NULL,
      Amount INTEGER NOT NULL,
      AccountId INTEGER NOT NULL,
      FileId INTEGER NOT NULL,
      PersonId INTEGER NOT NULL,
      FOREIGN KEY (AccountId) REFERENCES Account(AccountId),
      FOREIGN KEY (FileId) REFERENCES "File"(FileId) ON DELETE CASCADE,
      FOREIGN KEY (PersonId) REFERENCES Person(PersonId)
    );

    CREATE TABLE IF NOT EXISTS FileStage (
      FileStageId INTEGER PRIMARY KEY AUTOINCREMENT,
      Filename TEXT NOT NULL,
      Sign INTEGER NOT NULL DEFAULT 0,
      AccountId INTEGER,
      FOREIGN KEY (AccountId) REFERENCES Account(AccountId)
    );

    CREATE TABLE IF NOT EXISTS TransactionStage (
      TransactionStageId INTEGER PRIMARY KEY AUTOINCREMENT,
      Hash TEXT NOT NULL,
      Date TEXT NOT NULL,
      Description TEXT NOT NULL,
      Amount INTEGER NOT NULL,
      RawCategory TEXT,
      CategoryId TEXT,
      FileStageId INTEGER NOT NULL,
      PersonId INTEGER,
      FOREIGN KEY (FileStageId) REFERENCES FileStage(FileStageId) ON DELETE CASCADE,
      FOREIGN KEY (PersonId) REFERENCES Person(PersonId)
    );

    CREATE TABLE IF NOT EXISTS CategoryMapping (
      CategoryId TEXT NOT NULL,
      CategoryRegex TEXT,
      DescriptionRegex TEXT,
      AccountId INTEGER,
      FOREIGN KEY (AccountId) REFERENCES Account(AccountId)
    );
  `);

  // Seed Person table with 'Family'
  const insertPerson = db.prepare('INSERT OR IGNORE INTO Person (Name) VALUES (?)');
  insertPerson.run('Family');

  return db;
}

// Run the initialization if this script is executed directly
const isMain =
  process.argv[1] && (process.argv[1].endsWith('init.ts') || process.argv[1].endsWith('init.js'));

if (isMain) {
  console.log(`Initializing database at ${DB_PATH}...`);
  try {
    initDb();
    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}
