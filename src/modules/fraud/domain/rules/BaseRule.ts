import type {
  RuleConfigRecord,
  RuleEvaluationResult,
  TransactionContext,
  UserRiskProfile
} from "../types.js";

export abstract class BaseRule {
  public readonly name: string;
  public readonly weight: number;
  public readonly conditions: Record<string, unknown>;

  public constructor(config: RuleConfigRecord) {
    this.name = config.name;
    this.weight = config.weight;
    this.conditions = config.conditions;
  }

  /**
   * Evaluates a transaction against current rule logic.
   * Returns a weighted result consumed by the rule chain.
   */
  public abstract evaluate(
    context: TransactionContext,
    profile: UserRiskProfile
  ): Promise<RuleEvaluationResult>;
}
