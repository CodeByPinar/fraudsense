import fg from "fast-glob";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DomainError } from "../../../../shared/errors/AppError.js";
import { logger } from "../../../../shared/logger.js";
import type { BaseRule } from "../../domain/rules/BaseRule.js";
import type { RuleConfigRecord } from "../../domain/types.js";
import * as amountRuleModule from "../../domain/rules/implementations/AmountRule.js";
import * as deviceRuleModule from "../../domain/rules/implementations/DeviceRule.js";
import * as geoRuleModule from "../../domain/rules/implementations/GeoRule.js";
import * as timeRuleModule from "../../domain/rules/implementations/TimeRule.js";
import * as velocityRuleModule from "../../domain/rules/implementations/VelocityRule.js";

type RuleModule = {
  createRule: (config: RuleConfigRecord) => BaseRule;
};

export class RuleLoader {
  public async load(configs: RuleConfigRecord[]): Promise<BaseRule[]> {
    const ruleFiles = await fg("src/modules/fraud/domain/rules/implementations/*.ts", {
      absolute: true
    });

    const modules = new Map<string, RuleModule>();

    for (const file of ruleFiles) {
      const moduleUrl = pathToFileURL(file).href;
      const module = (await import(moduleUrl)) as Partial<RuleModule>;
      const key = path.basename(file, ".ts").replace("Rule", "").toLowerCase();

      if (typeof module.createRule === "function") {
        modules.set(key, module as RuleModule);
      }
    }

    const fallbackModules = new Map<string, RuleModule>([
      ["amount", amountRuleModule as RuleModule],
      ["device", deviceRuleModule as RuleModule],
      ["geo", geoRuleModule as RuleModule],
      ["time", timeRuleModule as RuleModule],
      ["velocity", velocityRuleModule as RuleModule]
    ]);

    return configs
      .filter((rule) => rule.enabled)
      .map((config) => {
        const key = config.name.replace("Rule", "").toLowerCase();
        const module = modules.get(key) ?? fallbackModules.get(key);

        if (!module) {
          logger.warn({ ruleName: config.name }, "Rule module not found");
          throw new DomainError("Rule module could not be loaded", {
            ruleName: config.name
          });
        }

        return module.createRule(config);
      });
  }
}
