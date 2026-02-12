import express from "express";
import config from "./config";
import {
  createTag,
  db,
  getPhoto,
  getPhotoByName,
  getPhotos,
  getImagesTag,
  getTagByName,
  getTags,
  initDb,
  insertImage,
  insertImageTag,
  removeImageTag,
  deletePhoto,
} from "./database";
import * as fs from "fs";
import cors from "cors";
import { readFile } from "fs/promises";
import exifr from "exifr";
import { initSessionMaker, SessionMakerSession } from "./sessionMaker";
import sharp from "sharp";
import "dotenv/config";
import path, { resolve } from "path";
import multer from "multer";

const app = express();
app.use(cors());
app.use(express.json());

let session = initSessionMaker({
  app,
  makeSession: () => {
    let keys = "abcdefghijklmnopqrstuvwxyz".split("");
    let value = "";

    for (let i = 0; i != 6; i++) {
      value += keys[Math.floor(Math.random() * keys.length)];
    }

    return value;
  },
  db: {
    get: (id) => {
      return db
        .prepare<
          [String],
          SessionMakerSession
        >("SELECT * FROM sessions WHERE id = ?")
        .get(id);
    },
    init: () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY NOT NULL,
          created_at TEXT NOT NULL,
          lifetime INT NOT NULL DEFAULT 64000
        );
      `);
    },
    del: (id) => {
      db.prepare<[String]>("DELETE FROM sessions WHERE id = ?").run(id);
    },
    set: (session) => {
      return db
        .prepare<[string, number, string], SessionMakerSession>(
          `
        INSERT INTO sessions (id, lifetime, created_at)
          VALUES(?, ?, ?)
          RETURNING *
      `,
        )
        .get(session.id, session.lifetime, session.created_at)!;
    },
  },
  authenticateAdmin: async (req) => {
    return (
      (req as any).headers["admin-session"] === process.env["SESSION_PASSWORD"]
    );
  },
});

const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.array("files"), async (req, res) => {
  if (!(await session.authenticateAdmin(req, res))) return;

  if (!req.files)
    return res.status(400).send({
      message: "No files provided",
    });

  try {
    const destDir = path.join(config.dataPath, "images");

    for (const file of req.files as Express.Multer.File[]) {
      if (file.originalname.includes("/"))
        return res.status(400).send({
          message: "Image file cannot contain /",
        });

      const destPath = path.join(destDir, file.originalname);

      fs.renameSync(file.path, destPath);
    }

    scan();

    res.status(200).send("Files uploaded!");
  } catch (err) {
    console.error(err);
    res.status(500).send("Upload failed");
  }
});

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
    let result = await sharp(fs.readFileSync(path))
      .resize({ width: parseInt(req.query["size"].toString()) })
      .webp({ quality: 70 })
      .toBuffer();

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

app.get("/tags", async (req, res) => {
  if (!(await session.authenticateSession(req, res))) return;

  return res.send(getTags());
});

app.post("/tags/:tag", async (req, res) => {
  if (!(await session.authenticateSession(req, res))) return;

  let tag = req.params.tag.toString();

  if (getTags().filter((x) => x.name === tag).length != 0)
    return res.status(400).send({
      message: "Tag already exists",
    });

  createTag(tag);

  return res.status(200).send({
    message: "Tag created",
  });
});

app.post("/images/tags/:tag", async (req, res) => {
  if (!(await session.authenticateAdmin(req, res))) return;

  let tag = req.params["tag"].toString();

  let exists = getTags().find((x) => x.id.toString() === tag);

  if (!exists)
    return res.status(400).send({
      message: "Tag does not exist",
    });

  if (
    !req.body["images"] ||
    !Array.isArray(req.body["images"]) ||
    !(req.body["images"] as []).every((x) => typeof x === "number")
  )
    return res.status(400).send({
      message: 'Body must contain "images" which is an array of numbers',
    });

  for (const imageId of req.body["images"] as number[]) {
    insertImageTag(imageId, parseInt(tag));
  }

  return res.status(200).send({
    message: "Success",
  });
});

app.delete("/images/tags/:tag", async (req, res) => {
  if (!(await session.authenticateAdmin(req, res))) return;

  let tag = req.params["tag"].toString();

  let exists = getTags().find((x) => x.id.toString() === tag);

  if (!exists)
    return res.status(400).send({
      message: "Tag does not exist",
    });

  if (
    !req.body["images"] ||
    !Array.isArray(req.body["images"]) ||
    !(req.body["images"] as []).every((x) => typeof x === "number")
  )
    return res.status(400).send({
      message: 'Body must contain "images" which is an array of numbers',
    });

  for (const imageId of req.body["images"] as number[]) {
    removeImageTag(imageId, parseInt(tag));
  }

  return res.status(200).send({
    message: "Success",
  });
});

app.get("/stats", async (req, res) => {
  if (!(await session.authenticateSession(req, res))) return;

  return res.status(200).send({
    photoCount: getPhotos().length,
    tagCount: getTags().length,
    albumSize: getDirSize(config.dataPath),
  });
});

app.use(express.static(resolve(__dirname + "/web")));

(async () => {
  initDb();

  let path = config.dataPath + "/images";
  if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });

  scan();

  app.listen(config.port);
  console.log(`Listening on port ${config.port}`);
})();

function getDirSize(dir: string) {
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

async function scan() {
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
