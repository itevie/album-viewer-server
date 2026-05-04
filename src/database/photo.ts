import fs from "fs";
import config from "../config";
import { db } from "./init";
import { addTagsToImage, addTagsToImages } from "./tags";

export interface Photo {
  id: number;
  name: string;
  added_at: string;
  notes: string;
  tags: number[];
}

/**
 * Helper: filters out photos that contain ANY locked tag
 */
function filterLockedPhotos<T extends { id: number }>(
  photos: T[],
  allow_locked: boolean = false
): T[] {
  if (allow_locked) return photos;

  return photos.filter((photo) => {
    const hasLocked = db
      .prepare<[number], { exists: number }>(
        `
        SELECT 1 as e
        FROM image_tags it
        JOIN tags t ON t.id = it.tag_id
        WHERE it.image_id = ?
          AND t.is_locked = 1
        LIMIT 1
        `
      )
      .get(photo.id);

    return !hasLocked;
  });
}

/**
 * Get all photos
 */
export function getPhotos(allow_locked: boolean = false): Photo[] {
  const photos = db.prepare<[], Photo>("SELECT * FROM images").all();

  return addTagsToImages(
    filterLockedPhotos(photos, allow_locked),
    allow_locked
  );
}

/**
 * Get photo by ID
 */
export function getPhoto(
  id: number,
  allow_locked: boolean = false
): Photo | undefined {
  const photo = db
    .prepare<[number], Photo>("SELECT * FROM images WHERE id = ?")
    .get(id);

  const filtered = filterLockedPhotos(photo ? [photo] : [], allow_locked)[0];

  return addTagsToImage(filtered, allow_locked);
}

/**
 * Delete photo
 */
export function deletePhoto(photo: Photo): void {
  db.prepare<[number]>("DELETE FROM image_tags WHERE image_id = ?").run(
    photo.id
  );
  db.prepare<[number]>("DELETE FROM images WHERE id = ?").run(photo.id);

  const path = `${config.dataPath}/images/${photo.name}`;

  try {
    fs.rmSync(path);
  } catch (e) {
    console.log(e);
  }
}

/**
 * Get photo by name
 */
export function getPhotoByName(
  name: string,
  allow_locked: boolean = false
): Photo | undefined {
  const photo = db
    .prepare<[string], Photo>("SELECT * FROM images WHERE name = ?")
    .get(name);

  const filtered = filterLockedPhotos(photo ? [photo] : [], allow_locked)[0];

  return addTagsToImage(filtered, allow_locked);
}

/**
 * Update notes
 */
export function setNotes(
  photoId: number,
  notes: string,
  allow_locked: boolean = false
): Photo {
  const photo = db
    .prepare<[string, number], Photo>(
      "UPDATE images SET notes = ? WHERE id = ? RETURNING *"
    )
    .get(notes, photoId)!;

  const filtered = filterLockedPhotos([photo], allow_locked)[0];

  return addTagsToImage(filtered, allow_locked)!;
}

/**
 * Insert image
 */
export function insertImage(
  name: string,
  addedAt: Date,
  allow_locked: boolean = false
): Photo {
  const photo = db
    .prepare<[string, string], Photo>(
      "INSERT INTO images (name, added_at) VALUES (?, ?) RETURNING *"
    )
    .get(name, addedAt.toISOString())!;

  return addTagsToImage(photo, allow_locked)!;
}

/**
 * Search photos
 */
export function searchPhotos(
  photos: Photo[],
  search: string,
  tags: number[],
  allow_locked: boolean = false
): Photo[] {
  const normalize = (s: string) =>
    (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const query = normalize(search);

  return filterLockedPhotos(photos, allow_locked).filter((photo) => {
    const haystack = normalize(`${photo.name} ${photo.notes}`);

    const textMatch =
      query === "" ||
      haystack.includes(query) ||
      query.split(/\s+/).some((part) => part && haystack.includes(part));

    const tagMatch =
      tags.length === 0 ||
      (tags.length === 1 && tags[0] === -1) ||
      tags.every((tag) => (photo.tags || []).includes(tag));

    return textMatch && tagMatch;
  });
}
