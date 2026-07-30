const { v4: uuidv4 } = require("uuid");
const Timing = require("../models/Timing");

const TimingPoint = require("../models/TimingPoint");
const Race = require("../models/Race");
const RacePhase = require("../models/RacePhase");
const Event = require("../models/Event");
const TimingAssignment = require("../models/TimingAssignment");
const Crew = require("../models/Crew");
const RaceCrew = require("../models/RaceCrew");
const Category = require("../models/Category");
const {
  enrichTimingsWithRelativeTime,
  enrichTimingWithRelativeTime,
} = require("../utils/relativeTimeCalculator");
const { assertCrewRaceMutable } = require("../utils/raceLock");
const logger = require("../utils/logger");
const { findDuplicateGroups } = require("../utils/timingReconciliationUtils");
const { writeAuditLog } = require("../services/auditLogService");

exports.createTiming = async (req, res) => {
  try {
    // Vérifier que le timing_point_id correspond au token
    if (req.timingPoint && req.body.timing_point_id !== req.timingPoint.timing_point_id) {
      return res.status(403).json({
        status: "error",
        message: "Vous ne pouvez créer des timings que pour votre timing point",
      });
    }

    const data = req.body || {};
    const timing = await Timing.create({
      id: uuidv4(),
      // Whitelist (anti mass-assignment)
      timing_point_id: data.timing_point_id ?? null,
      timestamp: data.timestamp ?? null,
      manual_entry: typeof data.manual_entry === "boolean" ? data.manual_entry : undefined,
      status: data.status ?? undefined,
      entered_by: req.user?.userId ?? null,
      device_id: typeof data.device_id === "string" ? data.device_id.slice(0, 128) : null,
    });

    const point = await TimingPoint.findByPk(timing.timing_point_id, {
      include: Event,
    });

    const io = req.app.get("io");
    let enrichedTiming = timing;

    const timingWithRelations = await Timing.findByPk(timing.id, {
      include: [
        { model: TimingPoint },
        {
          model: TimingAssignment,
          required: false,
          include: [
            {
              model: Crew,
              include: [
                {
                  model: RaceCrew,
                  as: "RaceCrews",
                  include: [{ model: Race, include: [RacePhase] }],
                },
              ],
            },
          ],
        },
      ],
    });

    if (timingWithRelations) {
      enrichedTiming = await enrichTimingWithRelativeTime(timingWithRelations);
    }

    if (io && point?.Event?.id) {
      io.to(`point_${point.id}`).emit("timingImpulse", enrichedTiming);
    }

    res.status(201).json({ status: "success", data: enrichedTiming });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * Synchronisation par lot depuis un appareil mobile hors-ligne.
 * Idempotent : chaque lecture porte un client_read_id généré sur l'appareil,
 * ce qui permet de rejouer un lot sans jamais créer de doublon.
 */
exports.batchCreateTimings = async (req, res) => {
  try {
    const reads = Array.isArray(req.body?.reads) ? req.body.reads : [];
    if (reads.length === 0) {
      return res.status(400).json({ status: "error", message: "Aucune lecture fournie" });
    }
    if (reads.length > 200) {
      return res.status(400).json({ status: "error", message: "Lot trop volumineux (max 200)" });
    }

    const { performAssignment } = require("./timingAssignmentController");
    const io = req.app.get("io");
    const results = [];
    const confirmedByPoint = new Map();

    for (const read of reads) {
      const clientReadId = typeof read?.client_read_id === "string" ? read.client_read_id : null;
      if (!clientReadId) {
        results.push({ client_read_id: null, status: "error", error: "client_read_id requis" });
        continue;
      }

      // Un poste de chronométrage ne peut écrire que sur son propre point
      if (req.timingPoint && read.timing_point_id !== req.timingPoint.timing_point_id) {
        results.push({
          client_read_id: clientReadId,
          status: "error",
          error: "Point de chronométrage non autorisé",
        });
        continue;
      }

      try {
        let timing = await Timing.findOne({ where: { client_read_id: clientReadId } });
        let created = false;

        if (!timing) {
          timing = await Timing.create({
            id: uuidv4(),
            timing_point_id: read.timing_point_id ?? null,
            timestamp: read.timestamp ?? null,
            manual_entry: typeof read.manual_entry === "boolean" ? read.manual_entry : true,
            status: "pending",
            entered_by: req.user?.userId ?? null,
            device_id: typeof read.device_id === "string" ? read.device_id.slice(0, 128) : null,
            client_read_id: clientReadId,
            race_id: read.race_id ?? null,
            capture_mode: typeof read.capture_mode === "string" ? read.capture_mode.slice(0, 20) : null,
          });
          created = true;
        }

        let assignmentStatus = null;
        if (read.crew_id) {
          const timingWithPoint = await Timing.findByPk(timing.id, { include: [TimingPoint] });
          const { alreadyExisted } = await performAssignment({
            timing: timingWithPoint,
            crew_id: read.crew_id,
            io,
          });
          assignmentStatus = alreadyExisted ? "already_assigned" : "assigned";
        }

        results.push({
          client_read_id: clientReadId,
          server_id: timing.id,
          status: created ? "created" : "already_exists",
          assignment: assignmentStatus,
        });

        if (timing.timing_point_id) {
          if (!confirmedByPoint.has(timing.timing_point_id)) confirmedByPoint.set(timing.timing_point_id, []);
          confirmedByPoint.get(timing.timing_point_id).push({
            client_read_id: clientReadId,
            server_id: timing.id,
          });
        }
      } catch (itemErr) {
        logger.error({ err: itemErr, clientReadId }, "batchCreateTimings item error");
        results.push({ client_read_id: clientReadId, status: "error", error: itemErr.message });
      }
    }

    if (io) {
      for (const [pointId, confirmations] of confirmedByPoint.entries()) {
        io.to(`point_${pointId}`).emit("timingReadsConfirmed", { confirmations });
      }
    }

    res.status(201).json({ status: "success", data: { results } });
  } catch (err) {
    logger.error({ err }, "batchCreateTimings error");
    res.status(500).json({ status: "error", message: err.message });
  }
};

// GET timings by event
exports.getTimingsByEvent = async (req, res) => {
  try {
    const { event_id } = req.params;

    const list = await Timing.findAll({
      include: [
        {
          model: TimingPoint,
          required: true,
          where: { event_id },
          include: [Event], // Facultatif
        },
        {
          model: TimingAssignment,
          required: false,
          include: [
            {
              model: Crew,
              include: [
                {
                  model: RaceCrew,
                  as: "RaceCrews",
                  include: [
                    {
                      model: Race,
                      include: [RacePhase],
                    },
                  ],
                },
                {
                  model: Category,
                  as: "category",
                },
              ],
            },
          ],
        },
      ],
      order: [["timestamp", "DESC"]],
    });

    // Enrichir avec relative_time_ms, crew_id, race_id
    const enrichedList = await enrichTimingsWithRelativeTime(list);

    res.json({ status: "success", data: enrichedList });
  } catch (err) {
    logger.error({ err }, "getTimingsByEvent error");
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getTimings = async (req, res) => {
  try {
    const list = await Timing.findAll({
      include: [
        {
          model: TimingPoint,
          include: [
            {
              model: Race,
              include: [
                {
                  model: RacePhase,
                  include: [Event],
                },
              ],
            },
          ],
        },
        {
          model: TimingAssignment,
          required: false,
          include: [
            {
              model: Crew,
              include: [
                {
                  model: RaceCrew,
                  as: "RaceCrews",
                  include: [
                    {
                      model: Race,
                      include: [RacePhase],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      order: [["timestamp", "DESC"]],
    });

    // Enrichir avec relative_time_ms, crew_id, race_id
    const enrichedList = await enrichTimingsWithRelativeTime(list);

    res.json({ status: "success", data: enrichedList });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getTiming = async (req, res) => {
  try {
    const timing = await Timing.findByPk(req.params.id, {
      include: [
        {
          model: TimingPoint,
        },
        {
          model: TimingAssignment,
          required: false,
          include: [
            {
              model: Crew,
              include: [
                {
                  model: RaceCrew,
                  as: "RaceCrews",
                  include: [
                    {
                      model: Race,
                      include: [RacePhase],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    if (!timing)
      return res.status(404).json({ status: "error", message: "Non trouvé" });

    // Enrichir avec relative_time_ms, crew_id, race_id
    const enrichedTiming = await enrichTimingsWithRelativeTime([timing]);
    res.json({ status: "success", data: enrichedTiming[0] });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ status: "error", message: err.message });
  }
};

exports.updateTiming = async (req, res) => {
  try {
    const timing = await Timing.findByPk(req.params.id);
    if (!timing)
      return res.status(404).json({ status: "error", message: "Non trouvé" });

    // Vérifier que le timing appartient au timing point authentifié (si authentifié via timing point)
    if (req.timingPoint && timing.timing_point_id !== req.timingPoint.timing_point_id) {
      return res.status(403).json({
        status: "error",
        message: "Vous ne pouvez modifier que les timings de votre timing point",
      });
    }

    const assignment = await TimingAssignment.findOne({ where: { timing_id: timing.id } });
    if (assignment) {
      await assertCrewRaceMutable(assignment.crew_id);
    }

    const data = req.body || {};
    await timing.update({
      timestamp: data.timestamp,
      status: data.status,
      manual_entry: typeof data.manual_entry === "boolean" ? data.manual_entry : undefined,
      device_id: typeof data.device_id === "string" ? data.device_id.slice(0, 128) : undefined,
    });
    res.json({ status: "success", data: timing });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ status: "error", message: err.message });
  }
};

// GET timings by race
exports.getTimingsByRace = async (req, res) => {
  try {
    const { race_id } = req.params;

    // Trouver tous les équipages de la course
    const raceCrews = await RaceCrew.findAll({
      where: { race_id },
      attributes: ["crew_id"],
    });

    const crewIds = raceCrews.map((rc) => rc.crew_id);

    if (crewIds.length === 0) {
      return res.json({ status: "success", data: [] });
    }

    // Trouver les timings liés à ces équipages.
    // IMPORTANT: on ne doit PAS perdre les timings non assignés (pending) au refresh.
    const list = await Timing.findAll({
      include: [
        {
          model: TimingPoint,
          required: true,
        },
        {
          model: TimingAssignment,
          required: false,
          where: {
            crew_id: crewIds,
          },
          include: [
            {
              model: Crew,
              include: [
                {
                  model: RaceCrew,
                  as: "RaceCrews",
                  where: { race_id },
                  include: [
                    {
                      model: Race,
                      include: [RacePhase],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      order: [["timestamp", "DESC"]],
    });

    // Enrichir avec relative_time_ms, crew_id, race_id
    const enrichedList = await enrichTimingsWithRelativeTime(list);

    res.json({ status: "success", data: enrichedList });
  } catch (err) {
    logger.error({ err, race_id: req.params?.race_id }, "getTimingsByRace error");
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.deleteTiming = async (req, res) => {
  try {
    const timing = await Timing.findByPk(req.params.id);
    if (!timing)
      return res.status(404).json({ status: "error", message: "Non trouvé" });

    // Vérifier que le timing appartient au timing point authentifié (si authentifié via timing point)
    if (req.timingPoint && timing.timing_point_id !== req.timingPoint.timing_point_id) {
      return res.status(403).json({
        status: "error",
        message: "Vous ne pouvez supprimer que les timings de votre timing point",
      });
    }

    const assignment = await TimingAssignment.findOne({
      where: { timing_id: timing.id },
    });

    if (assignment) {
      await assertCrewRaceMutable(assignment.crew_id);
      await assignment.destroy();
    }

    await timing.destroy();
    res.json({ status: "success", message: "Timing supprimé" });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ status: "error", message: err.message });
  }
};

exports.getDuplicatesByPoint = async (req, res) => {
  try {
    const { timing_point_id } = req.params;
    const thresholdMs = Math.min(
      Math.max(parseInt(req.query.threshold_ms, 10) || 500, 50),
      5000
    );

    const timings = await Timing.findAll({
      where: { timing_point_id },
      order: [["timestamp", "ASC"]],
    });

    const groups = findDuplicateGroups(timings, thresholdMs).map((group) =>
      group.map((t) => (t.toJSON ? t.toJSON() : t))
    );

    res.json({
      status: "success",
      data: {
        threshold_ms: thresholdMs,
        groups,
        count: groups.length,
      },
    });
  } catch (err) {
    logger.error({ err }, "getDuplicatesByPoint error");
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.reconcileTimings = async (req, res) => {
  try {
    const { keep_id, hide_ids } = req.body || {};

    if (!keep_id || !Array.isArray(hide_ids) || hide_ids.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "keep_id et hide_ids (tableau) sont requis",
      });
    }

    const keepTiming = await Timing.findByPk(keep_id);
    if (!keepTiming) {
      return res.status(404).json({ status: "error", message: "Timing conservé introuvable" });
    }

    const toHide = await Timing.findAll({
      where: { id: hide_ids, timing_point_id: keepTiming.timing_point_id },
    });

    if (toHide.length !== hide_ids.length) {
      return res.status(400).json({
        status: "error",
        message: "Tous les timings à masquer doivent appartenir au même point",
      });
    }

    for (const timing of toHide) {
      if (timing.id === keep_id) continue;

      const assignment = await TimingAssignment.findOne({
        where: { timing_id: timing.id },
      });
      if (assignment) {
        await assertCrewRaceMutable(assignment.crew_id);
        await assignment.destroy();
      }
      await timing.update({ status: "hidden" });
    }

    const point = await TimingPoint.findByPk(keepTiming.timing_point_id);

    await writeAuditLog({
      userId: req.user?.userId,
      action: "reconcile_timings",
      entityType: "timing_point",
      entityId: keepTiming.timing_point_id,
      eventId: point?.event_id,
      metadata: { keep_id, hide_ids },
      req,
    });

    res.json({
      status: "success",
      data: { keep_id, hidden: hide_ids },
    });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ status: "error", message: err.message });
  }
};
