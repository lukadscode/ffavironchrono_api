const express = require("express");
const router = express.Router();
const controller = require("../controllers/eventCategoryController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../schemas/eventCategorySchema");

router.post(
  "/",
  auth,
  validate(schema.linkSchema),
  controller.linkCategoryToEvent
);
router.get("/:event_id", controller.getCategoriesByEvent);
router.delete("/:id", auth, controller.unlinkCategoryFromEvent);

module.exports = router;
