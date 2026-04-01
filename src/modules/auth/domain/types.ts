export type UserRole = "ANALYST" | "RISK_OFFICER" | "ADMIN";

export interface AuthUser {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
}

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  role: UserRole;
  type: "refresh";
  jti: string;
}

export interface RefreshTokenRecord {
  tokenId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
}
