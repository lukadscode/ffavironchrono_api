const { v4: uuidv4 } = require("uuid");
const Race = require("../models/Race");
const RacePhase = require("../models/RacePhase");
const Distance = require("../models/Distance");
const RaceCrew = require("../models/RaceCrew");
const RankingPoint = require("../models/RankingPoint");
const Notification = require("../models/Notification");
const TimingAssignment = require("../models/TimingAssignment");
const Timing = require("../models/Timing");
const TimingPoint = require("../models/TimingPoint");
const { getStartTimingPoint } = require("../utils/relativeTimeCalculator");
const { assertRaceMutable } = require("../utils/raceLock");
const { writeAuditLog } = require("../services/auditLogService");
const logger = require("../utils/logger");
const { assignDeadHeatPositions } = require("../utils/rankingUtils");

exports.createRace = async (req, res) => {
  try {
    const data = req.body || {};
    const race = await Race.create({
      // Whitelist (anti mass-assignment)
      phase_id: data.phase_id,
      name: data.name ?? null,
      race_type: data.race_type ?? null,
      lane_count: data.lane_count ?? null,
      race_number: data.race_number ?? null,
      distance_id: data.distance_id ?? null,
      status: data.status ?? undefined,
      start_time: data.start_time ?? null,
      id: uuidv4(),
    });
    res.status(201).json({ status: "success", data: race });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getRaces = async (req, res) => {
  try {
    const list = await Race.findAll({
      include: [RacePhase, Distance],
      order: [["race_number", "ASC"]],
    });
    res.json({ status: "success", data: list });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getRacesByEvent = async (req, res) => {
  try {
    const { event_id } = req.params;

    const list = await Race.findAll({
      include: [
        {
          model: RacePhase,
          where: { event_id },
          required: true,
        },
        {
          model: Distance,
        },
        {
          model: require("../models/RaceCrew"),
          as: "race_crews",
          include: [
            {
              model: require("../models/Crew"),
              as: "crew",
              include: [
                {
                  model: require("../models/Category"),
                  as: "category",
                },
              ],
            },
          ],
        },
      ],
      order: [["race_number", "ASC"]],
    });

    res.json({ status: "success", data: list });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getRace = async (req, res) => {
  try {
    const race = await Race.findByPk(req.params.id, {
      include: [
        RacePhase,
        Distance,
        {
          model: require("../models/RaceCrew"),
          as: "race_crews",
          include: [
            {
              model: require("../models/Crew"),
              as: "crew",
              include: [
                {
                  model: require("../models/Category"),
                  as: "category",
                },
              ],
            },
          ],
        },
      ],
    });
    if (!race)
      return res.status(404).json({ status: "error", message: "Non trouvé" });
    res.json({ status: "success", data: race });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.updateRace = async (req, res) => {
  try {
    const race = await Race.findByPk(req.params.id, {
      include: [{ model: RacePhase, include: [require("../models/Event")] }],
    });
    if (!race)
      return res.status(404).json({ status: "error", message: "Non trouvé" });

    const oldStatus = race.status;
    const data = req.body || {};
    await race.update({
      name: data.name,
      race_type: data.race_type,
      lane_count: data.lane_count,
      race_number: data.race_number,
      distance_id: data.distance_id,
      status: data.status,
      start_time: data.start_time,
      timing_profile_id:
        data.timing_profile_id === null ? null : data.timing_profile_id || undefined,
    });

    if (req.body.status && req.body.status !== oldStatus && race.RacePhase) {
      const io = req.app.get("io");
      const event_id = race.RacePhase.event_id;

      io.to(`event:${event_id}`).emit("raceStatusUpdate", {
        race_id: race.id,
        status: req.body.status,
      });

      // Si la course passe en statut "official" et qu'elle a des résultats indoor
      if (req.body.status === "official" && oldStatus !== "official") {
        const IndoorRaceResult = require("../models/IndoorRaceResult");
        const IndoorParticipantResult = require("../models/IndoorParticipantResult");
        
        const indoorResult = await IndoorRaceResult.findOne({
          where: { race_id: race.id },
        });

        if (indoorResult) {
          const participantCount = await IndoorParticipantResult.count({
            where: { indoor_race_result_id: indoorResult.id },
          });

          const socketEvents = require("../services/socketEvents")(io);
          socketEvents.emitIndoorRaceResultsComplete({
            race_id: race.id,
            event_id: event_id,
            total_participants: participantCount,
            race_status: "official",
          });
        }
      }
    }

    res.json({ status: "success", data: race });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.deleteRace = async (req, res) => {
  try {
    const { id } = req.params;
    const race = await Race.findByPk(id);
    if (!race)
      return res.status(404).json({ status: "error", message: "Non trouvé" });

    // 🔄 Suppression automatique de tout ce qui dépend de la course
    // 1) Supprimer les RaceCrew liés à cette course
    await RaceCrew.destroy({ where: { race_id: id } });

    // 2) Supprimer les RankingPoint liés à cette course (classements)
    //    (ignorer silencieusement si la table n'existe pas encore en BDD)
    try {
      await RankingPoint.destroy({ where: { race_id: id } });
    } catch (rpErr) {
      const msg =
        (rpErr && rpErr.original && rpErr.original.sqlMessage) ||
        rpErr.message ||
        "";
      // Si le message d'erreur NE concerne PAS une table ranking_points inexistante, on relaie l'erreur
      const isMissingTableError =
        /ranking[_ ]?points/i.test(msg) &&
        /(doesn't exist|does not exist|n'existe pas|doesn t exist)/i.test(msg);
      if (!isMissingTableError) {
        throw rpErr;
      }
      console.warn("RankingPoint table missing, skipping delete for race_id=", id);
    }

    // 3) Supprimer les Notifications liées à cette course
    await Notification.destroy({ where: { race_id: id } });

    // 4) Supprimer enfin la course
    await race.destroy();

    res.json({
      status: "success",
      message: "Course et données associées supprimées automatiquement",
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// GET races with non_official status (for arbitres page)
exports.getNonOfficialRaces = async (req, res) => {
  try {
    const Event = require("../models/Event");

    const races = await Race.findAll({
      where: { status: "non_official" },
      include: [
        {
          model: RacePhase,
          as: "race_phase",
          include: [
            {
              model: Event,
              as: "event",
            },
          ],
        },
        {
          model: Distance,
        },
        {
          model: require("../models/RaceCrew"),
          as: "race_crews",
          include: [
            {
              model: require("../models/Crew"),
              as: "crew",
              include: [
                {
                  model: require("../models/Category"),
                  as: "category",
                },
              ],
            },
          ],
        },
      ],
      order: [
        [
          { model: RacePhase, as: "race_phase" },
          { model: Event, as: "event" },
          "name",
          "ASC",
        ],
        ["race_number", "ASC"],
      ],
    });

    res.json({ status: "success", data: races });
  } catch (err) {
    console.error("Error fetching non-official races:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// GET race results by race ID
exports.getRaceResults = async (req, res) => {
  try {
    const { race_id } = req.params;
    const RaceCrew = require("../models/RaceCrew");
    const Crew = require("../models/Crew");
    const Category = require("../models/Category");
    const TimingAssignment = require("../models/TimingAssignment");
    const Timing = require("../models/Timing");
    const TimingPoint = require("../models/TimingPoint");
    const Event = require("../models/Event");

    const race = await Race.findByPk(race_id, {
      include: [
        {
          model: RacePhase,
          as: "race_phase",
          include: [
            {
              model: require("../models/Event"),
              as: "event",
              include: [
                {
                  model: require("../models/TimingPoint"),
                  as: "timing_points",
                },
              ],
            },
          ],
        },
      ],
    });

    if (!race) {
      return res
        .status(404)
        .json({ status: "error", message: "Course non trouvée" });
    }

    // Accéder à l'événement via la relation
    const event = race.race_phase?.event;
    if (!event || !event.timing_points) {
      return res.json({ status: "success", data: [] });
    }

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
      return res.json({ status: "success", data: [] });
    }

    // Récupérer tous les équipages de la course
    const raceCrews = await RaceCrew.findAll({
      where: { race_id },
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
      order: [["lane", "ASC"]],
    });

    const results = [];

    for (const raceCrew of raceCrews) {
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

      const adjustmentMs = Number(raceCrew.adjustment_ms) || 0;
      const rawDurationMs = duration_ms;
      if (duration_ms !== null) {
        duration_ms += adjustmentMs;
      }

      results.push({
        crew_id: raceCrew.crew_id,
        race_crew_id: raceCrew.id,
        lane: raceCrew.lane,
        status: raceCrew.status || "registered",
        adjustment_ms: adjustmentMs,
        adjustment_reason: raceCrew.adjustment_reason || null,
        raw_duration_ms: rawDurationMs,
        club_name: raceCrew.crew?.club_name || null,
        club_code: raceCrew.crew?.club_code || null,
        category: raceCrew.crew?.category
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

    // Trier par temps et calculer les positions
    const sortedResults = assignDeadHeatPositions(
      results
        .filter((r) => r.has_timing)
        .sort((a, b) => {
          const timeA = parseInt(a.final_time || "999999999", 10);
          const timeB = parseInt(b.final_time || "999999999", 10);
          return timeA - timeB;
        }),
      (r) => (r.final_time !== null ? parseInt(r.final_time, 10) : null)
    );

    const resultsWithoutTiming = results
      .filter((r) => !r.has_timing)
      .map((r) => ({ ...r, position: null }));

    const allResults = [...sortedResults, ...resultsWithoutTiming];

    res.json({ status: "success", data: allResults });
  } catch (err) {
    logger.error({ err }, "Error fetching race results");
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.gunStart = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_time } = req.body || {};

    const race = await assertRaceMutable(id);
    const raceWithPhase = await Race.findByPk(id, { include: [RacePhase] });
    const gunTime = start_time ? new Date(start_time) : new Date();

    await race.update({ start_time: gunTime, status: "in_progress" });

    const event_id = raceWithPhase?.RacePhase?.event_id;
    const io = req.app.get("io");
    if (io && event_id) {
      const payload = {
        race_id: race.id,
        start_time: gunTime,
        status: "in_progress",
      };
      io.to(`event:${event_id}`).emit("gunStart", payload);
      io.to(`race:${race.id}`).emit("gunStart", payload);
    }

    await writeAuditLog({
      userId: req.user?.userId,
      action: "gun_start",
      entityType: "race",
      entityId: race.id,
      eventId: event_id,
      metadata: { start_time: gunTime.toISOString() },
      req,
    });

    res.json({ status: "success", data: race });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ status: "error", message: err.message });
  }
};

exports.falseStart = async (req, res) => {
  try {
    const { id } = req.params;
    const race = await assertRaceMutable(id);
    const raceWithPhase = await Race.findByPk(id, { include: [RacePhase] });
    const event_id = raceWithPhase?.RacePhase?.event_id;

    const startPoint = event_id ? await getStartTimingPoint(event_id) : null;
    const raceCrews = await RaceCrew.findAll({ where: { race_id: id } });
    const crewIds = raceCrews.map((rc) => rc.crew_id);

    if (startPoint && crewIds.length > 0) {
      const assignments = await TimingAssignment.findAll({
        where: { crew_id: crewIds },
        include: [
          {
            model: Timing,
            as: "timing",
            where: { timing_point_id: startPoint.id },
            required: true,
          },
        ],
      });

      for (const assignment of assignments) {
        await Timing.update({ status: "hidden" }, { where: { id: assignment.timing_id } });
        await assignment.destroy();
      }
    }

    await race.update({ status: "not_started", start_time: null });

    const io = req.app.get("io");
    if (io && event_id) {
      const payload = { race_id: race.id, status: "not_started" };
      io.to(`event:${event_id}`).emit("falseStart", payload);
      io.to(`race:${race.id}`).emit("falseStart", payload);
    }

    await writeAuditLog({
      userId: req.user?.userId,
      action: "false_start",
      entityType: "race",
      entityId: race.id,
      eventId: event_id,
      metadata: { cleared_start_assignments: crewIds.length },
      req,
    });

    res.json({ status: "success", data: race });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ status: "error", message: err.message });
  }
};

exports.validateRace = async (req, res) => {
  try {
    const { id } = req.params;
    const User = require("../models/User");

    const race = await Race.findByPk(id, {
      include: [{ model: RacePhase, include: [require("../models/Event")] }],
    });

    if (!race) {
      return res.status(404).json({ status: "error", message: "Course non trouvée" });
    }

    if (race.status === "official") {
      return res.status(400).json({
        status: "error",
        message: "Course déjà validée officiellement",
      });
    }

    if (race.status !== "non_official") {
      return res.status(400).json({
        status: "error",
        message: "Seules les courses non officielles peuvent être validées",
      });
    }

    const validatedAt = new Date();
    await race.update({
      status: "official",
      validated_by: req.user?.userId || null,
      validated_at: validatedAt,
    });

    const event_id = race.RacePhase?.event_id;
    const io = req.app.get("io");
    if (io && event_id) {
      io.to(`event:${event_id}`).emit("raceStatusUpdate", {
        race_id: race.id,
        status: "official",
        validated_by: req.user?.userId,
        validated_at: validatedAt,
      });
    }

    await writeAuditLog({
      userId: req.user?.userId,
      action: "validate_race",
      entityType: "race",
      entityId: race.id,
      eventId: event_id,
      metadata: { validated_at: validatedAt.toISOString() },
      req,
    });

    let validator = null;
    if (req.user?.userId) {
      const user = await User.findByPk(req.user.userId, {
        attributes: ["id", "email", "first_name", "last_name"],
      });
      if (user) {
        validator = user.toJSON ? user.toJSON() : user;
      }
    }

    res.json({
      status: "success",
      data: {
        ...race.toJSON(),
        status: "official",
        validated_by: req.user?.userId,
        validated_at: validatedAt,
        validator,
      },
    });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ status: "error", message: err.message });
  }
};
