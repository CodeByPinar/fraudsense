import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "../../../../shared/logger.js";

type RedisEvalClient = {
  eval(
    script: string,
    numKeys: number,
    ...args: Array<string | number>
  ): Promise<unknown>;
};

export class VelocityWindowStore {
  private readonly scriptPath = path.join(
    process.cwd(),
    "src/modules/fraud/infrastructure/cache/lua/velocity-window.lua"
  );

  public constructor(private readonly redis: RedisEvalClient) {}

  /**
   * Atomically appends tx to window and returns current count.
   */
  public async incrementAndCount(
    userId: string,
    txId: string,
    nowMs: number,
    windowMs: number
  ): Promise<number> {
    const key = `{${userId}}:velocity`;
    const startMs = nowMs - windowMs;

    try {
      const script = await fs.readFile(this.scriptPath, "utf8");
      const result = await this.redis.eval(script, 1, key, nowMs, startMs, txId);
      return Number(result);
    } catch (error: unknown) {
      logger.warn({ error, userId }, "Redis unavailable, velocity cache bypassed");
      return 0;
    }
  }
}
