const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const exportController = require("../controllers/exportController");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");

router.get(
  "/startlist/phase/:phase_id",
  auth,
  requireEventRole({
    roles: ["viewer"],
    getEventId: resolvers.eventIdFromRacePhaseIdParam("phase_id"),
  }),
  exportController.startListPdf
);
router.get(
  "/weighin/phase/:phase_id",
  auth,
  requireEventRole({
    roles: ["viewer"],
    getEventId: resolvers.eventIdFromRacePhaseIdParam("phase_id"),
  }),
  exportController.weighInPdf
);

module.exports = router;
