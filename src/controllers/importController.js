const { v4: uuidv4 } = require("uuid");
const importManifestation = require("../services/importManifestation");
const Race = require("../models/Race");
const RacePhase = require("../models/RacePhase");
const RaceCrew = require("../models/RaceCrew");
const Crew = require("../models/Crew");
const Category = require("../models/Category");
const { Op } = require("sequelize");

exports.importManifestation = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🚀 Début de l'import de la manifestation ${id}...`);
    const result = await importManifestation(id, req);
    console.log(`✅ Import terminé avec succès`);
    res.status(201).json({ status: "success", data: result });
  } catch (err) {
    console.error("❌ Import error:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.generateInitialRaces = async (req, res) => {
  try {
    const { phase_id, lane_count, start_time, interval_minutes } = req.body;

    if (!phase_id || !lane_count || lane_count < 1)
      return res
        .status(400)
        .json({ status: "error", message: "phase_id et lane_count requis" });

    const phase = await RacePhase.findByPk(phase_id);
    if (!phase)
      return res
        .status(404)
        .json({ status: "error", message: "Phase introuvable" });

    const event_id = phase.event_id;
    const categories = await Category.findAll({
      include: [{ model: Crew, where: { event_id }, required: true }],
      order: [["code", "ASC"]],
    });

    let raceNumber = 1;
    const createdRaces = [];
    let currentStartTime = start_time ? new Date(start_time) : null;
    const intervalMs = (interval_minutes || 0) * 60 * 1000;

    for (const category of categories) {
      const crews = category.Crews;
      const crewCount = crews.length;
      const raceCount = Math.ceil(crewCount / lane_count);

      const racesForCategory = [];
      for (let i = 0; i < raceCount; i++) {
        const raceStartTime =
          currentStartTime instanceof Date ? new Date(currentStartTime) : null;

        const race = await Race.create({
          id: uuidv4(),
          name: `${category.code} - Série ${i + 1}`,
          race_number: raceNumber,
          phase_id,
          lane_count,
          start_time: raceStartTime,
        });

        if (currentStartTime) {
          currentStartTime = new Date(currentStartTime.getTime() + intervalMs);
        }

        racesForCategory.push(race);
        createdRaces.push(race);
        raceNumber++;
      }

      const shuffledCrews = crews.sort(() => 0.5 - Math.random());
      const baseSize = Math.floor(crewCount / raceCount);
      let remainder = crewCount % raceCount;
      let index = 0;

      for (let i = 0; i < raceCount; i++) {
        const size = baseSize + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        const selectedCrews = shuffledCrews.slice(index, index + size);

        for (let lane = 0; lane < selectedCrews.length; lane++) {
          const crew = selectedCrews[lane];

          await RaceCrew.create({
            id: uuidv4(),
            race_id: racesForCategory[i].id,
            crew_id: crew.id,
            lane: lane + 1,
          });
        }

        index += size;
      }
    }

    res.json({
      status: "success",
      message: "Courses générées",
      data: createdRaces,
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
