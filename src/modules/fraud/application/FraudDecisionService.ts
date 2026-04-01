import { injectable } from "tsyringe";
import { DEFAULT_EARLY_EXIT_SCORE } from "../../../shared/constants/risk.js";
import type { RuleChain } from "./rule-engine/RuleChain.js";
import { BayesianScorer } from "./scoring/BayesianScorer.js";
import type {
  FraudDecisionResult,
  RuleDecision,
  RuleThresholdConfig,
  TransactionContext,
  UserRiskProfile
} from "../domain/types.js";

@injectable()
export class FraudDecisionService {
  private readonly scorer: BayesianScorer;

  public constructor() {
    this.scorer = new BayesianScorer();
  }

  /**
   * Calculates final fraud decision from chained rule evaluations.
   */
  public async decide(
    ruleChain: RuleChain,
    context: TransactionContext,
    profile: UserRiskProfile,
    thresholds: RuleThresholdConfig
  ): Promise<FraudDecisionResult> {
    const evaluated = await ruleChain.evaluate(
      context,
      profile,
      thresholds.earlyExitScore ?? DEFAULT_EARLY_EXIT_SCORE
    );

    const score = this.scorer.calculateScore(evaluated, thresholds.multiTriggerBoost);

    const decision = this.mapDecision(score, thresholds);

    return {
      score,
      decision,
      triggeredRules: evaluated.filter((item) => item.triggered).map((item) => item.rule),
      evaluations: evaluated
    };
  }

  private mapDecision(score: number, thresholds: RuleThresholdConfig): RuleDecision {
    if (score >= thresholds.blockThreshold) {
      return "BLOCK";
    }
    if (score >= thresholds.reviewThreshold) {
      return "REVIEW";
    }
    return "NONE";
  }
}
