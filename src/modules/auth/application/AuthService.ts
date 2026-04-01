import { createHash, timingSafeEqual } from "node:crypto";
import { AuthError } from "../../../shared/errors/AppError.js";
import type { AuthUserRepository } from "../domain/repositories/AuthUserRepository.js";
import type { RefreshTokenRepository } from "../domain/repositories/RefreshTokenRepository.js";
import type { TokenPair, UserRole } from "../domain/types.js";
import { JwtService } from "./JwtService.js";

export class AuthService {
  public constructor(
    private readonly userRepository: AuthUserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly jwtService: JwtService
  ) {}

  public async login(username: string, password: string): Promise<TokenPair> {
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      throw new AuthError("Invalid credentials");
    }

    const inputHash = createHash("sha256").update(password).digest("hex");
    const inputBuffer = Buffer.from(inputHash, "utf8");
    const expectedBuffer = Buffer.from(user.passwordHash, "utf8");

    if (
      inputBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(inputBuffer, expectedBuffer)
    ) {
      throw new AuthError("Invalid credentials");
    }

    const pair = await this.jwtService.createTokenPair(user.id, user.role);
    await this.refreshTokenRepository.save({
      tokenId: pair.refreshTokenId,
      userId: user.id,
      tokenHash: pair.refreshTokenHash,
      expiresAt: pair.refreshTokenExpiresAt,
      revokedAt: null,
      replacedByTokenId: null
    });

    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      tokenType: pair.tokenType,
      expiresInSeconds: pair.expiresInSeconds
    };
  }

  public async refresh(refreshToken: string): Promise<TokenPair> {
    const verified = await this.jwtService.verifyRefreshToken(refreshToken);
    const stored = await this.refreshTokenRepository.findByTokenId(verified.tokenId);

    if (!stored || stored.revokedAt !== null || stored.expiresAt.getTime() < Date.now()) {
      throw new AuthError("Refresh token is invalid or expired");
    }

    if (!this.jwtService.secureEqualHash(refreshToken, stored.tokenHash)) {
      throw new AuthError("Refresh token mismatch");
    }

    const nextPair = await this.jwtService.createTokenPair(verified.userId, verified.role);
    await this.refreshTokenRepository.revoke(stored.tokenId, nextPair.refreshTokenId);
    await this.refreshTokenRepository.save({
      tokenId: nextPair.refreshTokenId,
      userId: verified.userId,
      tokenHash: nextPair.refreshTokenHash,
      expiresAt: nextPair.refreshTokenExpiresAt,
      revokedAt: null,
      replacedByTokenId: null
    });

    return {
      accessToken: nextPair.accessToken,
      refreshToken: nextPair.refreshToken,
      tokenType: nextPair.tokenType,
      expiresInSeconds: nextPair.expiresInSeconds
    };
  }

  public async authorize(
    authorizationHeader: string | undefined,
    allowedRoles: UserRole[]
  ): Promise<{ userId: string; role: UserRole }> {
    if (!authorizationHeader?.startsWith("Bearer ")) {
      throw new AuthError("Missing bearer token");
    }

    const token = authorizationHeader.slice("Bearer ".length);
    const payload = await this.jwtService.verifyAccessToken(token);

    if (!allowedRoles.includes(payload.role)) {
      throw new AuthError("Insufficient role permissions", 403);
    }

    return payload;
  }
}
