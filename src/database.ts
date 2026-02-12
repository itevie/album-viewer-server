import Database from "better-sqlite3";
import path from "node:path";
import fs, { existsSync } from "node:fs";
import config from "./config";

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
      added_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      added_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS image_tags (
      image_id INTEGER NOT NULL REFERENCES images(id),
      tag_id INTEGER NOT NULL REFERENCES tags(id),
      UNIQUE(image_id, tag_id)
    );
  `);
}

export interface Photo {
  id: number;
  name: string;
  added_at: string;
  tags: number[];
}

export interface Tag {
  id: number;
  name: string;
  added_at: string;
}

export interface ImageTag {
  image_id: number;
  tag_id: number;
}

export function getPhotos(): Photo[] {
  return addTagsToImages(db.prepare<[], Photo>("SELECT * FROM images").all());
}

export function getPhoto(id: number): Photo | undefined {
  return addTagsToImage(
    db.prepare<[number], Photo>("SELECT * FROM images WHERE id = ?").get(id),
  );
}

export function deletePhoto(photo: Photo): void {
  db.prepare<[number]>("DELETE FROM image_tags WHERE image_id = ?").run(
    photo.id,
  );
  db.prepare<[number]>("DELETE FROM images WHERE id = ?").run(photo.id);

  let path = `${config.dataPath}/images/${photo.name}`;

  try {
    fs.rmSync(path);
  } catch (e) {
    console.log(e);
  }
}

export function getPhotoByName(name: string): Photo | undefined {
  return addTagsToImage(
    db
      .prepare<[string], Photo>("SELECT * FROM images WHERE name = ?")
      .get(name),
  );
}

export function getTags(): Tag[] {
  return db.prepare<[], Tag>("SELECT * FROM tags").all();
}

export function createTag(name: string): void {
  db.prepare<[string, string]>(
    "INSERT INTO tags (name, added_at) VALUES (?, ?)",
  ).run(name, new Date().toISOString());
}

export function getTagByName(name: String): Tag | undefined {
  return db
    .prepare<[String], Tag>("SELECT * FROM tags WHERE name = ?")
    .get(name);
}

export function getImagesTag(tag: number): Photo[] {
  return db
    .prepare<[number], Photo>(
      `
    SELECT *
    FROM images
    WHERE id IN (
      SELECT image_id
      FROM image_tags
      WHERE tag_id = ?
    );
  `,
    )
    .all(tag);
}

export function addTagsToImage(image: Photo | undefined): Photo | undefined {
  if (image === undefined) return undefined;

  return { ...image, tags: getTagsForImage(image.id) };
}

export function addTagsToImages(images: Omit<Photo, "tags">[]): Photo[] {
  return images.map((x) => ({ ...x, tags: getTagsForImage(x.id) }));
}

export function getTagsForImage(imageId: number): number[] {
  return db
    .prepare<[number], ImageTag>("SELECT * FROM image_tags WHERE image_id = ?")
    .all(imageId)
    .map((x) => x.tag_id);
}

export function insertImage(name: string, addedAt: Date): Photo {
  return db
    .prepare<
      [string, string],
      Photo
    >("INSERT INTO images (name, added_at) VALUES (?, ?) RETURNING *")
    .get(name, addedAt.toISOString())!;
}

export function insertImageTag(imageId: number, tagId: number) {
  try {
    db.prepare<[number, number]>(
      "INSERT INTO image_tags (image_id, tag_id) VALUES (?, ?)",
    ).run(imageId, tagId);
  } catch (e: any) {
    if (!e.toString().includes("UNIQUE")) throw e;
  }
}

export function removeImageTag(imageId: number, tagId: number) {
  db.prepare<[number, number]>(
    "DELETE FROM image_tags WHERE image_id = ? AND tag_id = ?",
  ).run(imageId, tagId);
}
