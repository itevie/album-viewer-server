import { db } from "./init";
import { Photo } from "./photo";
import { ImageTag } from "./photo_tag";

export interface Tag {
  id: number;
  name: string;
  added_at: string;
  is_locked: number;
}

/**
 * Get all tags
 */
export function getTags(allow_locked: boolean = false): Tag[] {
  return db
    .prepare<[number], Tag>("SELECT * FROM tags WHERE (? = 1 OR is_locked = 0)")
    .all(allow_locked ? 1 : 0);
}

/**
 * Create a tag
 */
export function createTag(name: string, is_locked: boolean = false): void {
  db.prepare<[string, string, number]>(
    "INSERT INTO tags (name, added_at, is_locked) VALUES (?, ?, ?)"
  ).run(name, new Date().toISOString(), is_locked ? 1 : 0);
}

/**
 * Get a tag by name
 */
export function getTagByName(
  name: string,
  allow_locked: boolean = false
): Tag | undefined {
  return db
    .prepare<[string, number], Tag>(
      "SELECT * FROM tags WHERE name = ? AND (? = 1 OR is_locked = 0)"
    )
    .get(name, allow_locked ? 1 : 0);
}

/**
 * Get all images that have a given tag
 */
export function getImagesTag(
  tag: number,
  allow_locked: boolean = false
): Photo[] {
  return addTagsToImages(
    db
      .prepare<[number, number], Photo>(
        `
        SELECT *
        FROM images
        WHERE id IN (
          SELECT it.image_id
          FROM image_tags it
          JOIN tags t ON t.id = it.tag_id
          WHERE it.tag_id = ?
            AND (? = 1 OR t.is_locked = 0)
        )
        `
      )
      .all(tag, allow_locked ? 1 : 0),
    allow_locked
  );
}

/**
 * Attach tags to a single image
 */
export function addTagsToImage(
  image: Photo | undefined,
  allow_locked: boolean = false
): Photo | undefined {
  if (image === undefined) return undefined;

  return {
    ...image,
    tags: getTagsForImage(image.id, allow_locked),
  };
}

/**
 * Attach tags to multiple images
 */
export function addTagsToImages(
  images: Omit<Photo, "tags">[],
  allow_locked: boolean = false
): Photo[] {
  return images.map((x) => ({
    ...x,
    tags: getTagsForImage(x.id, allow_locked),
  }));
}

/**
 * Get tag IDs for an image
 */
export function getTagsForImage(
  imageId: number,
  allow_locked: boolean = false
): number[] {
  return db
    .prepare<[number, number], ImageTag & { is_locked: number }>(
      `
      SELECT it.tag_id, t.is_locked
      FROM image_tags it
      JOIN tags t ON t.id = it.tag_id
      WHERE it.image_id = ?
        AND (? = 1 OR t.is_locked = 0)
      `
    )
    .all(imageId, allow_locked ? 1 : 0)
    .map((x) => x.tag_id);
}
