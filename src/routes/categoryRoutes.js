const express = require("express");
const router = express.Router();
const controller = require("../controllers/categoryController");
const auth = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validateSchema");
const schema = require("../Schemas/categorySchema");

router.get("/", controller.getCategories);
router.get("/:id", controller.getCategory);
router.post(
  "/",
  auth,
  validate(schema.createSchema),
  controller.createCategory
);
router.get(
  "/event/:event_id/with-crews",
  auth,
  controller.getCategoriesByEventWithCrews
);
router.put(
  "/:id",
  auth,
  validate(schema.updateSchema),
  controller.updateCategory
);
router.delete("/:id", auth, controller.deleteCategory);

module.exports = router;
