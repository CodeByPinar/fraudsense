import type { AuthUser } from "../types.js";

export interface AuthUserRepository {
  findByUsername(username: string): Promise<AuthUser | null>;
}
