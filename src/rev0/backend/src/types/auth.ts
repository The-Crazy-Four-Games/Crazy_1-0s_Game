import type { UserRole } from "./repository";

export type SessionToken = string;

export type TokenClaims = {
  userId: string;
  username?: string;
  role: UserRole;
  iat: number;
  exp: number;
};

export type AuthResult = {
  token: SessionToken;
  user: {
    userId: string;
    username?: string;
    role: UserRole;
  };
};
