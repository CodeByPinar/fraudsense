export type RuleDecision = "NONE" | "REVIEW" | "BLOCK";

export interface TransactionContext {
  transactionId: string;
  userId: string;
  amount: number;
  timestamp: Date;
  location?: {
    lat: number;
    lon: number;
  };
  deviceFingerprint?: string;
  metadata?: Record<string, unknown>;
}

export interface UserRiskProfile {
  meanAmount: number;
  stdDeviationAmount: number;
  usualHourMean: number;
  usualHourStdDeviation: number;
  lastLocation?: {
    lat: number;
    lon: number;
    timestamp: Date;
  };
  lastDeviceFingerprint?: string;
}

export interface RuleEvaluationResult {
  rule: string;
  triggered: boolean;
  weightedScore: number;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface RuleThresholdConfig {
  reviewThreshold: number;
  blockThreshold: number;
  earlyExitScore: number;
  multiTriggerBoost: number;
}

export interface FraudDecisionResult {
  score: number;
  decision: RuleDecision;
  triggeredRules: string[];
  evaluations: RuleEvaluationResult[];
}

export interface RuleConfigRecord {
  name: string;
  enabled: boolean;
  weight: number;
  conditions: Record<string, unknown>;
}
