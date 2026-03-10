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
  AlreadyLoggedIn,
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
  ) { }

  private validatePasswordStrength(password: string): void {
    // school-project simple policy
    if (password.length < 6) throw new WeakPassword("Password must be at least 6 characters.");
  }

  issueToken(userId: string, role: "guest" | "user" | "admin", username?: string): SessionToken {
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

    // Mark session as active
    const claims = this.verifyToken(token);
    await this.repo.setSessionIat(playerId, claims.iat);

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

      // Check if there's an active session
      const existingIat = await this.repo.getSessionIat(cred.playerId);
      if (existingIat !== null) {
        const expiresAt = existingIat + this.cfg.tokenTtlSeconds;
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (nowSeconds < expiresAt) {
          throw new AlreadyLoggedIn();
        }
      }

      const token = this.issueToken(cred.playerId, "user", username);

      // Mark session as active
      const claims = this.verifyToken(token);
      await this.repo.setSessionIat(cred.playerId, claims.iat);

      await this.audit.logAuthEvent({
        action: "login",
        username,
        playerId: cred.playerId,
        success: true,
        timestamp: Date.now(),
      });

      return { token, user: { userId: cred.playerId, username, role: "user" } };
    } catch (e: any) {
      if (e instanceof AlreadyLoggedIn) throw e;

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
    const tag = deviceId || crypto.randomUUID().slice(0, 8);
    const guestUsername = `guest_${tag}`;

    // Create a real player record so other modules can reference playerId
    const player = await this.repo.createPlayer({ username: guestUsername, displayName: `Guest_${tag.slice(0, 4)}` });
    const playerId = player.id;

    const token = this.issueToken(playerId, "guest", guestUsername);

    // Mark session active
    const claims = this.verifyToken(token);
    await this.repo.setSessionIat(playerId, claims.iat);

    await this.audit.logAuthEvent({
      action: "guest",
      username: guestUsername,
      playerId,
      success: true,
      timestamp: Date.now(),
    });

    return { token, user: { userId: playerId, username: guestUsername, role: "guest" } };
  }

  async logout(token: SessionToken): Promise<void> {
    let claims: TokenClaims | null = null;
    try {
      claims = this.verifyToken(token);
      await this.repo.clearSessionIat(claims.userId);
    } catch {
      // token might be invalid/expired, still allow logout
    }

    // If guest, delete their temporary player record
    if (claims && claims.role === "guest") {
      try {
        await this.repo.deletePlayer(claims.userId);
      } catch { /* ignore */ }
    }

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

  async changePassword(userId: string, username: string, oldPassword: string, newPassword: string): Promise<void> {
    // Verify old password
    const cred = await this.repo.getCredentialByUsername(username);
    const ok = await bcrypt.compare(oldPassword, cred.passwordHash);
    if (!ok) throw new InvalidCredentials("Current password is incorrect.");

    // Validate new password
    this.validatePasswordStrength(newPassword);

    // Hash and store
    const newHash = await bcrypt.hash(newPassword, this.cfg.bcryptRounds);
    await this.repo.changePassword(username, newHash);

    await this.audit.logAuthEvent({
      action: "change_password",
      username,
      playerId: userId,
      success: true,
      timestamp: Date.now(),
    });
  }

  async loginAsAdmin(username: string, password: string): Promise<AuthResult> {
    const adminUser = process.env.ADMIN_USERNAME || "admin";
    const adminPass = process.env.ADMIN_PASSWORD || "admin123456";

    if (username !== adminUser || password !== adminPass) {
      throw new InvalidCredentials("Invalid admin credentials.");
    }

    const adminId = "admin-0000-0000-0000";
    const token = this.issueToken(adminId, "admin", adminUser);

    await this.audit.logAuthEvent({
      action: "login",
      username: adminUser,
      playerId: adminId,
      success: true,
      timestamp: Date.now(),
    });

    return { token, user: { userId: adminId, username: adminUser, role: "admin" } };
  }
}
