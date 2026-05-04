import Database from "better-sqlite3";
import path from "node:path";
import fs, { existsSync } from "node:fs";
import config from "../config";

let dbPath = config.dataPath + "/data.db";
console.log(`Path is ${dbPath}`);

if (!existsSync(path.dirname(dbPath)))
  fs.mkdirSync(dbPath, { recursive: true });

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      added_at TEXT NOT NULL,
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_locked INTEGER NOT NULL DEFAULT 0,
      added_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS image_tags (
      image_id INTEGER NOT NULL REFERENCES images(id),
      tag_id INTEGER NOT NULL REFERENCES tags(id),
      UNIQUE(image_id, tag_id)
    );
  `);
}
