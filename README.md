# FraudSense

I am building FraudSense as a security-first, developer-friendly fraud detection platform that is simple to run locally and realistic enough to evolve into production.

![FraudSense Banner](assets/fraudsense-banner.png)

## Project Widgets

![Node](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-v4-000000?logo=fastify&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-v5-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Online-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-Online-DC382D?logo=redis&logoColor=white)
![Local Tests](https://img.shields.io/badge/tests-local%20passing-2EA043)
![API Style](https://img.shields.io/badge/errors-RFC7807-0366D6)
![Security](https://img.shields.io/badge/security-HMAC%20%2B%20JWT-8A2BE2)

![Repo Stars](https://img.shields.io/github/stars/CodeByPinar/fraudsense?style=social)
![Repo Issues](https://img.shields.io/github/issues/CodeByPinar/fraudsense)
![Repo Last Commit](https://img.shields.io/github/last-commit/CodeByPinar/fraudsense)

## Table of Contents

1. [Vision](#vision)
2. [What Makes FraudSense Different](#what-makes-fraudsense-different)
3. [System Architecture](#system-architecture)
4. [Runtime Dataflow](#runtime-dataflow)
5. [Threat Model Snapshot](#threat-model-snapshot)
6. [Feature Deep Dive](#feature-deep-dive)
7. [Mission Control UI](#mission-control-ui)
8. [API Contract](#api-contract)
9. [Configuration Matrix](#configuration-matrix)
10. [Setup and Runbook](#setup-and-runbook)
11. [Feedback to GitHub Issues](#feedback-to-github-issues)
12. [Operational Playbooks](#operational-playbooks)
13. [Roadmap](#roadmap)
14. [Author](#author)

## Vision

FraudSense focuses on one question:

How can we evaluate risky transactions in real time while preserving reliability, auditability, and developer speed?

My answer in this project is:
- deterministic idempotency
- layered auth model (JWT + HMAC)
- transparent risk pipeline
- an operational UI that explains itself

## What Makes FraudSense Different

- Security and usability are treated as first-class citizens together.
- APIs are designed for both humans and machine clients.
- Mission Control UI is not decorative; it is operational.
- Feedback flow is built to be safe and actionable (GitHub issue pipeline).

## System Architecture

```mermaid
flowchart LR
	subgraph UX[Experience Layer]
		UI[Mission Control Dashboard]
	end

	subgraph API[Application Layer]
		FASTIFY[Fastify HTTP API]
		AUTH[Auth Module]
		TX[Transaction Module]
		FB[Feedback Module]
		RULES[Fraud Rule Engine]
	end

	subgraph DATA[Data Layer]
		PG[(PostgreSQL)]
		REDIS[(Redis)]
	end

	subgraph EXT[External Integrations]
		GITHUB[GitHub Issues API]
	end

	UI --> FASTIFY
	FASTIFY --> AUTH
	FASTIFY --> TX
	FASTIFY --> FB
	TX --> RULES
	AUTH --> PG
	TX --> PG
	AUTH --> REDIS
	TX --> REDIS
	FB --> GITHUB
```

## Runtime Dataflow

```mermaid
sequenceDiagram
	autonumber
	participant Client
	participant API as Fastify API
	participant Auth as Auth Layer
	participant Rule as Fraud Engine
	participant DB as PostgreSQL
	participant Cache as Redis

	Client->>API: POST /api/v1/transactions (idempotency-key)
	API->>Auth: Validate JWT or HMAC
	Auth->>Cache: Nonce replay check (when HMAC)
	Auth-->>API: Authorized
	API->>DB: Idempotency lookup
	alt New operation
		API->>Rule: Evaluate fraud rules
		Rule-->>API: riskScore + decision
		API->>DB: Persist transaction + decision
		API-->>Client: 201 Created
	else Same payload replay
		API-->>Client: 200 OK
	else Different payload replay
		API-->>Client: 409 Conflict (Problem Details)
	end
```

## Threat Model Snapshot

```mermaid
flowchart TD
	A[Threat: Replay Attack] --> B[Control: Nonce + TTL + Redis]
	C[Threat: Payload Tampering] --> D[Control: x-api-key-body-sha256]
	E[Threat: Credential Misuse] --> F[Control: JWT + RBAC + Rotation]
	G[Threat: Abuse / Spam] --> H[Control: Route Rate Limits + Honeypot]
	I[Threat: Duplicate Writes] --> J[Control: Idempotency Key + Hash Match]
	K[Threat: Opaque Failures] --> L[Control: RFC7807 Errors + Request IDs]
```

## Feature Deep Dive

### Transaction Reliability
- strict schema validation
- idempotency-key enforcement
- deterministic replay semantics
- conflict isolation (`409`) for mismatched replays

### Fraud Intelligence
- modular rule pipeline
- weighted scoring strategy
- clear separation between rule evaluation and persistence

### Auth and Security
- JWT authentication for user-based access
- refresh token rotation
- RBAC for privilege boundaries
- service-to-service HMAC authentication
- replay and tamper protections

### Feedback Intelligence
- feedback form with UX-grade notifications
- backend validation and abuse controls
- secure forwarding to GitHub Issues

## Mission Control UI

The dashboard (`GET /`) includes:
- live operation center (liveness/readiness/DB/Redis)
- response-time telemetry chips
- risk simulation panel
- service topology interaction map
- live event stream
- API explorer with one-click command copy
- secure feedback center with user-friendly status notices

## API Contract

### Health
- `GET /health/live`
- `GET /health/ready`

### Auth
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`

### Transactions
- `POST /api/v1/transactions`
- `GET /api/v1/transactions`

### Feedback
- `POST /api/v1/feedback`

### Service HMAC Headers
- `x-api-key-id`
- `x-api-key-timestamp`
- `x-api-key-nonce`
- `x-api-key-body-sha256`
- `x-api-key-signature`

Signature format:

`HMAC_SHA256(secret, METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + NONCE + "\n" + BODY_HASH)`

## Configuration Matrix

| Variable | Required | Purpose |
|---|---:|---|
| `NODE_ENV` | Yes | Runtime mode (`development/test/production`) |
| `PORT` | Yes | HTTP port (default local: `3002`) |
| `REPOSITORY_MODE` | Yes | Data backend (`memory` or `prisma`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_PUBLIC_KEY` | Yes | JWT verification key |
| `JWT_PRIVATE_KEY` | Yes | JWT signing key |
| `GITHUB_FEEDBACK_TOKEN` | Optional | Enables feedback issue creation |
| `GITHUB_FEEDBACK_REPO_OWNER` | Optional | Target GitHub owner/org |
| `GITHUB_FEEDBACK_REPO_NAME` | Optional | Target repository |
| `GITHUB_FEEDBACK_LABELS` | Optional | Default issue labels |

## Setup and Runbook

### 1) Install

```bash
npm install
```

### 2) Start Infrastructure

```bash
docker compose up -d postgres redis
```

### 3) Verify Tooling

```bash
npm run type-check
npm test -- --runInBand
```

### 4) Start Service

```bash
npm run dev
```

Open:
- `http://localhost:3002/`

### 5) Local E2E

```bash
bash docs/e2e-curl.sh
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\docs\e2e-curl.ps1
```

## Feedback to GitHub Issues

Set these variables in `.env`:

```dotenv
GITHUB_FEEDBACK_TOKEN=<fine-grained-token>
GITHUB_FEEDBACK_REPO_OWNER=CodeByPinar
GITHUB_FEEDBACK_REPO_NAME=fraudsense
GITHUB_FEEDBACK_LABELS=feedback,triage
```

Recommended token scope:
- Repository access: only `fraudsense`
- Permission: `Issues -> Read and write`

Optional (if same token also used for HTTPS Git):
- `Contents -> Read and write`

## Operational Playbooks

### Service does not start
1. Check if port is occupied.
2. Confirm PostgreSQL and Redis are reachable.
3. Validate `.env` for malformed values.

### Readiness is down
1. Hit `GET /health/ready`.
2. Inspect `checks.database` and `checks.redis` fields.
3. Validate Docker containers and credentials.

### Feedback submission fails
1. Verify `GITHUB_FEEDBACK_*` values.
2. Confirm token permission for issue write.
3. Inspect API response problem detail payload.

## Roadmap

Planned innovations:
- adaptive risk thresholds by merchant profile
- asynchronous scoring queue mode for high-volume traffic
- search and forensic views backed by Elasticsearch
- SLO-backed alerting and incident timeline widgets
- policy packs for multi-tenant risk governance

## Author

Built and maintained by Pinar Topuz.

Repository:
- https://github.com/CodeByPinar/fraudsense
