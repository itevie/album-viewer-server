import path from "path";
import fs from "fs";
import config from "./config";
import { readFile } from "fs/promises";
import exifr from "exifr";
import { getPhotoByName, insertImage } from "./database";

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
  let path = config.dataPath + "/images";

  let files = fs.readdirSync(path);

  for await (const file of files) {
    let buffer = await readFile(`${path}/${file}`);
    let exif = await exifr.parse(buffer);
    let date = exif["CreateDate"] as Date;
    if (!getPhotoByName(file)) {
      insertImage(file, date ?? new Date());
      console.log(`${file} was inserted`);
    }
  }
}
