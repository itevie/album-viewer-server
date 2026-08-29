import { Express } from "express";
import { randomUUID } from "node:crypto";

export interface SessionMakerSession {
  id: string;
  lifetime: number;
  allow_locked: boolean;
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

  authenticateLocked: (
    req: Express.Request,
    res: Express.Response,
  ) => Promise<boolean>;
  options: SessionMakerOptions;
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

    let lifetime: number = 86400000;
    if (req.query["lifetime"]) {
      if (isNaN(parseInt(req.query["lifetime"].toString())))
        return res.status(400).send({
          message: "Lifetime is not valid",
        });
      lifetime = parseInt(req.query["lifetime"].toString());
    }

    let allow_locked = false;
    if (req.query["allow_locked"]) {
      let part = req.query["allow_locked"];

      if (part === "true") {
        allow_locked = true;
      }
    }

    let sessionId =
      (options.makeSession ?? randomUUID)() + (allow_locked ? "_LOCKED" : "");

    let session = options.db.set({
      id: sessionId,
      lifetime: lifetime,
      created_at: new Date().toISOString(),
      allow_locked,
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
    authenticateLocked: async (req, res) => {
      if (await options.authenticateAdmin(req, res)) {
        return true;
      }

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
        return false;
      }

      return session.allow_locked;
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
    options: options,
  };

  return r;
}
