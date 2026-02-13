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
  maxIncorrectSession?: number;
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

// Resets when server resets
let requestMap: { [key: string]: number } = {};

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
      lifetime: 86400000,
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

  function isRatelimited(ip: string): boolean {
    if (!requestMap[ip]) requestMap[ip] = 0;
    return requestMap[ip] > (options.maxIncorrectSession ?? 10);
  }

  function increaseRatelimit(ip: string): void {
    if (!requestMap[ip]) requestMap[ip] = 0;
    requestMap[ip]++;
  }

  let r: SessionMakerReturn = {
    authenticateAdmin: async (req, res) => {
      if (isRatelimited((req as any).ip))
        return (res as any).status(401).send({
          message: "Too many login attempts",
        });

      if (!(await options.authenticateAdmin(req, res))) {
        increaseRatelimit((req as any).ip);
        (res as any).status(401).send({
          message: "Not authenticated as admin",
        });
        return false;
      }

      return true;
    },
    authenticateSession: async (req, res) => {
      if (isRatelimited((req as any).ip))
        return (res as any).status(401).send({
          message: "Too many login attempts",
        });

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
        increaseRatelimit((req as any).ip);
        (res as any).status(401).send({
          message: "Invalid session",
        });
        return false;
      }

      if (
        Date.now() - new Date(session.created_at).getTime() >
        session.lifetime
      ) {
        options.db.del(session.id);
        return (res as any).status(401).send({
          message: "Session expired",
        });
      }

      return true;
    },
  };

  return r;
}
