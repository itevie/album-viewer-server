import path from "path";
import fs from "fs";
import config from "./config";
import { readFile } from "fs/promises";
import exifr from "exifr";
import { getPhotoByName, insertImage } from "./database/photo";
import { SessionMakerSession } from "./sessionMaker";
import { addTagsToImage, createTag, getTagByName } from "./database/tags";
import { insertImageTag } from "./database/photo_tag";

export function getDirSize(dir: string) {
  let total = 0;

  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      total += getDirSize(full);
    } else {
      total += stat.size;
    }
  }

  return total;
}

export async function scan() {
  const basePath = `${config.dataPath}/images`;
  const lockedPath = `${basePath}/locked`;

  if (fs.existsSync(lockedPath)) {
    const lockedFiles = fs.readdirSync(lockedPath);

    for (const file of lockedFiles) {
      const oldPath = `${lockedPath}/${file}`;
      const newName = file.startsWith("LOCKED_") ? file : `LOCKED_${file}`;
      const newPath = `${basePath}/${newName}`;

      try {
        fs.renameSync(oldPath, newPath);
        console.log(`Moved locked image: ${file} -> ${newName}`);
      } catch (e) {
        console.log(`Failed to move ${file}`, e);
      }
    }
  }
  let tag = getTagByName("all_locked", true);
  if (!tag) {
    createTag("all_locked", true);
    tag = getTagByName("all_locked", true);
  }

  const files = fs.readdirSync(basePath);

  for await (const file of files) {
    // skip directories (like "locked" if still present)
    const fullPath = `${basePath}/${file}`;
    if (fs.statSync(fullPath).isDirectory()) continue;

    const buffer = await readFile(fullPath);
    const exif = (await exifr.parse(buffer)) ?? {};
    const date = exif["CreateDate"] as Date;

    if (!getPhotoByName(file, true)) {
      const photo = insertImage(file, date ?? new Date(), true);

      if (file.startsWith("LOCKED_")) {
        insertImageTag(photo.id, tag!.id);
      }

      console.log(
        `${file} ${file.startsWith("LOCKED_") ? "LOCKED " : ""}was inserted`
      );
    }
  }
}
