import { BaseRule } from "../BaseRule.js";
import type {
  RuleConfigRecord,
  RuleEvaluationResult,
  TransactionContext,
  UserRiskProfile
} from "../../types.js";

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineKm(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): number {
  const radius = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLon / 2) ** 2;

  return radius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export class GeoRule extends BaseRule {
  public async evaluate(
    context: TransactionContext,
    profile: UserRiskProfile
  ): Promise<RuleEvaluationResult> {
    if (!context.location || !profile.lastLocation) {
      return {
        rule: this.name,
        triggered: false,
        weightedScore: 0
      };
    }

    const distanceKm = haversineKm(profile.lastLocation, context.location);
    const elapsedHours =
      (context.timestamp.getTime() - profile.lastLocation.timestamp.getTime()) /
      (1000 * 60 * 60);

    const speedKmh = elapsedHours > 0 ? distanceKm / elapsedHours : distanceKm;
    const maxDistanceKm = Number((this.conditions as Record<string, unknown>).maxDistanceKm ?? 800);
    const maxSpeedKmh = Number((this.conditions as Record<string, unknown>).maxTravelSpeedKmh ?? 900);

    const triggered = distanceKm > maxDistanceKm || speedKmh > maxSpeedKmh;

    return {
      rule: this.name,
      triggered,
      weightedScore: triggered ? this.weight : 0,
      reason: triggered ? "Impossible travel pattern detected" : undefined,
      details: {
        distanceKm,
        speedKmh
      }
    };
  }
}

export function createRule(config: RuleConfigRecord): BaseRule {
  return new GeoRule(config);
}
