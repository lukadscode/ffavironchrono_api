const express = require("express");
const router = express.Router();
const controller = require("../controllers/timingPointController");
const TimingPoint = require("../models/TimingPoint");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/timingPointSchema");
const rateLimit = require("express-rate-limit");

const resolveTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_RESOLVE_TOKEN_PER_15M || 60),
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// Public : résolution token -> JWT timing point
router.post(
  "/resolve-token",
  resolveTokenLimiter,
  validate(schema.resolveTokenSchema),
  controller.resolveToken
);

// Public : liste des timing points sans exposer le token secret
router.get("/event/:event_id", async (req, res) => {
  try {
    const { event_id } = req.params;
    const points = await TimingPoint.findAll({
      where: { event_id },
      order: [["order_index", "ASC"]],
    });
    const sanitized = points.map((p) => ({
      id: p.id,
      event_id: p.event_id,
      label: p.label,
      order_index: p.order_index,
      distance_m: p.distance_m,
    }));
    return res.json({ status: "success", data: sanitized });
  } catch (e) {
    return res.status(500).json({ status: "error", message: "Erreur serveur" });
  }
});

module.exports = router;

