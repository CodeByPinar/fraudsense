import { SignJWT, importPKCS8, importSPKI, jwtVerify } from "jose";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { AuthError } from "../../../shared/errors/AppError.js";
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenPair,
  UserRole
} from "../domain/types.js";

const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAjxo6WuKbH0nYhgKFvwDx
jhZgOhSgk5tLef34aCncScTvcN0bvBskBu+w6ZPH1tiyN8C/O7SEsbnIiX1g8LFo
vDUIvk9258fYT+cFCs1XFgA6fZk4s0vYn4OtEJ5EdZ4L1N+GD52uJiBkefLQzYSI
4Ba7uKDN5m1sVGsFhn5M4FxkTYfPo7WDXAoLHtWd/4E3ew+ezPtjP59+p7H+fIvA
6mhjl/rjra5JMAwfFQXl2YJ01NARwqQSXi6qG6PLvnhazigS15bpFM0yeKXjgV96
uIypi+h6+uMJw8v9BY233RzuQ2QpRIoV3JD/eogvz1Cfxww6ik8OAZYtXxMma9CQ
oQIDAQAB
-----END PUBLIC KEY-----`;

const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCPGjpa4psfSdiG
AoW/APGOFmA6FKCTm0t5/fhoKdxJxO9w3Ru8GyQG77Dpk8fW2LI3wL87tISxuciJ
fWDwsWi8NQi+T3bnx9hP5wUKzVcWADp9mTizS9ifg60QnkR1ngvU34YPna4mIGR5
8tDNhIjgFru4oM3mbWxUawWGfkzgXGRNh8+jtYNcCgse1Z3/gTd7D57M+2M/n36n
sf58i8DqaGOX+uOtrkkwDB8VBeXZgnTU0BHCpBJeLqobo8u+eFrOKBLXlukUzTJ4
peOBX3q4jKmL6Hr64wnDy/0FjbfdHO5DZClEihXckP96iC/PUJ/HDDqKTw4Bli1f
EyZr0JChAgMBAAECggEAAK2lgJ+TJUjtAvZv+SZdWWthcO20OhDjUM3SMQG09L/6
CSibexw3PZsXypqlM3SxtGY9rdAgAno8m+tlXkyz+rORvJpdMvGZahMLR5hkCQOE
I3W6h+M0a236X/eFFZg5FYJVT7LYqTSlT0dA2RQ0zyLycw2xk33Ef2pbXh5lru5Q
CNod0MEls4A4A8Hoi9jil00eqSy3Htay0IVmYwxIsoFppkduBQNZhBBghQWC8nv4
Qo309y0RWHmbCC/G6Fyc5X1CjiD1QTMWvYdg50zS1k0cg7uK68prnsuEQrm0ymmg
sdC1zwOduacYxQXgWXrYPlCOGQbmiSWI5QbJRnAZAQKBgQDDwx5CQHaEDRp6Qg8L
ewMZ7xVqa3rdKNgLgr7ARP40g5w017VivY+TAv3FvcSdMPt8uB5X0ZbGBIZxGGkE
cxegoyQ+MH6T7ARuXl9/x09RP28YQn7vs1WaB/RGh0fsmtMaSDqrSmiQV06MYCp9
F7cBGcr4QKOe51s83uz+sc+igQKBgQC7IuqFi4UU2lvVwxp7cD0hxWvXDOlnS6/s
PezhcmLR4mf/I6Vz793/KXP8iux/PZWMzlAW63qk2mSFexYHX40VfTWMZW6DAbwP
L8rMK5mwZplIALDSRXfpayQD9tcYXi+TKlV2K10WhxJWtems3GvI4g9I6ni3zoKr
gFOBl0GeIQKBgGDaIBZXHkumz/q8xATCD369MrM8CcVxd7H6NbWabMo+cwIR1sPL
VUU+rZ8vjB7ZJRNHZHu+TgIaKwm5MfvplT78d+nsxDMbCfYw6r6lNTDVWXl/LJ4a
87cJSGm8dHEzCE5wfdZRMfp3t3zr9xl8qiX5RNod4NW1UQaEpGw+PKQBAoGAPfCk
p2cyuWA9HVfioBDaax8pPpjreGE47Xzhtw1hYA8MVQq7bNBsLlTOKzzgYo1DvsNb
BvsSMRaIRxYiiHY8AGzdGIdKONqOIIi1GzcjO5v6CDcST8bmlb/8v8MoFsy1+oP8
nYxk11wF2eWEXs7mbitE2+Gf61bTMWjcOvyRn4ECgYEAsnJ6ayAaxjXKHim3B2Xi
KURFdXGJxJP7xFyQOsYASjxu7E3bXyVW26HUSsK+4KROmpx/bELlQY+PhKryPrmX
ZHz7/Exrm6I7PXvAgMonYq//1NM6WtjYfi0kZEFDE57IOIeCwrwR+Vqv0iD2LHGs
00SeH4rwlB2rBLmBpUEjOiw=
-----END PRIVATE KEY-----`;

export interface JwtServiceConfig {
  privateKeyPem?: string;
  publicKeyPem?: string;
  issuer: string;
  audience: string;
  accessTokenTtlSec: number;
  refreshTokenTtlSec: number;
  isTestMode: boolean;
  allowNonProductionFallbackKeys?: boolean;
}

export interface VerifiedAccessToken {
  userId: string;
  role: UserRole;
}

export interface VerifiedRefreshToken {
  userId: string;
  role: UserRole;
  tokenId: string;
  tokenHash: string;
  expiresAt: Date;
}

export class JwtService {
  private readonly config: JwtServiceConfig;

  public constructor(config: JwtServiceConfig) {
    this.config = config;
  }

  public hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  public secureEqualHash(inputToken: string, storedHash: string): boolean {
    const currentHash = Buffer.from(this.hashToken(inputToken), "utf8");
    const existingHash = Buffer.from(storedHash, "utf8");
    if (currentHash.length !== existingHash.length) {
      return false;
    }
    return timingSafeEqual(currentHash, existingHash);
  }

  public async createTokenPair(userId: string, role: UserRole): Promise<TokenPair & {
    refreshTokenId: string;
    refreshTokenHash: string;
    refreshTokenExpiresAt: Date;
  }> {
    const accessToken = await this.signAccessToken({
      sub: userId,
      role,
      type: "access"
    });

    const refreshTokenId = randomUUID();
    const refreshTokenExpiresAt = new Date(Date.now() + this.config.refreshTokenTtlSec * 1000);
    const refreshToken = await this.signRefreshToken({
      sub: userId,
      role,
      type: "refresh",
      jti: refreshTokenId
    });

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresInSeconds: this.config.accessTokenTtlSec,
      refreshTokenId,
      refreshTokenHash: this.hashToken(refreshToken),
      refreshTokenExpiresAt
    };
  }

  public async verifyAccessToken(token: string): Promise<VerifiedAccessToken> {
    const key = await importSPKI(this.resolvePublicKey(), "RS256");
    const { payload } = await jwtVerify(token, key, {
      issuer: this.config.issuer,
      audience: this.config.audience
    });

    if (payload.type !== "access" || typeof payload.sub !== "string" || typeof payload.role !== "string") {
      throw new AuthError("Invalid access token");
    }

    return {
      userId: payload.sub,
      role: payload.role as UserRole
    };
  }

  public async verifyRefreshToken(token: string): Promise<VerifiedRefreshToken> {
    const key = await importSPKI(this.resolvePublicKey(), "RS256");
    const { payload } = await jwtVerify(token, key, {
      issuer: this.config.issuer,
      audience: this.config.audience
    });

    if (
      payload.type !== "refresh" ||
      typeof payload.sub !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.jti !== "string"
    ) {
      throw new AuthError("Invalid refresh token");
    }

    return {
      userId: payload.sub,
      role: payload.role as UserRole,
      tokenId: payload.jti,
      tokenHash: this.hashToken(token),
      expiresAt: new Date((payload.exp ?? 0) * 1000)
    };
  }

  private async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    const key = await importPKCS8(this.resolvePrivateKey(), "RS256");
    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(`${this.config.accessTokenTtlSec}s`)
      .sign(key);
  }

  private async signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
    const key = await importPKCS8(this.resolvePrivateKey(), "RS256");
    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setSubject(payload.sub)
      .setJti(payload.jti)
      .setIssuedAt()
      .setExpirationTime(`${this.config.refreshTokenTtlSec}s`)
      .sign(key);
  }

  private resolvePrivateKey(): string {
    if (this.config.privateKeyPem?.includes("BEGIN PRIVATE KEY")) {
      return this.config.privateKeyPem;
    }

    if (this.config.isTestMode || this.config.allowNonProductionFallbackKeys) {
      return TEST_PRIVATE_KEY;
    }

    throw new AuthError("JWT private key is not configured", 500);
  }

  private resolvePublicKey(): string {
    if (this.config.publicKeyPem?.includes("BEGIN PUBLIC KEY")) {
      return this.config.publicKeyPem;
    }

    if (this.config.isTestMode || this.config.allowNonProductionFallbackKeys) {
      return TEST_PUBLIC_KEY;
    }

    throw new AuthError("JWT public key is not configured", 500);
  }
}
