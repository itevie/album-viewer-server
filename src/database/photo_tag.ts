import { db } from "./init";

export interface ImageTag {
  image_id: number;
  tag_id: number;
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

export function fullyAlternateImageTags(imageId: number, tagIds: number[]) {
  db.prepare<[number]>("DELETE FROM image_tags WHERE image_id = ?").run(
    imageId,
  );

  for (const tagId of tagIds) {
    insertImageTag(imageId, tagId);
  }
}

export function removeImageTag(imageId: number, tagId: number) {
  db.prepare<[number, number]>(
    "DELETE FROM image_tags WHERE image_id = ? AND tag_id = ?",
  ).run(imageId, tagId);
}
