const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const exportController = require("../controllers/exportController");

router.get("/startlist/phase/:phase_id", exportController.startListPdf);
router.get("/weighin/phase/:phase_id", auth, exportController.weighInPdf);

module.exports = router;
