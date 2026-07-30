const express = require("express");
const router = express.Router();
const controller = require("../controllers/timingProfileController");
const auth = require("../middlewares/authMiddleware");
const flexibleAuth = require("../middlewares/flexibleAuthMiddleware");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");

// Résolution du profil effectif (lecture, accessible aussi aux postes de chronométrage)
router.get(
  "/resolve",
  flexibleAuth,
  controller.resolveProfile
);

router.get("/", auth, controller.listProfiles);
router.get("/:id", auth, controller.getProfile);

router.post(
  "/",
  auth,
  requireEventRole({ roles: ["editor"], getEventId: resolvers.eventIdFromBody("event_id") }),
  controller.createProfile
);

router.put(
  "/:id",
  auth,
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromTimingProfileIdParam("id"),
  }),
  controller.updateProfile
);

router.delete(
  "/:id",
  auth,
  requireEventRole({
    roles: ["editor"],
    getEventId: resolvers.eventIdFromTimingProfileIdParam("id"),
  }),
  controller.deleteProfile
);

module.exports = router;
