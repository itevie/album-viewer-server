import { app, session } from "..";
import { getPhoto } from "../database/photo";
import {
  fullyAlternateImageTags,
  insertImageTag,
  removeImageTag,
} from "../database/photo_tag";
import { getTags, createTag, addTagsToImage } from "../database/tags";

app.get("/tags", async (req, res) => {
  if (!(await session.authenticateSession(req, res))) return;

  return res.send(getTags(await session.authenticateLocked(req, res)));
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

  let exists = getTags(true).find((x) => x.id.toString() === tag);

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

  let exists = getTags(true).find((x) => x.id.toString() === tag);

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

app.patch("/images/:id/tags", async (req, res) => {
  if (!(await session.authenticateAdmin(req, res))) return;

  let id: number;
  if (isNaN(parseInt(req.params.id))) {
    return res.status(400).send({
      message: "Invalid id!",
    });
  }

  id = parseInt(req.params.id);

  let image = getPhoto(id, await session.authenticateLocked(req, res));

  if (
    !req.body["tags"] ||
    !Array.isArray(req.body["tags"]) ||
    !(req.body["tags"] as []).every((x) => typeof x === "number")
  )
    return res.status(400).send({
      message: 'Body must contain "tags" which is an array of numbers',
    });

  let providedTags = req.body["tags"] as number[];

  let tags = getTags();

  for (const tag of providedTags) {
    if (!tags.find((x) => x.id === tag))
      return res.status(400).send({
        message: `Tag ${tag} does not exist`,
      });
  }

  fullyAlternateImageTags(image!.id, providedTags);

  return res.status(200).send({
    message: "Success",
  });
});
