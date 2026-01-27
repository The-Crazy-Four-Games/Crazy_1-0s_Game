import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import type { Repository } from "../../types/repository";
import type { AuditStore } from "../../types/audit";
import type { AuthResult, TokenClaims, SessionToken } from "../../types/auth";
import {
  InvalidCredentials,
  UsernameTaken,
  WeakPassword,
  InvalidToken,
  ExpiredToken,
  TokenSigningError,
  UniqueConstraintViolation,
  RecordNotFound,
} from "../../types/errors";

type AuthConfig = {
  jwtSecret: string;
  tokenTtlSeconds: number;
  bcryptRounds: number;
};

export class AuthService {
  constructor(
    private repo: Repository,
    private audit: AuditStore,
    private cfg: AuthConfig
  ) {}

  private validatePasswordStrength(password: string): void {
    // school-project simple policy
    if (password.length < 6) throw new WeakPassword("Password must be at least 6 characters.");
  }

  issueToken(userId: string, role: "guest" | "user", username?: string): SessionToken {
    try {
      const token = jwt.sign(
        { username, role },
        this.cfg.jwtSecret,
        { subject: userId, expiresIn: this.cfg.tokenTtlSeconds }
      );
      return token;
    } catch (e) {
      throw new TokenSigningError("Failed to sign token.");
    }
  }

  verifyToken(token: SessionToken): TokenClaims {
    try {
      const decoded = jwt.verify(token, this.cfg.jwtSecret) as any;
      // jwt.verify returns payload; subject lives in decoded.sub
      return {
        userId: decoded.sub,
        username: decoded.username,
        role: decoded.role,
        iat: decoded.iat,
        exp: decoded.exp,
      };
    } catch (e: any) {
      if (e?.name === "TokenExpiredError") throw new ExpiredToken();
      if (e?.name === "JsonWebTokenError") throw new InvalidToken();
      throw new TokenSigningError("Token verification error.");
    }
  }

  async createAccount(username: string, password: string): Promise<AuthResult> {
    username = username.trim();
    if (!username) throw new UsernameTaken("Username cannot be empty.");
    this.validatePasswordStrength(password);

    // Create player first
    let playerId: string;
    try {
      const player = await this.repo.createPlayer({ username });
      playerId = player.id;
    } catch (e: any) {
      if (e instanceof UniqueConstraintViolation) throw new UsernameTaken();
      throw e;
    }

    // Store hashed credential
    const passwordHash = await bcrypt.hash(password, this.cfg.bcryptRounds);
    try {
      await this.repo.storeCredential(playerId, { username, passwordHash, playerId });
    } catch (e: any) {
      // if storing credential fails, this is a simple project; keep it minimal
      throw e;
    }

    const token = this.issueToken(playerId, "user", username);

    await this.audit.logAuthEvent({
      action: "register",
      username,
      playerId,
      success: true,
      timestamp: Date.now(),
    });

    return { token, user: { userId: playerId, username, role: "user" } };
  }

  async login(username: string, password: string): Promise<AuthResult> {
    username = username.trim();
    try {
      const cred = await this.repo.getCredentialByUsername(username);
      const ok = await bcrypt.compare(password, cred.passwordHash);
      if (!ok) throw new InvalidCredentials();

      const token = this.issueToken(cred.playerId, "user", username);

      await this.audit.logAuthEvent({
        action: "login",
        username,
        playerId: cred.playerId,
        success: true,
        timestamp: Date.now(),
      });

      return { token, user: { userId: cred.playerId, username, role: "user" } };
    } catch (e: any) {
      await this.audit.logAuthEvent({
        action: "login",
        username,
        success: false,
        timestamp: Date.now(),
        meta: { reason: e?.name ?? "unknown" },
      });

      if (e instanceof RecordNotFound) throw new InvalidCredentials("Account not found.");
      throw e;
    }
  }

  async createGuestSession(deviceId: string): Promise<AuthResult> {
    // for MVP: guest userId is random; username is derived
    const guestId = crypto.randomUUID();
    const guestUsername = `guest_${deviceId || guestId.slice(0, 8)}`;

    // Optional: create a player record for guest so other modules can reference playerId
    // If you don't want to store guests, you can skip this. Here we store it.
    try {
      await this.repo.createPlayer({ username: guestUsername, displayName: "Guest" });
    } catch {
      // if username collision, ignore (very rare); still issue token with guestId
    }

    const token = this.issueToken(guestId, "guest", guestUsername);

    await this.audit.logAuthEvent({
      action: "guest",
      username: guestUsername,
      playerId: guestId,
      success: true,
      timestamp: Date.now(),
    });

    return { token, user: { userId: guestId, username: guestUsername, role: "guest" } };
  }

  async logout(_token: SessionToken): Promise<void> {
    // JWT stateless MVP: do nothing. (Optionally denylist here.)
    await this.audit.logAuthEvent({
      action: "logout",
      success: true,
      timestamp: Date.now(),
    });
  }

  async refreshToken(token: SessionToken): Promise<SessionToken> {
    const claims = this.verifyToken(token);
    // MVP: just re-issue a new token with fresh expiry
    return this.issueToken(claims.userId, claims.role, claims.username);
  }
}
