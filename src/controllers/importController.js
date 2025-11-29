const { v4: uuidv4 } = require("uuid");
const importManifestation = require("../services/importManifestation");
const Race = require("../models/Race");
const RacePhase = require("../models/RacePhase");
const RaceCrew = require("../models/RaceCrew");
const Crew = require("../models/Crew");
const Category = require("../models/Category");
const Distance = require("../models/Distance");
const Event = require("../models/Event");
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

exports.generateRacesFromSeries = async (req, res) => {
  try {
    const { phase_id, lane_count, start_time, interval_minutes, series, save_only } = req.body;

    if (!phase_id || !lane_count || lane_count < 1)
      return res
        .status(400)
        .json({ status: "error", message: "phase_id et lane_count requis" });

    if (!series || !Array.isArray(series) || series.length === 0)
      return res
        .status(400)
        .json({ status: "error", message: "series est requis et doit être un tableau non vide" });

    const phase = await RacePhase.findByPk(phase_id);
    if (!phase)
      return res
        .status(404)
        .json({ status: "error", message: "Phase introuvable" });

    const event_id = phase.event_id;

    // Récupérer les équipages déjà assignés à des courses de cette phase
    const existingRaces = await Race.findAll({
      where: { phase_id },
      include: [
        {
          model: RaceCrew,
          attributes: ["crew_id"],
        },
      ],
    });

    const alreadyAssignedCrewIds = new Set();
    existingRaces.forEach((race) => {
      race.RaceCrews?.forEach((rc) => {
        alreadyAssignedCrewIds.add(rc.crew_id);
      });
    });

    // Récupérer toutes les catégories avec leurs équipages pour cet événement
    const allCategories = await Category.findAll({
      include: [
        { model: Crew, where: { event_id }, required: false },
        { model: Distance, as: "distance", required: false },
      ],
    });

    // Créer un map pour accéder rapidement aux catégories par code
    const categoryMap = new Map();
    allCategories.forEach((cat) => {
      categoryMap.set(cat.code, cat);
    });

    // Validation des séries
    const validationErrors = [];
    const categoryUsageCount = new Map(); // Pour tracker combien d'équipages sont utilisés par catégorie

    for (let i = 0; i < series.length; i++) {
      const serie = series[i];
      const categoryCodes = Object.keys(serie.categories);
      let totalParticipants = 0;
      const distances = new Set();

      // Vérifier que chaque catégorie existe
      for (const code of categoryCodes) {
        if (!categoryMap.has(code)) {
          validationErrors.push(
            `Série ${i + 1}: La catégorie "${code}" n'existe pas`
          );
          continue;
        }

        const category = categoryMap.get(code);
        const requestedCount = serie.categories[code];
        // Filtrer les équipages non déjà assignés à une course de cette phase
        const availableCrews = (category.Crews || []).filter(
          (crew) => !alreadyAssignedCrewIds.has(crew.id)
        );
        const availableCount = availableCrews.length;

        // Vérifier que le nombre demandé ne dépasse pas le disponible
        const currentUsage = categoryUsageCount.get(code) || 0;
        if (currentUsage + requestedCount > availableCount) {
          validationErrors.push(
            `Série ${i + 1}: La catégorie "${code}" n'a que ${availableCount} équipages disponibles (${category.Crews?.length || 0} au total, ${alreadyAssignedCrewIds.size} déjà assignés), mais ${currentUsage + requestedCount} sont demandés au total`
          );
        }

        // Vérifier la distance
        if (category.distance_id) {
          distances.add(category.distance_id);
        } else {
          distances.add(null); // null pour les catégories sans distance
        }

        totalParticipants += requestedCount;
        categoryUsageCount.set(code, currentUsage + requestedCount);
      }

      // Vérifier que le total ne dépasse pas lane_count
      if (totalParticipants > lane_count) {
        validationErrors.push(
          `Série ${i + 1}: Le nombre total de participants (${totalParticipants}) dépasse le nombre de lignes d'eau (${lane_count})`
        );
      }

      // Vérifier que toutes les catégories ont la même distance (ou aucune)
      if (distances.size > 1) {
        validationErrors.push(
          `Série ${i + 1}: Les catégories ont des distances différentes. Toutes les catégories d'une série doivent avoir la même distance.`
        );
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "Erreurs de validation",
        errors: validationErrors,
      });
    }

    // Enregistrer le schéma de génération dans la phase
    const generationSchema = {
      lane_count,
      start_time: start_time || null,
      interval_minutes: interval_minutes || 5,
      series: series.map((s) => ({
        id: s.id,
        categories: s.categories,
      })),
      saved_at: new Date().toISOString(),
      is_draft: save_only === true,
    };

    await phase.update({ generation_schema: generationSchema });

    // Si mode brouillon (save_only = true), on s'arrête ici
    if (save_only === true) {
      return res.json({
        status: "success",
        message: "Schéma de génération enregistré en mode brouillon",
        data: {
          phase_id,
          phase_name: phase.name,
          generation_schema: generationSchema,
          is_draft: true,
        },
      });
    }

    // Génération des courses
    let raceNumber = 1;
    const createdRaces = [];
    let currentStartTime = start_time ? new Date(start_time) : null;
    const intervalMs = (interval_minutes || 5) * 60 * 1000;
    let totalCrewsAssigned = 0;

    // Map pour tracker les équipages déjà assignés par catégorie
    const assignedCrewsByCategory = new Map();
    allCategories.forEach((cat) => {
      assignedCrewsByCategory.set(cat.code, new Set());
    });

    for (const serie of series) {
      const categoryCodes = Object.keys(serie.categories);
      let totalParticipants = 0;
      let commonDistanceId = null;

      // Déterminer la distance commune (toutes les catégories ont la même distance)
      for (const code of categoryCodes) {
        const category = categoryMap.get(code);
        if (category.distance_id) {
          commonDistanceId = category.distance_id;
          break;
        }
      }

      // Calculer le total de participants pour cette série
      for (const code of categoryCodes) {
        totalParticipants += serie.categories[code];
      }

      // Créer la course pour cette série
      const raceStartTime =
        currentStartTime instanceof Date ? new Date(currentStartTime) : null;

      const race = await Race.create({
        id: uuidv4(),
        name: `Série ${raceNumber}`,
        race_number: raceNumber,
        phase_id,
        lane_count,
        start_time: raceStartTime,
        distance_id: commonDistanceId,
      });

      if (currentStartTime) {
        currentStartTime = new Date(currentStartTime.getTime() + intervalMs);
      }

      // Assigner les équipages à cette course
      let laneNumber = 1;

      for (const code of categoryCodes) {
        const category = categoryMap.get(code);
        const requestedCount = serie.categories[code];
        const availableCrews = category.Crews || [];
        const alreadyAssigned = assignedCrewsByCategory.get(code);

        // Filtrer les équipages non encore assignés (ni dans cette génération, ni dans des courses existantes)
        const unassignedCrews = availableCrews.filter(
          (crew) =>
            !alreadyAssigned.has(crew.id) &&
            !alreadyAssignedCrewIds.has(crew.id)
        );

        // Sélectionner aléatoirement le nombre demandé
        const shuffled = unassignedCrews.sort(() => 0.5 - Math.random());
        const selectedCrews = shuffled.slice(0, requestedCount);

        // Créer les RaceCrew pour chaque équipage sélectionné
        for (const crew of selectedCrews) {
          await RaceCrew.create({
            id: uuidv4(),
            race_id: race.id,
            crew_id: crew.id,
            lane: laneNumber,
          });

          // Marquer cet équipage comme assigné
          alreadyAssigned.add(crew.id);
          laneNumber++;
          totalCrewsAssigned++;
        }
      }

      createdRaces.push({
        id: race.id,
        race_number: race.race_number,
        start_time: race.start_time,
        distance_id: race.distance_id,
        crews_count: totalParticipants,
      });

      raceNumber++;
    }

    // Mettre à jour le schéma pour indiquer qu'il a été utilisé
    generationSchema.is_draft = false;
    generationSchema.generated_at = new Date().toISOString();
    await phase.update({ generation_schema: generationSchema });

    res.json({
      status: "success",
      message: `${createdRaces.length} courses générées avec succès`,
      data: {
        races_created: createdRaces.length,
        crews_assigned: totalCrewsAssigned,
        races: createdRaces,
        generation_schema: generationSchema,
      },
    });
  } catch (err) {
    console.error("Error in generateRacesFromSeries:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.updateEventFromManifestation = async (req, res) => {
  const startTime = Date.now();
  let event_id = null;
  
  try {
    const { id } = req.params; // manifestation_id
    const { event_id: providedEventId } = req.body;

    if (!providedEventId) {
      return res.status(400).json({
        status: "error",
        message: "event_id est requis dans le body de la requête",
      });
    }

    event_id = providedEventId;

    console.log(`🔄 Début de la mise à jour de l'événement ${event_id} depuis la manifestation ${id}...`);
    
    const result = await importManifestation.updateEventFromManifestation(id, event_id, req);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Mise à jour terminée avec succès en ${duration}s`);
    console.log(`📊 Résumé: ${result.new_crews_count} nouveaux équipages, ${result.new_participants_count} nouveaux participants, ${result.new_categories_count} nouvelles catégories`);
    
    res.status(200).json({ 
      status: "success", 
      message: "Événement mis à jour avec succès",
      data: result 
    });
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`❌ Erreur de mise à jour après ${duration}s:`, err);
    console.error("Stack trace:", err.stack);
    
    const errorMessage = err.message || "Erreur inconnue lors de la mise à jour";
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
    
    // Vérifier si c'est une erreur 404 (événement introuvable)
    if (errorMessage.includes("introuvable")) {
      return res.status(404).json({ 
        status: "error", 
        message: errorMessage,
        details: errorDetails
      });
    }
    
    res.status(500).json({ 
      status: "error", 
      message: errorMessage,
      details: errorDetails
    });
  }
};