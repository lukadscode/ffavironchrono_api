const { v4: uuidv4 } = require("uuid");
const Event = require("../models/Event");

// CREATE
exports.createEvent = async (req, res) => {
  try {
    const data = req.body;
    const event = await Event.create({
      ...data,
      id: uuidv4(),
      created_by: req.user.userId,
    });
    res.status(201).json({ status: "success", data: event });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// LIST
exports.getEvents = async (req, res) => {
  try {
    const events = await Event.findAll({ order: [["start_date", "DESC"]] });
    res.json({ status: "success", data: events });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// GET BY ID
exports.getEvent = async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);
    if (!event)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    res.json({ status: "success", data: event });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// UPDATE
exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);
    if (!event)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    await event.update(req.body);
    res.json({ status: "success", data: event });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// GET RESULTS BY CATEGORY
exports.getEventResultsByCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Importer tous les modèles nécessaires
    const Race = require("../models/Race");
    const RacePhase = require("../models/RacePhase");
    const RaceCrew = require("../models/RaceCrew");
    const Crew = require("../models/Crew");
    const Category = require("../models/Category");
    const TimingAssignment = require("../models/TimingAssignment");
    const Timing = require("../models/Timing");
    const TimingPoint = require("../models/TimingPoint");

    // Récupérer l'événement avec ses timing points
    const event = await Event.findByPk(id, {
      include: [
        {
          model: TimingPoint,
          as: "timing_points",
        },
      ],
    });

    if (!event) {
      return res
        .status(404)
        .json({ status: "error", message: "Événement non trouvé" });
    }

    if (!event.timing_points || event.timing_points.length === 0) {
      return res.json({
        status: "success",
        data: [],
        message: "Aucun point de timing trouvé pour cet événement",
      });
    }

    // Déterminer les points de départ et d'arrivée
    const timingPoints = event.timing_points.sort(
      (a, b) => a.order_index - b.order_index
    );
    const startPoint = timingPoints[0];
    const finishPoint =
      timingPoints.find(
        (tp) =>
          tp.label === "Finish" ||
          tp.label === "finish" ||
          tp.label === "Arrivée" ||
          tp.label === "arrivée"
      ) || timingPoints[timingPoints.length - 1];

    if (!startPoint || !finishPoint) {
      return res.json({
        status: "success",
        data: [],
        message: "Points de départ ou d'arrivée introuvables",
      });
    }

    // Debug: Vérifier que les timing points sont bien récupérés
    console.log(`[DEBUG] Event ${id} - Start point: ${startPoint.id}, Finish point: ${finishPoint.id}`);

    // Récupérer toutes les phases de l'événement
    const phases = await RacePhase.findAll({
      where: { event_id: id },
      order: [["order_index", "ASC"]],
    });

    // Collecter tous les résultats
    const allResults = [];
    const categoriesMap = {}; // Pour stocker les informations de catégorie

    for (const phase of phases) {
      const races = await Race.findAll({
        where: { phase_id: phase.id },
        include: [
          {
            model: RaceCrew,
            as: "race_crews",
            include: [
              {
                model: Crew,
                as: "crew",
                include: [
                  {
                    model: Category,
                    as: "category",
                  },
                ],
              },
            ],
          },
        ],
      });

      for (const race of races) {
        for (const raceCrew of race.race_crews || []) {
          if (!raceCrew.crew || !raceCrew.crew.category) {
            continue;
          }

          // Stocker les informations de catégorie pour le groupement
          const cat = raceCrew.crew.category;
          if (!categoriesMap[cat.id]) {
            categoriesMap[cat.id] = {
              id: cat.id,
              code: cat.code,
              label: cat.label,
              age_group: cat.age_group,
              gender: cat.gender,
            };
          }

          // Récupérer les timings pour cet équipage
          // Utiliser la même logique que getRaceResults
          const timingAssignments = await TimingAssignment.findAll({
            where: { crew_id: raceCrew.crew_id },
            include: [
              {
                model: Timing,
                as: "timing",
                required: false,
              },
            ],
          });

          // Filtrer les timings pour les points de départ et d'arrivée
          const startTiming = timingAssignments.find(
            (ta) => 
              ta.timing && 
              ta.timing.timing_point_id === startPoint.id &&
              ta.timing.timestamp !== null
          );
          const finishTiming = timingAssignments.find(
            (ta) => 
              ta.timing && 
              ta.timing.timing_point_id === finishPoint.id &&
              ta.timing.timestamp !== null
          );

          // Debug: Log pour voir si les timings sont trouvés
          if (raceCrew.crew_id && timingAssignments.length > 0) {
            console.log(`[DEBUG] Crew ${raceCrew.crew_id} - Found ${timingAssignments.length} timing assignments`);
            timingAssignments.forEach(ta => {
              if (ta.timing) {
                console.log(`[DEBUG]   - Timing ${ta.timing.id}: point=${ta.timing.timing_point_id}, timestamp=${ta.timing.timestamp}`);
              }
            });
          }

          let duration_ms = null;
          let finish_time = null;
          let time_formatted = null;
          let time_seconds = null;

          // Vérifier si on a un finish_time
          if (finishTiming?.timing?.timestamp) {
            finish_time = finishTiming.timing.timestamp;

            // Si on a aussi un start_time, calculer la durée
            if (startTiming?.timing?.timestamp) {
              const start = new Date(startTiming.timing.timestamp);
              const finish = new Date(finishTiming.timing.timestamp);
              duration_ms = finish - start;
              
              // Calculer le temps en secondes
              time_seconds = duration_ms / 1000;
              
              // Formater le temps (MM:SS.mmm ou SS.mmm)
              const totalSeconds = Math.floor(time_seconds);
              const minutes = Math.floor(totalSeconds / 60);
              const seconds = totalSeconds % 60;
              const milliseconds = duration_ms % 1000;
              
              if (minutes > 0) {
                time_formatted = `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
              } else {
                time_formatted = `${seconds}.${milliseconds.toString().padStart(3, "0")}`;
              }
            }
            // Si on a seulement un finish_time sans start_time, on ne peut pas calculer la durée
            // mais on marque quand même has_timing = true
          }

          allResults.push({
            race_id: race.id,
            race_number: race.race_number,
            phase_id: phase.id,
            phase_name: phase.name,
            crew_id: raceCrew.crew_id,
            lane: raceCrew.lane,
            club_name: raceCrew.crew?.club_name || null,
            club_code: raceCrew.crew?.club_code || null,
            finish_time,
            final_time: duration_ms !== null ? duration_ms.toString() : null,
            time_seconds: time_seconds !== null ? time_seconds.toFixed(3) : null,
            time_formatted,
            has_timing: finish_time !== null,
            position: null, // Sera calculé après le tri par catégorie
            // Note: category_id est utilisé pour le groupement, mais category n'est pas inclus dans le résultat individuel
            // car il est déjà présent au niveau du groupement
            category_id: raceCrew.crew?.category?.id || null,
          });
        }
      }
    }

    // Grouper par catégorie
    const resultsByCategory = {};

    // Grouper les résultats par catégorie
    for (const result of allResults) {
      if (!result.category_id) {
        continue;
      }

      const categoryKey = result.category_id;
      if (!resultsByCategory[categoryKey]) {
        resultsByCategory[categoryKey] = {
          category: categoriesMap[categoryKey] || null,
          results: [],
        };
      }

      // Retirer category_id du résultat avant de l'ajouter (n'est plus nécessaire)
      const { category_id, ...resultWithoutCategoryId } = result;
      resultsByCategory[categoryKey].results.push(resultWithoutCategoryId);
    }

    // Trier les résultats dans chaque catégorie par temps
    for (const categoryKey in resultsByCategory) {
      const categoryData = resultsByCategory[categoryKey];
      
      // Séparer les résultats avec et sans timing
      const withTiming = categoryData.results.filter((r) => r.has_timing);
      const withoutTiming = categoryData.results.filter((r) => !r.has_timing);

      // Trier par temps
      withTiming.sort((a, b) => {
        const timeA = parseInt(a.final_time || "999999999", 10);
        const timeB = parseInt(b.final_time || "999999999", 10);
        return timeA - timeB;
      });

      // Ajouter les positions
      withTiming.forEach((r, index) => {
        r.position = index + 1;
      });

      // Ajouter les résultats sans timing à la fin
      withoutTiming.forEach((r) => {
        r.position = null;
      });

      categoryData.results = [...withTiming, ...withoutTiming];
    }

    // Convertir en tableau
    const formattedResults = Object.values(resultsByCategory);

    res.json({
      status: "success",
      data: formattedResults,
    });
  } catch (err) {
    console.error("Erreur lors de la récupération des résultats:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// DELETE
exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findByPk(id);
    if (!event)
      return res.status(404).json({ status: "error", message: "Non trouvé" });

    // Importer tous les modèles nécessaires
    const TimingAssignment = require("../models/TimingAssignment");
    const Timing = require("../models/Timing");
    const TimingPoint = require("../models/TimingPoint");
    const RaceCrew = require("../models/RaceCrew");
    const Race = require("../models/Race");
    const RacePhase = require("../models/RacePhase");
    const CrewParticipant = require("../models/CrewParticipant");
    const Crew = require("../models/Crew");
    const Distance = require("../models/Distance");
    const EventCategory = require("../models/EventCategory");
    const UserEvent = require("../models/UserEvent");

    console.log(
      `🗑️  Suppression de l'événement ${id} et de toutes ses données...`
    );

    // 1. Supprimer les TimingAssignment (via les Crews de l'événement)
    const crews = await Crew.findAll({ where: { event_id: id } });
    const crewIds = crews.map((c) => c.id);

    if (crewIds.length > 0) {
      const timingAssignments = await TimingAssignment.findAll({
        where: { crew_id: crewIds },
      });
      await TimingAssignment.destroy({ where: { crew_id: crewIds } });
      console.log(
        `  ✅ ${timingAssignments.length} TimingAssignment supprimés`
      );
    }

    // 2. Supprimer les Timings (via TimingPoint de l'événement)
    const timingPoints = await TimingPoint.findAll({ where: { event_id: id } });
    const timingPointIds = timingPoints.map((tp) => tp.id);

    if (timingPointIds.length > 0) {
      const timings = await Timing.findAll({
        where: { timing_point_id: timingPointIds },
      });
      await Timing.destroy({ where: { timing_point_id: timingPointIds } });
      console.log(`  ✅ ${timings.length} Timings supprimés`);
    }

    // 3. Supprimer les RaceCrew (via les Races des phases de l'événement)
    const phases = await RacePhase.findAll({ where: { event_id: id } });
    const phaseIds = phases.map((p) => p.id);

    if (phaseIds.length > 0) {
      const races = await Race.findAll({ where: { phase_id: phaseIds } });
      const raceIds = races.map((r) => r.id);

      if (raceIds.length > 0) {
        await RaceCrew.destroy({ where: { race_id: raceIds } });
        console.log(`  ✅ RaceCrew supprimés`);
      }

      // 4. Supprimer les Races
      await Race.destroy({ where: { phase_id: phaseIds } });
      console.log(`  ✅ ${races.length} Races supprimées`);
    }

    // 5. Supprimer les RacePhase
    await RacePhase.destroy({ where: { event_id: id } });
    console.log(`  ✅ ${phases.length} RacePhase supprimées`);

    // 6. Supprimer les CrewParticipant (via les Crews)
    if (crewIds.length > 0) {
      await CrewParticipant.destroy({ where: { crew_id: crewIds } });
      console.log(`  ✅ CrewParticipant supprimés`);
    }

    // 7. Supprimer les Crews
    await Crew.destroy({ where: { event_id: id } });
    console.log(`  ✅ ${crews.length} Crews supprimés`);

    // 8. Supprimer les TimingPoint
    await TimingPoint.destroy({ where: { event_id: id } });
    console.log(`  ✅ ${timingPoints.length} TimingPoint supprimés`);

    // 9. Supprimer les Distance
    const distances = await Distance.findAll({ where: { event_id: id } });
    await Distance.destroy({ where: { event_id: id } });
    console.log(`  ✅ ${distances.length} Distance supprimées`);

    // 10. Supprimer les EventCategory (table de liaison)
    await EventCategory.destroy({ where: { event_id: id } });
    console.log(`  ✅ EventCategory supprimés`);

    // 11. Supprimer les UserEvent (table de liaison)
    await UserEvent.destroy({ where: { event_id: id } });
    console.log(`  ✅ UserEvent supprimés`);

    // 12. Enfin, supprimer l'événement
    await event.destroy();
    console.log(`  ✅ Événement supprimé`);

    res.json({
      status: "success",
      message: "Événement et toutes ses données associées supprimés",
    });
  } catch (err) {
    console.error("❌ Erreur lors de la suppression:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};
