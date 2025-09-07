const express = require("express");
const router = express.Router();

// Route simple : retourne l'heure actuelle du serveur
router.get("/server-time", (req, res) => {
  res.json({ server_time: new Date().toISOString() });
});

// Route avec calcul de décalage client/serveur
router.get("/server-time-offset", (req, res) => {
  const serverTime = new Date();
  const clientTime = req.query.client_time
    ? new Date(req.query.client_time)
    : null;

  const result = { server_time: serverTime.toISOString() };

  if (clientTime instanceof Date && !isNaN(clientTime)) {
    result.offset_ms = serverTime.getTime() - clientTime.getTime();
  }

  res.json(result);
});

module.exports = router;
