import { app, session } from "..";
import config from "../config";
import { getPhotos } from "../database/photo";
import { getTags } from "../database/tags";
import { getDirSize } from "../util";

app.get("/stats", async (req, res) => {
  if (!(await session.authenticateSession(req, res))) return;

  return res.status(200).send({
    photoCount: getPhotos().length,
    tagCount: getTags().length,
    albumSize: getDirSize(config.dataPath),
  });
});
