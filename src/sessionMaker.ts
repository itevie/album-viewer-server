import { Express } from "express";
import { randomUUID } from "node:crypto";

export interface SessionMakerSession {
  id: string;
  lifetime: number;
  created_at: string;
}

export interface SessionMakerOptions {
  app: Express;
  makeSession?: () => string;
  db: {
    init: () => void;
    get: (id: string) => SessionMakerSession | undefined;
    set: (session: SessionMakerSession) => SessionMakerSession;
    del: (id: string) => void;
  };
  authenticateAdmin: (
    req: Express.Request,
    res: Express.Response,
  ) => Promise<boolean>;
}

export interface SessionMakerReturn {
  authenticateSession: (
    req: Express.Request,
    res: Express.Response,
  ) => Promise<boolean>;

  authenticateAdmin: (
    req: Express.Request,
    res: Express.Response,
  ) => Promise<boolean>;
}

export function initSessionMaker(
  options: SessionMakerOptions,
): SessionMakerReturn {
  options.db.init();

  options.app.post("/session/create", async (req, res) => {
    if (!(await options.authenticateAdmin(req, res))) {
      return res.status(401).send({
        message: "Failed to authenticate",
      });
    }

    let sessionId = (options.makeSession ?? randomUUID)();

    let session = options.db.set({
      id: sessionId,
      lifetime: 64000,
      created_at: new Date().toISOString(),
    });

    return res.status(200).send(session);
  });

  options.app.get("/session/test", async (req, res) => {
    if (!(await r.authenticateSession(req, res))) return;
    return res.status(200).send({
      message: "Success!",
    });
  });

  let r: SessionMakerReturn = {
    authenticateAdmin: async (req, res) => {
      if (!(await options.authenticateAdmin(req, res))) {
        (res as any).status(401).send({
          message: "Not authenticated as admin",
        });
        return false;
      }

      return true;
    },
    authenticateSession: async (req, res) => {
      let id = [
        (req as any).query?.["smid"],
        (req as any).body?.["smid"],
        (req as any).headers?.["smid"],
      ].filter((x) => !!x)[0];

      if (!id) {
        (res as any).status(401).send({
          message: "Missing smid",
        });
        return false;
      }

      let session = options.db.get(id);

      if (!session || typeof session != "object") {
        (res as any).status(401).send({
          message: "Invalid session",
        });
        return false;
      }

      return true;
    },
  };

  return r;
}
