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

// GET STATISTICS
exports.getEventStatistics = async (req, res) => {
  try {
    const { id } = req.params;
    const Crew = require("../models/Crew");
    const CrewParticipant = require("../models/CrewParticipant");
    const Participant = require("../models/Participant");

    // Vérifier que l'événement existe
    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({ status: "error", message: "Événement non trouvé" });
    }

    // Récupérer tous les équipages de l'événement avec leurs participants
    const crews = await Crew.findAll({
      where: { event_id: id },
      include: [
        {
          model: CrewParticipant,
          as: "crew_participants",
          include: [
            {
              model: Participant,
              as: "participant",
            },
          ],
        },
      ],
    });

    // Compter les participants uniques
    const participantIds = new Set();
    const participantIdsByGender = {
      homme: new Set(),
      femme: new Set(),
    };

    crews.forEach((crew) => {
      if (crew.crew_participants) {
        crew.crew_participants.forEach((cp) => {
          if (cp.participant) {
            const participantId = cp.participant.id;
            participantIds.add(participantId);

            // Compter par genre
            const gender = cp.participant.gender?.toLowerCase();
            if (gender === "homme" || gender === "h" || gender === "m") {
              participantIdsByGender.homme.add(participantId);
            } else if (gender === "femme" || gender === "f") {
              participantIdsByGender.femme.add(participantId);
            }
          }
        });
      }
    });

    // Compter les clubs distincts (par club_code)
    const clubCodes = new Set();
    crews.forEach((crew) => {
      if (crew.club_code) {
        clubCodes.add(crew.club_code);
      }
    });

    const statistics = {
      event_id: id,
      total_participants: participantIds.size,
      participants_homme: participantIdsByGender.homme.size,
      participants_femme: participantIdsByGender.femme.size,
      total_crews: crews.length,
      total_clubs: clubCodes.size,
    };

    res.json({ status: "success", data: statistics });
  } catch (err) {
    console.error("Error fetching event statistics:", err);
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
    const EventDistance = require("../models/EventDistance");
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

    // 9. Supprimer les liaisons EventDistance (distances liées à cet événement)
    const eventDistances = await EventDistance.findAll({ where: { event_id: id } });
    await EventDistance.destroy({ where: { event_id: id } });
    console.log(`  ✅ ${eventDistances.length} EventDistance supprimés`);

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
