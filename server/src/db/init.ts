import Database from 'better-sqlite3';

/**
 * Initializes the database with the required schema and seed data.
 * @param dbPath Path to the SQLite database file.
 * @returns The better-sqlite3 Database instance.
 */
export function initDb(dbPath: string) {
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
      FOREIGN KEY (PersonId) REFERENCES Person(PersonId),
      UNIQUE(FileStageId, Hash)
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
