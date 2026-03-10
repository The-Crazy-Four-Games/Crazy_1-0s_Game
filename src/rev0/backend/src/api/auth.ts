import { Router } from "express";
import type { AuthService } from "../modules/auth/authService";
import { UsernameTaken, WeakPassword, InvalidCredentials } from "../types/errors";

export function makeAuthRouter(auth: AuthService) {
  const router = Router();

  // postRegister
  router.post("/register", async (req, res) => {
    const { username, password } = req.body ?? {};
    try {
      const result = await auth.createAccount(String(username ?? ""), String(password ?? ""));
      res.json(result);
    } catch (e: any) {
      if (e instanceof UsernameTaken) return res.status(409).json({ error: e.message });
      if (e instanceof WeakPassword) return res.status(400).json({ error: e.message });
      return res.status(500).json({ error: "register failed" });
    }
  });

  // postLogin
  router.post("/login", async (req, res) => {
    const { username, password } = req.body ?? {};
    try {
      const result = await auth.login(String(username ?? ""), String(password ?? ""));
      res.json(result);
    } catch (e: any) {
      if (e instanceof InvalidCredentials) return res.status(401).json({ error: e.message });
      return res.status(500).json({ error: "login failed" });
    }
  });

  // postGuestSession
  router.post("/guest", async (req, res) => {
    const { deviceId } = req.body ?? {};
    const result = await auth.createGuestSession(String(deviceId ?? ""));
    res.json(result);
  });

  // postLogout (MVP: stateless)
  router.post("/logout", async (req, res) => {
    const { token } = req.body ?? {};
    await auth.logout(String(token ?? ""));
    res.json({ ok: true });
  });

  return router;
}
