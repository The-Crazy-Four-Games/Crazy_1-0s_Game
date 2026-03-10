import { Router } from "express";

export function makeHealthRouter() {
  const router = Router();
  router.get("/", (_req, res) => res.json({ ok: true }));
  return router;
}
