import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema.js";
import type { Db } from "./types.js";

export function openDatabase(path: string): Db {
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  return db;
}

export function createSchema(db: Db): void {
  db.exec(SCHEMA_SQL);
}
