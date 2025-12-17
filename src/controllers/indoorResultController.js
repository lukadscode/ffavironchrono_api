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
    let skippedEmptyLanes = 0;

    for (const participant of participants) {
      // Ignorer les lanes vides sans résultats
      const isEmptyLane = 
        participant.participant === "EMPTY" || 
        participant.class === "EMPTY" ||
        (participant.id && participant.id.startsWith("Lane ") && 
         (!participant.time || !participant.distance || participant.distance === 0));

      if (isEmptyLane) {
        skippedEmptyLanes++;
        continue; // Ignorer cette lane vide
      }

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
        skipped_empty_lanes: skippedEmptyLanes,
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
 * Crée ou met à jour un résultat indoor manuel pour un équipage
 * POST /indoor-results/race/:raceId/manual
 */
exports.createOrUpdateManualResult = async (req, res) => {
  try {
    const paramRaceId = req.params.raceId;
    const {
      race_id: bodyRaceId,
      crew_id,
      lane,
      time_display,
      time_ms,
      distance,
      avg_pace,
      spm,
      calories,
      machine_type,
      logged_time,
      splits_data,
    } = req.body;

    const raceId = paramRaceId || bodyRaceId;

    if (!raceId) {
      return res.status(400).json({
        status: "error",
        message: "race_id est requis (dans l'URL ou le body)",
      });
    }

    // Vérifier que la course existe et récupérer l'event_id via la phase
    const race = await Race.findByPk(raceId, {
      include: [
        {
          model: RacePhase,
          as: "race_phase",
        },
      ],
    });

    if (!race) {
      return res.status(404).json({
        status: "error",
        message: "Course introuvable",
      });
    }

    const eventId = race.race_phase?.event_id || race.RacePhase?.event_id || null;

    // Vérifier que l'équipage existe et appartient bien au même événement
    const crew = await Crew.findByPk(crew_id);
    if (!crew) {
      return res.status(404).json({
        status: "error",
        message: "Équipage introuvable",
      });
    }

    if (eventId && crew.event_id !== eventId) {
      return res.status(400).json({
        status: "error",
        message:
          "L'équipage ne fait pas partie du même événement que la course",
      });
    }

    if (!time_ms || time_ms <= 0 || !distance || distance <= 0) {
      return res.status(400).json({
        status: "error",
        message: "time_ms et distance doivent être strictement positifs",
      });
    }

    // Trouver ou créer le IndoorRaceResult pour cette course
    // Si un résultat existe déjà pour cette course, on le réutilise
    let indoorRaceResult = await IndoorRaceResult.findOne({
      where: { race_id: raceId },
    });

    if (!indoorRaceResult) {
      // Créer un résultat "manuel" minimal
      indoorRaceResult = await IndoorRaceResult.create({
        id: uuidv4(),
        race_id: raceId,
        ergrace_race_id: `manual-${raceId}`,
        ergrace_version: null,
        race_start_time: null,
        race_end_time: null,
        duration: time_ms,
        time_cap: 0,
        race_file_name: null,
        raw_data: null,
      });
    }

    // Chercher un résultat existant pour ce couple (indoor_race_result_id, crew_id)
    let participantResult = await IndoorParticipantResult.findOne({
      where: {
        indoor_race_result_id: indoorRaceResult.id,
        crew_id,
      },
    });

    // Calculer avg_pace si non fourni
    let finalAvgPace = avg_pace;
    if (!finalAvgPace && distance > 0 && time_ms > 0) {
      finalAvgPace = formatPaceFromMsAndDistance(time_ms, distance);
    }

    const loggedTimeValue = logged_time ? new Date(logged_time) : new Date();

    const participantPayload = {
      indoor_race_result_id: indoorRaceResult.id,
      crew_id,
      ergrace_participant_id: crew_id, // pour rester cohérent avec les imports où crew_id peut être un UUID ErgRace
      time_ms,
      time_display,
      score: time_display,
      distance,
      avg_pace: finalAvgPace,
      spm: spm ?? 0,
      calories: calories ?? 0,
      machine_type: machine_type || "Rameur",
      logged_time: loggedTimeValue,
      splits_data: splits_data || null,
    };

    if (participantResult) {
      await participantResult.update(participantPayload);
    } else {
      participantResult = await IndoorParticipantResult.create({
        id: uuidv4(),
        ...participantPayload,
      });
    }

    // Recalculer les places pour tous les participants de cette course
    const allParticipants = await IndoorParticipantResult.findAll({
      where: { indoor_race_result_id: indoorRaceResult.id },
      order: [["time_ms", "ASC"]],
    });

    let currentPlace = 1;
    for (const p of allParticipants) {
      if (p.time_ms && p.time_ms > 0) {
        await p.update({ place: currentPlace });
        currentPlace += 1;
      } else {
        await p.update({ place: null });
      }
    }

    // Mettre à jour la durée globale si besoin
    await indoorRaceResult.update({
      duration: Math.max(
        indoorRaceResult.duration || 0,
        time_ms
      ),
    });

    // Mettre à jour le statut de la course en "finished" si pas déjà
    if (race.status !== "finished" && race.status !== "official") {
      await Race.update(
        { status: "finished" },
        { where: { id: raceId } }
      );
    }

    // Recharger les résultats complets pour renvoyer la même structure que GET /indoor-results/race/:race_id
    const refreshedIndoorRaceResult = await IndoorRaceResult.findOne({
      where: { race_id: raceId },
    });

    const participantResults = await IndoorParticipantResult.findAll({
      where: { indoor_race_result_id: refreshedIndoorRaceResult.id },
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

    res.status(200).json({
      status: "success",
      data: {
        race_result: {
          id: refreshedIndoorRaceResult.id,
          race_id: refreshedIndoorRaceResult.race_id,
          ergrace_race_id: refreshedIndoorRaceResult.ergrace_race_id,
          race_start_time: refreshedIndoorRaceResult.race_start_time,
          race_end_time: refreshedIndoorRaceResult.race_end_time,
          duration: refreshedIndoorRaceResult.duration,
          // raw_data non renvoyé ici, inutile pour un résultat manuel
        },
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
          crew_id: pr.crew_id,
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
          splits_data: pr.splits_data,
        })),
      },
    });
  } catch (err) {
    console.error("Error creating/updating manual indoor result:", err);
    res.status(500).json({
      status: "error",
      message:
        err.message || "Erreur lors de la création/mise à jour du résultat manuel",
    });
  }
};

/**
 * Récupère les résultats d'une course
 * GET /indoor-results/race/:race_id
 * Accessible publiquement si la course a le statut "non_official" ou "official"
 */
exports.getRaceResults = async (req, res) => {
  try {
    const { race_id } = req.params;

    // Vérifier que la course existe et récupérer son statut
    const race = await Race.findByPk(race_id, {
      include: [
        {
          model: RacePhase,
          as: "race_phase",
        },
      ],
    });

    if (!race) {
      return res.status(404).json({
        status: "error",
        message: "Course introuvable",
      });
    }

    // Vérifier si la course est accessible publiquement
    const isPublicStatus = race.status === "non_official" || race.status === "official";
    const isAuthenticated = !!req.user;

    // Si la course n'est pas publique, exiger l'authentification
    if (!isPublicStatus && !isAuthenticated) {
      return res.status(401).json({
        status: "error",
        message: "Authentification requise pour accéder à cette course",
      });
    }

    const indoorRaceResult = await IndoorRaceResult.findOne({
      where: { race_id },
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

    // Ne pas exposer raw_data pour les requêtes publiques (sécurité)
    // Mais splits_data est toujours disponible (données utiles pour l'affichage)
    const includeRawData = isAuthenticated;

    res.json({
      status: "success",
      data: {
        race_result: {
          id: indoorRaceResult.id,
          race_id: indoorRaceResult.race_id,
          ergrace_race_id: indoorRaceResult.ergrace_race_id,
          race_start_time: indoorRaceResult.race_start_time,
          race_end_time: indoorRaceResult.race_end_time,
          duration: indoorRaceResult.duration,
          ...(includeRawData && { raw_data: indoorRaceResult.raw_data }), // Seulement si authentifié
        },
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
          crew_id: pr.crew_id,
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
          splits_data: pr.splits_data, // Toujours envoyé (utile pour l'affichage des splits)
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
 * Récupère tous les résultats d'un événement groupés par catégorie
 * GET /indoor-results/event/:event_id/bycategorie
 */
exports.getEventResultsByCategory = async (req, res) => {
  try {
    const { event_id } = req.params;
    const CrewParticipant = require("../models/CrewParticipant");
    const Participant = require("../models/Participant");
    const ScoringTemplate = require("../models/ScoringTemplate");
    const Distance = require("../models/Distance");

    // Récupérer le template de points "Points Indoor"
    const scoringTemplate = await ScoringTemplate.findOne({
      where: { name: "Points Indoor" },
    });

    // Récupérer toutes les courses de l'événement avec leurs résultats et distances
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
        {
          model: Distance,
          required: false,
        },
      ],
    });

    // Collecter tous les résultats par catégorie
    const resultsByCategory = {};
    const categoriesMap = {};

    for (const race of races) {
      if (race.indoor_results && race.indoor_results.length > 0) {
        const indoorResult = race.indoor_results[0];
        const participantResults = await IndoorParticipantResult.findAll({
          where: { indoor_race_result_id: indoorResult.id },
          include: [
            {
              model: Crew,
              as: "crew",
              include: [
                {
                  model: Category,
                  as: "category",
                },
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
            },
          ],
          order: [["place", "ASC"]],
        });

        for (const pr of participantResults) {
          if (!pr.crew || !pr.crew.category) {
            continue;
          }

          const cat = pr.crew.category;
          const categoryKey = cat.id;

          // Stocker les informations de catégorie
          if (!categoriesMap[categoryKey]) {
            categoriesMap[categoryKey] = {
              id: cat.id,
              code: cat.code,
              label: cat.label,
              age_group: cat.age_group,
              gender: cat.gender,
            };
          }

          // Initialiser la catégorie si nécessaire
          if (!resultsByCategory[categoryKey]) {
            resultsByCategory[categoryKey] = {
              category: categoriesMap[categoryKey],
              results: [],
            };
          }

          // Récupérer les participants de l'équipage (triés par seat_position)
          const participants = pr.crew.crew_participants
            ? pr.crew.crew_participants
                .sort((a, b) => {
                  const posA = a.seat_position || 999;
                  const posB = b.seat_position || 999;
                  return posA - posB;
                })
                .map((cp) => ({
                  id: cp.participant?.id || null,
                  first_name: cp.participant?.first_name || null,
                  last_name: cp.participant?.last_name || null,
                  license_number: cp.participant?.license_number || null,
                  seat_position: cp.seat_position || null,
                  is_coxswain: cp.is_coxswain || false,
                }))
            : [];

          // Vérifier si la distance est éligible pour les points (2000m, 500m ou relais 8x250)
          const distance = race.Distance;
          const isEligibleDistance = distance && (
            (distance.meters === 2000 && !distance.is_relay) ||
            (distance.meters === 500 && !distance.is_relay) ||
            (distance.is_relay && distance.meters === 250 && distance.relay_count === 8)
          );

          // Vérifier si la catégorie est exclue des points
          // Exclure les codes U15, U14, U13, U12, U11, U10, J15, J14, J13, J12, J11, J10
          // Exclure aussi les catégories contenant "partagé", "tronc", ou "bras"
          const excludedCategoryCodes = ['U15', 'U14', 'U13', 'U12', 'U11', 'U10', 'J15', 'J14', 'J13', 'J12', 'J11', 'J10'];
          const excludedKeywords = ['partagé', 'tronc', 'bras'];
          const categoryCode = pr.crew?.category?.code || '';
          const categoryLabel = pr.crew?.category?.label || '';
          const isExcludedByCode = excludedCategoryCodes.some(code => categoryCode.includes(code));
          const isExcludedByKeyword = excludedKeywords.some(keyword => 
            categoryCode.toLowerCase().includes(keyword.toLowerCase()) || 
            categoryLabel.toLowerCase().includes(keyword.toLowerCase())
          );
          const isExcludedCategory = isExcludedByCode || isExcludedByKeyword;

          // Ajouter le résultat (sans position et points pour l'instant, sera calculé après le tri)
          resultsByCategory[categoryKey].results.push({
            race_id: race.id,
            race_number: race.race_number,
            race_name: race.name || null,
            place_in_race: pr.place, // Place dans la course/série (conservée pour référence)
            time_display: pr.time_display,
            time_ms: pr.time_ms,
            score: pr.score,
            distance: pr.distance,
            avg_pace: pr.avg_pace,
            spm: pr.spm,
            calories: pr.calories,
            machine_type: pr.machine_type,
            logged_time: pr.logged_time,
            crew_id: pr.crew_id,
            distance_info: distance ? {
              id: distance.id,
              meters: distance.meters,
              is_relay: distance.is_relay,
              relay_count: distance.relay_count,
              label: distance.label,
            } : null,
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
                        age_group: pr.crew.category.age_group,
                        gender: pr.crew.category.gender,
                      }
                    : null,
                  participants: participants,
                }
              : null,
            position: null, // Sera calculé après le tri par catégorie
            points: null, // Sera calculé après le tri et le calcul des positions
            is_eligible_for_points: isEligibleDistance && pr.time_ms !== null && pr.time_ms !== 0 && !isExcludedCategory,
          });
        }
      }
    }

    // Fonction helper pour calculer les points
    const getPointsRange = (participantCount) => {
      if (participantCount >= 1 && participantCount <= 3) {
        return "1_3_participants";
      } else if (participantCount >= 4 && participantCount <= 6) {
        return "4_6_participants";
      } else if (participantCount >= 7 && participantCount <= 12) {
        return "7_12_participants";
      } else {
        return "13_plus_participants";
      }
    };

    const calculatePoints = (template, position, participantCount, isRelay) => {
      if (!template || !template.config || !position) {
        return null;
      }

      const config = template.config;
      const pointsIndoor = config.points_indoor;
      if (!pointsIndoor) {
        return null;
      }

      const range = getPointsRange(participantCount);
      const rangeConfig = pointsIndoor[range];
      if (!rangeConfig) {
        return null;
      }

      // Pour "13+", on utilise la dernière entrée
      if (range === "13_plus_participants" && position > 12) {
        const lastEntry = rangeConfig[rangeConfig.length - 1];
        return isRelay ? lastEntry.relais : lastEntry.individuel;
      }

      // Trouver la configuration pour cette position
      const placeConfig = rangeConfig.find((p) => p.place === position);
      if (!placeConfig) {
        return null;
      }

      return isRelay ? placeConfig.relais : placeConfig.individuel;
    };

    // Trier les résultats dans chaque catégorie par temps et calculer les positions et points
    for (const categoryKey in resultsByCategory) {
      const categoryData = resultsByCategory[categoryKey];
      
      // Séparer les résultats avec et sans temps
      const withTime = categoryData.results.filter((r) => r.time_ms !== null && r.time_ms !== 0);
      const withoutTime = categoryData.results.filter((r) => r.time_ms === null || r.time_ms === 0);
      
      // Trier par temps (du plus rapide au plus lent)
      withTime.sort((a, b) => {
        const timeA = a.time_ms || 999999999;
        const timeB = b.time_ms || 999999999;
        return timeA - timeB;
      });
      
      // Calculer les positions dans la catégorie
      withTime.forEach((r, index) => {
        r.position = index + 1;
      });
      
      // Calculer les points pour chaque résultat éligible
      const participantCount = withTime.length;
      withTime.forEach((r) => {
        if (r.is_eligible_for_points && r.position && scoringTemplate) {
          // Déterminer si c'est un relais
          const isRelay = r.distance_info?.is_relay || false;
          r.points = calculatePoints(scoringTemplate, r.position, participantCount, isRelay);
        } else {
          r.points = null;
        }
      });
      
      // Ajouter les résultats sans temps à la fin (sans position ni points)
      withoutTime.forEach((r) => {
        r.position = null;
        r.points = null;
      });
      
      // Combiner les résultats triés
      categoryData.results = [...withTime, ...withoutTime];
    }

    // Convertir en tableau
    const formattedResults = Object.values(resultsByCategory);

    res.json({
      status: "success",
      data: formattedResults,
    });
  } catch (err) {
    console.error("Error fetching event results by category:", err);
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

/**
 * Fonction utilitaire : calcule une allure moyenne (pace) à partir de time_ms et distance
 * Format retourné : "M:SS.d" (approximation suffisante pour l'affichage)
 */
function formatPaceFromMsAndDistance(timeMs, distanceMeters) {
  if (!timeMs || !distanceMeters || distanceMeters <= 0) {
    return null;
  }

  // Allure pour 500m (classique en indoor)
  const secondsTotal = timeMs / 1000;
  const pacePerMeter = secondsTotal / distanceMeters;
  const pace500 = pacePerMeter * 500;

  const minutes = Math.floor(pace500 / 60);
  const secondsFloat = pace500 - minutes * 60;

  const seconds = Math.floor(secondsFloat);
  const tenths = Math.round((secondsFloat - seconds) * 10);

  const paddedSeconds = String(seconds).padStart(2, "0");

  return `${minutes}:${paddedSeconds}.${tenths}`;
}

