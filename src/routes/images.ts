import exifr from "exifr";
import { Express } from "express";
import {
  deletePhoto,
  getImagesTag,
  getPhoto,
  getPhotos,
  getTagByName,
} from "../database";
import config from "../config";
import fs from "fs";
import { app, session } from "..";
import sharp from "sharp";
import { readFile } from "fs/promises";

app.delete("/images", async (req, res) => {
  if (!(await session.authenticateAdmin(req, res))) return;

  if (
    !req.body?.["images"] ||
    !Array.isArray(req.body["images"]) ||
    !(req.body["images"] as []).every((x) => typeof x === "number")
  )
    return res.status(400).send({
      message: 'Body must contain "images" which is an array of numbers',
    });

  let images = req.body["images"] as number[];

  let photos = getPhotos().filter((x) => images.includes(x.id));

  for (const photo of photos) deletePhoto(photo);

  return res.status(200).send({
    message: "Success",
  });
});

app.get("/images", async (req, res) => {
  if (!(await session.authenticateSession(req, res))) return;
  return res.send(getPhotos());
});

app.get("/random", async (req, res) => {
  if (!(await session.authenticateSession(req, res))) return;

  let photos = getPhotos();

  return res
    .status(200)
    .send(getPhotos()[Math.floor(Math.random() * photos.length)]);
});

app.get("/images/:tag", async (req, res) => {
  if (!(await session.authenticateSession(req, res))) return;

  let tag = getTagByName(req.params.tag);

  if (tag === undefined)
    return res.send({
      message: "Invalid tag!",
    });

  return res.send(getImagesTag(tag.id));
});

app.get("/images/:id/view", async (req, res) => {
  if (!(await session.authenticateSession(req, res))) return;

  let id: number;
  if (isNaN(parseInt(req.params.id))) {
    return res.status(400).send({
      message: "Invalid id!",
    });
  }

  id = parseInt(req.params.id);

  let image = getPhoto(id);

  if (!image) {
    return res.status(404).send({
      message: "Image not found",
    });
  }

  let path = config.dataPath + "/images/" + image.name;

  if (!fs.existsSync(path)) {
    return res.status(500).send({
      message: "Image file does not exist on disk",
    });
  }

  if (req.query["size"]) {
    const size = Math.min(
      Math.max(parseInt(req.query["size"].toString()), 50),
      4000,
    );

    let result: Buffer<ArrayBufferLike> | null = null;

    let resizePath = `${config.dataPath}/resize/${size}@${image.name}`;
    if (fs.existsSync(resizePath)) result = fs.readFileSync(resizePath);

    if (!result) {
      result = await sharp(fs.readFileSync(path))
        .resize({ width: size })
        .webp({ quality: 70 })
        .toBuffer();

      fs.writeFileSync(resizePath, result);
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.type("image/webp");
    return res.status(200).send(result);
  }

  return res.sendFile(path);
});

app.get("/images/:id/exif", async (req, res) => {
  if (!(await session.authenticateSession(req, res))) return;

  let id: number;
  if (isNaN(parseInt(req.params.id))) {
    return res.status(400).send({
      message: "Invalid id!",
    });
  }

  id = parseInt(req.params.id);

  let image = getPhoto(id);

  if (!image) {
    return res.status(404).send({
      message: "Image not found",
    });
  }

  let path = config.dataPath + "/images/" + image.name;

  if (!fs.existsSync(path)) {
    return res.status(500).send({
      message: "Image file does not exist on disk",
    });
  }

  let buffer = await readFile(path);
  let exif = await exifr.parse(buffer);

  return res.send(exif);
});
