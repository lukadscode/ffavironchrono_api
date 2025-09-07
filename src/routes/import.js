const express = require("express");
const router = express.Router();
const importController = require("../controllers/importController");
const auth = require("../middlewares/authMiddleware");

router.post("/manifestation/:id", auth, importController.importManifestation);

module.exports = router;
