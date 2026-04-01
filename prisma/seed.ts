import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedFraudRules(): Promise<void> {
  const rules = [
    {
      name: "VelocityRule",
      enabled: true,
      weight: 35,
      conditions: {
        threshold1s: 3,
        threshold1m: 10,
        threshold1h: 40,
        threshold24h: 200
      }
    },
    {
      name: "GeoRule",
      enabled: true,
      weight: 25,
      conditions: {
        maxDistanceKm: 1000,
        maxTravelSpeedKmh: 900
      }
    },
    {
      name: "AmountRule",
      enabled: true,
      weight: 20,
      conditions: {
        zScoreThreshold: 3
      }
    },
    {
      name: "TimeRule",
      enabled: true,
      weight: 10,
      conditions: {
        gaussianThreshold: 3
      }
    },
    {
      name: "DeviceRule",
      enabled: true,
      weight: 15,
      conditions: {}
    }
  ] as const;

  for (const rule of rules) {
    await prisma.fraudRule.upsert({
      where: {
        name: rule.name
      },
      create: {
        name: rule.name,
        enabled: rule.enabled,
        weight: rule.weight,
        conditions: rule.conditions,
        version: 1
      },
      update: {
        enabled: rule.enabled,
        weight: rule.weight,
        conditions: rule.conditions,
        version: {
          increment: 1
        }
      }
    });
  }
}

async function seedThreshold(): Promise<void> {
  const latest = await prisma.riskThreshold.findFirst({
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!latest) {
    await prisma.riskThreshold.create({
      data: {
        reviewThreshold: 40,
        blockThreshold: 75,
        earlyExitScore: 95,
        multiTriggerBoost: 0.2
      }
    });
    return;
  }

  await prisma.riskThreshold.update({
    where: {
      id: latest.id
    },
    data: {
      reviewThreshold: 40,
      blockThreshold: 75,
      earlyExitScore: 95,
      multiTriggerBoost: 0.2
    }
  });
}

async function seedServiceApiKeys(): Promise<void> {
  const existing = await prisma.serviceApiKey.findFirst({
    where: {
      keyId: "svc-default",
      version: 1
    }
  });

  if (!existing) {
    await prisma.serviceApiKey.create({
      data: {
        keyId: "svc-default",
        secret: "svc-default-secret",
        enabled: true,
        version: 1,
        revokedAt: null,
        expiresAt: null
      }
    });
  }
}

async function main(): Promise<void> {
  await seedFraudRules();
  await seedThreshold();
  await seedServiceApiKeys();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    process.stderr.write(`Seed failed: ${message}\n`);
    await prisma.$disconnect();
    process.exit(1);
  });
