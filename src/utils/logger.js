const pino = require("pino");

function createLogger() {
  const level = process.env.LOG_LEVEL || "info";
  const isProd = process.env.NODE_ENV === "production";

  // En dev, pino pretty n'est pas installé → on reste en JSON (ok pour Docker aussi)
  return pino({
    level,
    base: undefined, // évite pid/hostname si pas souhaité
    redact: {
      paths: [
        "req.headers.authorization",
        "req.body.password",
        "req.body.refresh_token",
        "req.body.token",
      ],
      remove: true,
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    enabled: true,
    ...(isProd ? {} : {}),
  });
}

module.exports = createLogger();

