import fs from "fs";
import { app, session, upload } from "..";
import path from "path";
import config from "../config";
import { scan } from "../util";

app.post("/upload", upload.array("files"), async (req, res) => {
  if (!(await session.authenticateAdmin(req, res))) return;

  if (!req.files)
    return res.status(400).send({
      message: "No files provided",
    });

  try {
    const destDir = path.join(config.dataPath, "images");

    for (const file of req.files as Express.Multer.File[]) {
      let p = path.basename(file.originalname);

      const destPath = path.join(destDir, p);

      fs.renameSync(file.path, destPath);
    }

    scan();

    res.status(200).send("Files uploaded!");
  } catch (err) {
    console.error(err);
    res.status(500).send("Upload failed");
  }
});
