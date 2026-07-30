const express = require("express");
const router = express.Router();
const controller = require("../controllers/categoryController");
const auth = require("../middlewares/authMiddleware");
const requireAdmin = require("../middlewares/requireAdmin");
const { requireEventRole, resolvers } = require("../middlewares/requireEventRole");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/categorySchema");

router.get("/", controller.getCategories);
router.get("/:id", controller.getCategory);
router.post(
  "/",
  auth,
  requireAdmin,
  validate(schema.createSchema),
  controller.createCategory
);
router.get(
  "/event/:event_id/with-crews",
  auth,
  requireEventRole({ roles: ["viewer"], getEventId: resolvers.eventIdFromParams("event_id") }),
  controller.getCategoriesByEventWithCrews
);
router.put(
  "/:id",
  auth,
  requireAdmin,
  validate(schema.updateSchema),
  controller.updateCategory
);
router.delete("/:id", auth, requireAdmin, controller.deleteCategory);

module.exports = router;
