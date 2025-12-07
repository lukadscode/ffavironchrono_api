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

    // Récupérer toutes les phases de l'événement
    const phases = await RacePhase.findAll({
      where: { event_id: id },
      order: [["order_index", "ASC"]],
    });

    // Collecter tous les résultats
    const allResults = [];

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

          // Récupérer les timings pour cet équipage
          const timingAssignments = await TimingAssignment.findAll({
            where: { crew_id: raceCrew.crew_id },
            include: [
              {
                model: Timing,
                as: "timing",
                where: {
                  timing_point_id: [startPoint.id, finishPoint.id],
                },
                required: false,
              },
            ],
          });

          const startTiming = timingAssignments.find(
            (ta) => ta.timing && ta.timing.timing_point_id === startPoint.id
          );
          const finishTiming = timingAssignments.find(
            (ta) => ta.timing && ta.timing.timing_point_id === finishPoint.id
          );

          let duration_ms = null;
          let finish_time = null;

          if (finishTiming?.timing?.timestamp) {
            finish_time = finishTiming.timing.timestamp;

            if (startTiming?.timing?.timestamp) {
              const start = new Date(startTiming.timing.timestamp);
              const finish = new Date(finishTiming.timing.timestamp);
              duration_ms = finish - start;
            }
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
            category: raceCrew.crew.category
              ? {
                  id: raceCrew.crew.category.id,
                  code: raceCrew.crew.category.code,
                  label: raceCrew.crew.category.label,
                  age_group: raceCrew.crew.category.age_group,
                  gender: raceCrew.crew.category.gender,
                }
              : null,
            finish_time,
            final_time: duration_ms !== null ? duration_ms.toString() : null,
            has_timing: finish_time !== null,
          });
        }
      }
    }

    // Grouper par catégorie
    const resultsByCategory = {};

    for (const result of allResults) {
      if (!result.category) {
        continue;
      }

      const categoryKey = result.category.id;
      if (!resultsByCategory[categoryKey]) {
        resultsByCategory[categoryKey] = {
          category: result.category,
          results: [],
        };
      }

      resultsByCategory[categoryKey].results.push(result);
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
