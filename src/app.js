console.log("✅ app.js has been loaded");

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
require("dotenv").config();
require("./models/relations");

app.use(express.json({ limit: "50mb" })); // Augmenter la limite pour les gros imports
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cors({ origin: "*", credentials: true }));

// Augmenter le timeout pour les requêtes longues (import)
app.use((req, res, next) => {
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000);
  next();
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
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

// Test route to check if the API is running
app.get("/test", (req, res) => {
  console.log("Test route hit");
  res.send("API OK");
});

module.exports = app;
