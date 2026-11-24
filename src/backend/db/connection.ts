import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let sharedDb: DatabaseSync | null = null;
let sharedDbPath: string | null = null;

export function resolveDatabasePath(customPath?: string): string {
  if (customPath) {
    return path.resolve(customPath);
  }
  const envPath = process.env.SQLITE_DB_PATH?.trim();
  if (envPath) {
    return path.resolve(envPath);
  }
  return path.resolve(process.cwd(), 'data', 'order_to_audit.db');
}

export function openDatabase(dbPath?: string): DatabaseSync {
  const resolved = resolveDatabasePath(dbPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const db = new DatabaseSync(resolved);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  return db;
}

export function getDb(customPath?: string): DatabaseSync {
  const resolved = resolveDatabasePath(customPath);
  if (!sharedDb || sharedDbPath !== resolved) {
    if (sharedDb) {
      sharedDb.close();
    }
    sharedDb = openDatabase(resolved);
    sharedDbPath = resolved;
  }
  return sharedDb;
}

export function closeDb(): void {
  if (sharedDb) {
    sharedDb.close();
    sharedDb = null;
    sharedDbPath = null;
  }
}

export function runInTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // Ignore rollback errors if transaction was already closed.
    }
    throw err;
  }
}
