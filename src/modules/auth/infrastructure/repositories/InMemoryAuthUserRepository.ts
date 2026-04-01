import { createHash } from "node:crypto";
import type { AuthUserRepository } from "../../domain/repositories/AuthUserRepository.js";
import type { AuthUser } from "../../domain/types.js";

function hashPassword(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export class InMemoryAuthUserRepository implements AuthUserRepository {
  private readonly users: AuthUser[] = [
    {
      id: "u-admin",
      username: "admin",
      passwordHash: hashPassword("Admin#12345"),
      role: "ADMIN"
    },
    {
      id: "u-analyst",
      username: "analyst",
      passwordHash: hashPassword("Analyst#12345"),
      role: "ANALYST"
    },
    {
      id: "u-risk",
      username: "risk",
      passwordHash: hashPassword("Risk#12345"),
      role: "RISK_OFFICER"
    }
  ];

  public async findByUsername(username: string): Promise<AuthUser | null> {
    return this.users.find((item) => item.username === username) ?? null;
  }
}
