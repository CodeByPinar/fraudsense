import pino from "pino";

const level = process.env.NODE_ENV === "production" ? "info" : "debug";

export const logger = pino({
  level,
  base: {
    service: "fraudsense"
  },
  redact: {
    paths: ["iban", "cardNumber", "nationalId"],
    censor: "[REDACTED]"
  }
});
