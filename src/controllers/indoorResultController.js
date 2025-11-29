const { v4: uuidv4 } = require("uuid");
const IndoorRaceResult = require("../models/IndoorRaceResult");
const IndoorParticipantResult = require("../models/IndoorParticipantResult");
const Race = require("../models/Race");
const RacePhase = require("../models/RacePhase");
const Crew = require("../models/Crew");
const Category = require("../models/Category");

/**
 * Importe les résultats d'une course depuis ErgRace
 * POST /indoor-results/import
 */
exports.importResults = async (req, res) => {
  try {
    const { results } = req.body;

    if (!results || !results.race_id) {
      return res.status(400).json({
        status: "error",
        message: "Le format JSON ErgRace est invalide (results.race_id manquant)",
      });
    }

    const ergraceRaceId = results.race_id;
    const raceId = results.c2_race_id || null; // ID de la course dans notre plateforme

    // Vérifier que la course existe si race_id est fourni
    if (raceId) {
      const race = await Race.findByPk(raceId);
      if (!race) {
        return res.status(404).json({
          status: "error",
          message: `Course introuvable avec l'ID: ${raceId}`,
        });
      }
    }

    // Vérifier si les résultats existent déjà
    const existingResult = await IndoorRaceResult.findOne({
      where: { ergrace_race_id: ergraceRaceId },
    });

    let indoorRaceResult;
    const isUpdate = !!existingResult;

    // Préparer les métadonnées
    const raceStartTime = results.race_start_time
      ? new Date(results.race_start_time)
      : null;
    const raceEndTime = results.race_end_time
      ? new Date(results.race_end_time)
      : null;

    const raceResultData = {
      race_id: raceId,
      ergrace_race_id: ergraceRaceId,
      ergrace_version: results.ergrace_version || null,
      race_start_time: raceStartTime,
      race_end_time: raceEndTime,
      duration: results.duration || null,
      time_cap: results.time_cap || 0,
      race_file_name: results.race_file_name || null,
      raw_data: results, // JSON complet pour backup
    };

    if (existingResult) {
      // Mise à jour
      await existingResult.update(raceResultData);
      indoorRaceResult = existingResult;

      // Supprimer les anciens résultats participants
      await IndoorParticipantResult.destroy({
        where: { indoor_race_result_id: existingResult.id },
      });
    } else {
      // Création
      raceResultData.id = uuidv4();
      indoorRaceResult = await IndoorRaceResult.create(raceResultData);
    }

    // Traiter les participants
    const participants = results.participants || [];
    const createdParticipants = [];
    let linkedCrewsCount = 0;

    for (const participant of participants) {
      // Tenter de lier avec crew_id
      let crewId = null;
      const ergraceParticipantId = participant.id;

      // Si l'ID est un UUID valide, c'est probablement le crew_id
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(ergraceParticipantId)) {
        // Vérifier que le crew existe
        const crew = await Crew.findByPk(ergraceParticipantId);
        if (crew) {
          crewId = ergraceParticipantId;
          linkedCrewsCount++;
        }
      }

      // Convertir le temps formaté en millisecondes
      let timeMs = null;
      if (participant.time) {
        timeMs = parseTimeToMs(participant.time);
      }

      // Parser logged_time
      let loggedTime = null;
      if (participant.logged_time) {
        loggedTime = parseErgRaceDate(participant.logged_time);
      }

      const participantData = {
        id: uuidv4(),
        indoor_race_result_id: indoorRaceResult.id,
        crew_id: crewId,
        ergrace_participant_id: ergraceParticipantId,
        place: participant.place || null,
        time_ms: timeMs,
        time_display: participant.time || null,
        score: participant.score || null,
        distance: participant.distance || null,
        avg_pace: participant.avg_pace || null,
        spm: participant.spm || null,
        calories: participant.calories || null,
        serial_number: participant.serial_number || null,
        machine_type: participant.machine_type || null,
        logged_time: loggedTime,
        splits_data: participant.splits || null, // Splits optionnels
      };

      const created = await IndoorParticipantResult.create(participantData);
      createdParticipants.push(created);

      // Émettre une mise à jour pour chaque participant (optionnel, pour mises à jour en temps réel)
      // Décommenter si ErgRace envoie des mises à jour participant par participant
      /*
      if (io && (raceId || eventId)) {
        const socketEvents = require("../services/socketEvents")(io);
        
        // Préparer les données du participant avec les infos du crew si lié
        let participantPayload = {
          id: created.id,
          place: created.place,
          time_display: created.time_display,
          time_ms: created.time_ms,
          distance: created.distance,
          avg_pace: created.avg_pace,
          spm: created.spm,
          calories: created.calories,
          crew_id: created.crew_id,
          crew: null,
        };

        // Si le crew est lié, récupérer ses infos
        if (created.crew_id) {
          const crew = await Crew.findByPk(created.crew_id, {
            include: [
              {
                model: Category,
                as: "category",
              },
            ],
          });

          if (crew) {
            participantPayload.crew = {
              id: crew.id,
              club_name: crew.club_name,
              club_code: crew.club_code,
              category: crew.category
                ? {
                    id: crew.category.id,
                    code: crew.category.code,
                    label: crew.category.label,
                  }
                : null,
            };
          }
        }

        socketEvents.emitIndoorParticipantUpdate({
          race_id: raceId,
          event_id: eventId,
          participant: participantPayload,
        });
      }
      */
    }

    // Récupérer l'event_id depuis la course si elle existe
    let eventId = null;
    let raceStatus = "non_official";
    
    if (raceId) {
      const race = await Race.findByPk(raceId, {
        include: [
          {
            model: RacePhase,
            as: "race_phase",
          },
        ],
      });

      if (race) {
        eventId = race.RacePhase?.event_id || null;
        raceStatus = race.status || "non_official";

        // Mettre à jour le statut de la course en "finished" si pas déjà
        if (race.status !== "finished" && race.status !== "official") {
          await Race.update(
            { status: "finished" },
            { where: { id: raceId } }
          );
          raceStatus = "finished";
        }
      }
    }

    // Émettre l'événement WebSocket pour l'import des résultats
    const io = req.app.get("io");
    if (io && (raceId || eventId)) {
      const socketEvents = require("../services/socketEvents")(io);
      
      socketEvents.emitIndoorResultsImported({
        race_id: raceId,
        event_id: eventId,
        participants_count: createdParticipants.length,
        linked_crews_count: linkedCrewsCount,
        race_status: raceStatus,
      });
    }

    res.status(isUpdate ? 200 : 201).json({
      status: "success",
      message: isUpdate
        ? "Résultats mis à jour avec succès"
        : "Résultats importés avec succès",
      data: {
        indoor_race_result_id: indoorRaceResult.id,
        race_id: raceId,
        ergrace_race_id: ergraceRaceId,
        participants_count: createdParticipants.length,
        linked_crews_count: linkedCrewsCount,
        unlinked_participants_count:
          createdParticipants.length - linkedCrewsCount,
      },
    });
  } catch (err) {
    console.error("Error importing indoor results:", err);
    res.status(500).json({
      status: "error",
      message: err.message || "Erreur lors de l'import des résultats",
    });
  }
};

/**
 * Récupère les résultats d'une course
 * GET /indoor-results/race/:race_id
 */
exports.getRaceResults = async (req, res) => {
  try {
    const { race_id } = req.params;

    const indoorRaceResult = await IndoorRaceResult.findOne({
      where: { race_id },
      include: [
        {
          model: Race,
          as: "race",
          include: [
            {
              model: require("../models/RacePhase"),
              as: "race_phase",
            },
          ],
        },
      ],
    });

    if (!indoorRaceResult) {
      return res.status(404).json({
        status: "error",
        message: "Aucun résultat trouvé pour cette course",
      });
    }

    const participantResults = await IndoorParticipantResult.findAll({
      where: { indoor_race_result_id: indoorRaceResult.id },
      include: [
        {
          model: Crew,
          as: "crew",
          include: [
            {
              model: require("../models/Category"),
              as: "category",
            },
          ],
        },
      ],
      order: [["place", "ASC"]],
    });

    res.json({
      status: "success",
      data: {
        race_result: indoorRaceResult,
        participants: participantResults.map((pr) => ({
          id: pr.id,
          place: pr.place,
          time_display: pr.time_display,
          time_ms: pr.time_ms,
          score: pr.score,
          distance: pr.distance,
          avg_pace: pr.avg_pace,
          spm: pr.spm,
          calories: pr.calories,
          machine_type: pr.machine_type,
          logged_time: pr.logged_time,
          crew: pr.crew
            ? {
                id: pr.crew.id,
                club_name: pr.crew.club_name,
                club_code: pr.crew.club_code,
                category: pr.crew.category
                  ? {
                      id: pr.crew.category.id,
                      code: pr.crew.category.code,
                      label: pr.crew.category.label,
                    }
                  : null,
              }
            : null,
          ergrace_participant_id: pr.ergrace_participant_id,
          splits_data: pr.splits_data, // Inclure les splits si présents
        })),
      },
    });
  } catch (err) {
    console.error("Error fetching indoor race results:", err);
    res.status(500).json({
      status: "error",
      message: err.message || "Erreur lors de la récupération des résultats",
    });
  }
};

/**
 * Récupère tous les résultats d'un événement
 * GET /indoor-results/event/:event_id
 */
exports.getEventResults = async (req, res) => {
  try {
    const { event_id } = req.params;

    // Récupérer toutes les courses de l'événement avec leurs résultats
    const races = await Race.findAll({
      include: [
        {
          model: require("../models/RacePhase"),
          where: { event_id },
          required: true,
        },
        {
          model: IndoorRaceResult,
          as: "indoor_results",
          required: true,
        },
      ],
    });

    const results = [];

    for (const race of races) {
      if (race.indoor_results && race.indoor_results.length > 0) {
        const indoorResult = race.indoor_results[0];
        const participants = await IndoorParticipantResult.findAll({
          where: { indoor_race_result_id: indoorResult.id },
          include: [
            {
              model: Crew,
              as: "crew",
              include: [
                {
                  model: require("../models/Category"),
                  as: "category",
                },
              ],
            },
          ],
          order: [["place", "ASC"]],
        });

        results.push({
          race: {
            id: race.id,
            name: race.name,
            race_number: race.race_number,
          },
          result: {
            id: indoorResult.id,
            race_start_time: indoorResult.race_start_time,
            race_end_time: indoorResult.race_end_time,
            duration: indoorResult.duration,
          },
          participants: participants.map((pr) => ({
            place: pr.place,
            time_display: pr.time_display,
            crew: pr.crew
              ? {
                  club_name: pr.crew.club_name,
                  category: pr.crew.category?.label,
                }
              : null,
          })),
        });
      }
    }

    res.json({
      status: "success",
      data: results,
    });
  } catch (err) {
    console.error("Error fetching event results:", err);
    res.status(500).json({
      status: "error",
      message: err.message || "Erreur lors de la récupération des résultats",
    });
  }
};

/**
 * Fonction utilitaire : Convertit un temps formaté "0:24.1" en millisecondes
 */
function parseTimeToMs(timeString) {
  if (!timeString) return null;

  // Format: "0:24.1" ou "1:23.45" ou "37.7"
  const parts = timeString.split(":");
  let totalMs = 0;

  if (parts.length === 2) {
    // Format "M:SS.mmm"
    const minutes = parseInt(parts[0], 10) || 0;
    const secondsParts = parts[1].split(".");
    const seconds = parseInt(secondsParts[0], 10) || 0;
    const milliseconds = parseInt(secondsParts[1] || "0", 10) || 0;

    totalMs = minutes * 60000 + seconds * 1000 + milliseconds * 10;
  } else {
    // Format "SS.mmm"
    const secondsParts = parts[0].split(".");
    const seconds = parseInt(secondsParts[0], 10) || 0;
    const milliseconds = parseInt(secondsParts[1] || "0", 10) || 0;

    totalMs = seconds * 1000 + milliseconds * 10;
  }

  return totalMs;
}

/**
 * Fonction utilitaire : Parse une date ErgRace "28/11/2025 18:32:00"
 */
function parseErgRaceDate(dateString) {
  if (!dateString) return null;

  // Format: "28/11/2025 18:32:00"
  const [datePart, timePart] = dateString.split(" ");
  const [day, month, year] = datePart.split("/");
  const [hour, minute, second] = timePart.split(":");

  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10),
    parseInt(second, 10)
  );
}

