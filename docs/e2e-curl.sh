#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:3000"

echo "1) Login as risk officer"
LOGIN_RESPONSE=$(curl -sS -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"risk","password":"Risk#12345"}')

echo "$LOGIN_RESPONSE"
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | node -e "process.stdin.once('data',d=>{const j=JSON.parse(d.toString()); process.stdout.write(j.accessToken);});")
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | node -e "process.stdin.once('data',d=>{const j=JSON.parse(d.toString()); process.stdout.write(j.refreshToken);});")

echo "2) Create transaction first time (expect 201)"
curl -i -X POST "$BASE_URL/api/v1/transactions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "idempotency-key: demo-key-0001" \
  -d '{"userId":"u-001","amount":149.99,"currency":"USD","occurredAt":"2026-04-01T10:00:00.000Z"}'

echo

echo "3) Replay same idempotency key + payload (expect 200)"
curl -i -X POST "$BASE_URL/api/v1/transactions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "idempotency-key: demo-key-0001" \
  -d '{"userId":"u-001","amount":149.99,"currency":"USD","occurredAt":"2026-04-01T10:00:00.000Z"}'

echo

echo "4) Same idempotency key + different payload (expect 409)"
curl -i -X POST "$BASE_URL/api/v1/transactions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "idempotency-key: demo-key-0001" \
  -d '{"userId":"u-001","amount":999.99,"currency":"USD","occurredAt":"2026-04-01T10:00:00.000Z"}'

echo

echo "5) Refresh token rotation"
REFRESH_RESPONSE=$(curl -sS -X POST "$BASE_URL/api/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")

echo "$REFRESH_RESPONSE"

echo "6) Readiness and liveness checks"
curl -sS "$BASE_URL/health/live"; echo
curl -sS "$BASE_URL/health/ready"; echo
