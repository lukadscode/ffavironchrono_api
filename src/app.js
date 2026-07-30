const express = require("express");
const app = express();
const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/eventRoutes");
const participantRoutes = require("./routes/participantRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const eventCategoryRoutes = require("./routes/eventCategoryRoutes");
const eventDistanceRoutes = require("./routes/eventDistanceRoutes");
const crewRoutes = require("./routes/crewRoutes");
const crewParticipantRoutes = require("./routes/crewParticipantRoutes");
const raceRoutes = require("./routes/raceRoutes");
const racePhaseRoutes = require("./routes/racePhaseRoutes");
const raceCrewRoutes = require("./routes/raceCrewRoutes");
const distanceRoutes = require("./routes/distanceRoutes");
const timingRoutes = require("./routes/timingRoutes");
const timingPointRoutes = require("./routes/timingPointRoutes");
const timingProfileRoutes = require("./routes/timingProfileRoutes");
const publicTimingPointRoutes = require("./routes/publicTimingPointRoutes");
const timingAssignmentRoutes = require("./routes/timingAssignmentRoutes");
const importRoutes = require("./routes/import"); // Import the new import routes
const userEventRoutes = require("./routes/userEventRoutes");
const miscRoutes = require("./routes/miscRoutes");
const exportRoutes = require("./routes/exportRoutes");
const rankingRoutes = require("./routes/rankingRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const clubRoutes = require("./routes/clubRoutes");
const userRoutes = require("./routes/userRoutes");
const indoorResultRoutes = require("./routes/indoorResultRoutes");

const swaggerUi = require("swagger-ui-express");
const openapiSpec = require("./docs");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const pinoHttp = require("pino-http");
const crypto = require("crypto");
const errorHandler = require("./middlewares/errorHandler");
const logger = require("./utils/logger");
require("dotenv").config();
require("./models/relations");

// Derrière Coolify / reverse proxy : nécessaire pour rate-limit + IP réelle
const trustProxy = process.env.TRUST_PROXY;
app.set(
  "trust proxy",
  trustProxy === "false" || trustProxy === "0"
    ? false
    : trustProxy
      ? Number.isNaN(Number(trustProxy))
        ? trustProxy
        : Number(trustProxy)
      : 1
);

// Logger HTTP structuré (avec request id)
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const existing = req.headers["x-request-id"];
      const id =
        (typeof existing === "string" && existing.trim()) || crypto.randomUUID();
      res.setHeader("x-request-id", id);
      return id;
    },
    customProps: (req) => ({
      request_id: req.id,
    }),
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
          remotePort: req.remotePort,
        };
      },
    },
  })
);

const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

// Fallback utile si CORS_ORIGINS n'est pas renseigné (ex. FRONTEND_URL=https://timing.ffaviron.fr)
if (corsOrigins.length === 0 && process.env.FRONTEND_URL) {
  corsOrigins.push(String(process.env.FRONTEND_URL).trim().replace(/\/$/, ""));
}

app.use(
  cors({
    origin: (origin, cb) => {
      // Pas d'Origin (curl, mobile natif, server-to-server) : on autorise.
      if (!origin) return cb(null, true);

      const normalized = origin.replace(/\/$/, "");

      // Dev local permissif si aucune liste configurée
      if (corsOrigins.length === 0) {
        if (process.env.NODE_ENV === "production") {
          logger.warn({ origin }, "CORS blocked: CORS_ORIGINS is empty in production");
          return cb(new Error("CORS blocked"));
        }
        return cb(null, true);
      }

      if (corsOrigins.includes(normalized)) return cb(null, true);

      logger.warn({ origin: normalized, allowed: corsOrigins }, "CORS blocked: origin not in whitelist");
      return cb(new Error("CORS blocked"));
    },
    credentials: true,
  })
);

// Transformer les erreurs CORS en réponse JSON propre (au lieu d'un 500 Express)
app.use((err, req, res, next) => {
  if (err && (err.message === "CORS blocked" || err.message?.includes("CORS"))) {
    return res.status(403).json({ status: "error", message: "CORS blocked" });
  }
  return next(err);
});

app.use(
  helmet({
    // La CSP est à affiner selon vos domaines (front, assets, swagger, etc.)
    contentSecurityPolicy: false,
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PER_15M || 600),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req) => {
    if (process.env.NODE_ENV === "production") return false;
    const ip = req.ip || req.socket?.remoteAddress || "";
    return (
      ip === "127.0.0.1" ||
      ip === "::1" ||
      ip === "::ffff:127.0.0.1" ||
      ip.endsWith("127.0.0.1")
    );
  },
});
app.use(globalLimiter);

app.use(compression());

app.use(express.json({ limit: "25mb" })); // imports lourds: routes dédiées gardent multer
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Augmenter le timeout pour les requêtes longues (import)
app.use((req, res, next) => {
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000);
  next();
});

if (process.env.NODE_ENV !== "production" || process.env.ENABLE_SWAGGER === "true") {
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
}
app.use("/auth", authRoutes);
app.use("/events", eventRoutes);
app.use("/participants", participantRoutes);
app.use("/categories", categoryRoutes);
app.use("/event-categories", eventCategoryRoutes);
app.use("/event-distances", eventDistanceRoutes);
app.use("/crews", crewRoutes);
app.use("/crew-participants", crewParticipantRoutes);
app.use("/races", raceRoutes);
app.use("/race-phases", racePhaseRoutes);
app.use("/race-crews", raceCrewRoutes);
app.use("/distances", distanceRoutes);
app.use("/timings", timingRoutes);
app.use("/timing-points", timingPointRoutes);
app.use("/timing-profiles", timingProfileRoutes);
app.use("/public/timing-points", publicTimingPointRoutes);
app.use("/timing-assignments", timingAssignmentRoutes);
app.use("/import", importRoutes); // Use the new import routes
app.use("/user-events", userEventRoutes);
app.use("/export", exportRoutes); // Export routes for PDF generation
app.use("/rankings", rankingRoutes); // Ranking routes
app.use("/notifications", notificationRoutes); // Notification routes
app.use("/clubs", clubRoutes); // Club routes
app.use("/users", userRoutes); // User routes (admin only)
app.use("/indoor-results", indoorResultRoutes); // Indoor results routes
app.use("/", miscRoutes); // Assuming you have a miscRoutes file for miscellaneous routes

if (process.env.NODE_ENV !== "production" || process.env.ENABLE_SWAGGER === "true") {
  app.get("/swagger.json", (req, res) => {
    try {
      const spec = require("./swagger.json");
      res.setHeader("Content-Type", "application/json");
      res.send(spec);
    } catch (err) {
      res
        .status(500)
        .json({ error: "swagger.json non généré. Lance generateSwagger.js" });
    }
  });
}

// Endpoint de santé (désactivé en prod)
if (process.env.NODE_ENV !== "production") {
  app.get("/test", (req, res) => {
    res.send("API OK");
  });
}

// Error handler global (JSON)
app.use(errorHandler);

module.exports = app;
