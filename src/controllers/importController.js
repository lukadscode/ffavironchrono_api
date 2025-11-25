const { v4: uuidv4 } = require("uuid");
const importManifestation = require("../services/importManifestation");
const Race = require("../models/Race");
const RacePhase = require("../models/RacePhase");
const RaceCrew = require("../models/RaceCrew");
const Crew = require("../models/Crew");
const Category = require("../models/Category");
const Distance = require("../models/Distance");
const { Op } = require("sequelize");

exports.importManifestation = async (req, res) => {
  const startTime = Date.now();
  let event_id = null;
  
  try {
    const { id } = req.params;
    console.log(`🚀 Début de l'import de la manifestation ${id}...`);
    
    const result = await importManifestation(id, req);
    event_id = result.event_id;
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Import terminé avec succès en ${duration}s`);
    console.log(`📊 Résumé: ${result.crews_count} équipages, ${result.participants_count} participants, ${result.categories_count} catégories`);
    
    res.status(201).json({ status: "success", data: result });
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`❌ Import error après ${duration}s:`, err);
    console.error("Stack trace:", err.stack);
    
    // Si un événement a été créé, on pourrait le supprimer pour éviter les données partiellement importées
    // Mais on ne le fait pas automatiquement car l'utilisateur pourrait vouloir réessayer
    
    // Retourner un message d'erreur plus détaillé
    const errorMessage = err.message || "Erreur inconnue lors de l'import";
    const errorDetails = process.env.NODE_ENV === "development" 
      ? { 
          message: errorMessage,
          stack: err.stack,
          duration: `${duration}s`,
          event_id: event_id || null
        }
      : { 
          message: errorMessage,
          duration: `${duration}s`
        };
    
    res.status(500).json({ 
      status: "error", 
      message: errorMessage,
      details: errorDetails
    });
  }
};

exports.generateInitialRaces = async (req, res) => {
  try {
    const { phase_id, lane_count, start_time, interval_minutes, category_order } = req.body;

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

    let categories = await Category.findAll({
      include: [
        { model: Crew, where: { event_id }, required: true },
        { model: Distance, as: "distance", required: false },
      ],
      order: [["code", "ASC"]],
    });

    // Trier les catégories selon l'ordre fourni (si présent)
    if (category_order && Array.isArray(category_order) && category_order.length > 0) {
      const orderMap = new Map();
      category_order.forEach((code, index) => {
        orderMap.set(code, index);
      });

      categories.sort((a, b) => {
        const orderA = orderMap.has(a.code) ? orderMap.get(a.code) : 9999;
        const orderB = orderMap.has(b.code) ? orderMap.get(b.code) : 9999;

        if (orderA !== orderB) {
          return orderA - orderB;
        }
        // Si même priorité ou non listées, trier par code
        return (a.code || "").localeCompare(b.code || "");
      });

      console.log(
        `📋 Catégories triées selon l'ordre personnalisé: ${category_order.join(", ")}`
      );
    } else {
      console.log("📋 Catégories triées par code (ordre par défaut)");
    }

    let raceNumber = 1;
    const createdRaces = [];
    let currentStartTime = start_time ? new Date(start_time) : null;
    const intervalMs = (interval_minutes || 0) * 60 * 1000;

    for (const category of categories) {
      const crews = category.Crews;
      const crewCount = crews.length;
      const raceCount = Math.ceil(crewCount / lane_count);

      // Utiliser directement le distance_id de la catégorie
      const distanceId = category.distance_id;

      if (distanceId && category.distance) {
        const distanceLabel = category.distance.is_relay
          ? `${category.distance.relay_count}x${category.distance.meters}m`
          : `${category.distance.meters}m`;
        console.log(
          `  ✅ Distance assignée pour ${category.code}: ${distanceLabel}`
        );
      } else if (!distanceId) {
        console.warn(
          `  ⚠️  Aucune distance assignée à la catégorie: ${category.code}`
        );
      }

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
          distance_id: distanceId,
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
