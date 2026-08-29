import path from "path";
import fs from "fs";
import config from "./config";
import { readFile } from "fs/promises";
import exifr from "exifr";
import { getPhotoByName, insertImage, Photo } from "./database/photo";
import { SessionMakerSession } from "./sessionMaker";
import { addTagsToImage, createTag, getTagByName } from "./database/tags";
import { insertImageTag } from "./database/photo_tag";
import { session } from ".";
import { randomUUID } from "crypto";

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
  const added: Photo[] = [];

  for await (const file of files) {
    // skip directories (like "locked" if still present)
    const fullPath = `${basePath}/${file}`;
    if (fs.statSync(fullPath).isDirectory()) continue;

    const buffer = await readFile(fullPath);
    const exif = (await exifr.parse(buffer)) ?? {};
    const date = exif["CreateDate"] as Date;

    if (!getPhotoByName(file, true)) {
      const photo = insertImage(file, date ?? new Date(), true);
      added.push(photo);

      if (file.startsWith("LOCKED_")) {
        insertImageTag(photo.id, tag!.id);
      }

      console.log(
        `${file} ${file.startsWith("LOCKED_") ? "LOCKED " : ""}was inserted`,
      );
    }
  }

  if (process.env["DISCORD_WEBHOOK"] && added.length > 0) {
    const sessionId = session.options.makeSession?.() ?? randomUUID();
    const s = session.options.db.set({
      id: sessionId,
      lifetime: 60 * 60 * 24 * 5,
      allow_locked: false,
      created_at: new Date().toISOString(),
    });

    const host = process.env["HOST"] ?? "(unknown-host)";

    const random = added.sort(() => Math.random() - 0.5).slice(0, 5);
    const message =
      `I added new photos to my website! :3 Check them out: ${host}?smid=${s.id}` +
      `\n\n${random.map((x) => `${host}/images/${x.id}/view?smid=${s.id}`).join(" ")}`;

    await fetch(process.env["DISCORD_WEBHOOK"], {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: message,
      }),
    });
  }
}
