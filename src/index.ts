import express from "express";
import config from "./config";
import { db, initDb } from "./database";
import * as fs from "fs";
import cors from "cors";
import { initSessionMaker, SessionMakerSession } from "./sessionMaker";
import "dotenv/config";
import { resolve } from "path";
import multer from "multer";
import { randomUUID } from "crypto";
import { scan } from "./util";

export const app = express();

app.use(cors());
app.use(express.json());

app.set("trust proxy", true);
app.use((req, res, next) => {
  const isLocalhost =
    req.hostname === "localhost" ||
    req.hostname === "127.0.0.1" ||
    req.ip === "::1";

  const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";

  if (!isLocalhost && !isSecure) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }

  next();
});

export const session = initSessionMaker({
  app,
  makeSession: randomUUID,
  // makeSession: () => {
  //   let keys = "abcdefghijklmnopqrstuvwxyz".split("");
  //   let value = "";

  //   for (let i = 0; i != 6; i++) {
  //     value += keys[Math.floor(Math.random() * keys.length)];
  //   }

  //   return value;
  // },
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
          lifetime INT NOT NULL DEFAULT 86400000
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
    console.log((req as any).headers["Admin-Session"]);
    console.log(process.env["SESSION_PASSWORD"]);
    return (
      (req as any).headers["admin-session"] === process.env["SESSION_PASSWORD"]
    );
  },
});

export const upload = multer({ dest: "uploads/" });

app.use(express.static(resolve(__dirname + "/web")));

import "./routes/images";
import "./routes/tags";
import "./routes/upload";
import "./routes/util";

(async () => {
  initDb();

  let path = config.dataPath + "/images";
  if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
  if (!fs.existsSync(config.dataPath + "/resize"))
    fs.mkdirSync(config.dataPath + "/resize");

  scan();

  let port = process.env["PORT"];
  app.listen(port);
  console.log(`Listening on port ${port}`);
})();
