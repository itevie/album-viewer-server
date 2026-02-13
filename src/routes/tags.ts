import { app, session } from "..";
import {
  createTag,
  getTags,
  insertImageTag,
  removeImageTag,
} from "../database";

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
