const { v4: uuidv4 } = require("uuid");
const ScoringTemplate = require("../models/ScoringTemplate");
const ClubRanking = require("../models/ClubRanking");
const RankingPoint = require("../models/RankingPoint");
const Race = require("../models/Race");
const RaceCrew = require("../models/RaceCrew");
const Crew = require("../models/Crew");
const Distance = require("../models/Distance");
const TimingAssignment = require("../models/TimingAssignment");
const Timing = require("../models/Timing");
const TimingPoint = require("../models/TimingPoint");

/**
 * Récupère le template de points par défaut pour un type donné
 */
async function getScoringTemplate(type = "indoor_points") {
  const template = await ScoringTemplate.findOne({
    where: { type, is_default: true },
  });
  return template;
}

/**
 * Détermine le barème à utiliser selon le nombre de participants
 */
function getPointsRange(participantCount) {
  if (participantCount >= 1 && participantCount <= 3) {
    return "1_3_participants";
  } else if (participantCount >= 4 && participantCount <= 6) {
    return "4_6_participants";
  } else if (participantCount >= 7 && participantCount <= 12) {
    return "7_12_participants";
  } else {
    return "13_plus_participants";
  }
}

/**
 * Calcule les points pour une place donnée selon le barème indoor
 */
function calculateIndoorPoints(template, place, participantCount, isRelay) {
  if (!template || !template.config) {
    return 0;
  }

  const config = template.config;
  const pointsIndoor = config.points_indoor;
  if (!pointsIndoor) {
    return 0;
  }

  const range = getPointsRange(participantCount);
  const rangeConfig = pointsIndoor[range];
  if (!rangeConfig) {
    return 0;
  }

  // Pour "13+", on utilise la dernière entrée
  if (range === "13_plus_participants" && place > 12) {
    const lastEntry = rangeConfig[rangeConfig.length - 1];
    return isRelay ? lastEntry.relais : lastEntry.individuel;
  }

  // Trouver la configuration pour cette place
  const placeConfig = rangeConfig.find((p) => p.place === place);
  if (!placeConfig) {
    return 0;
  }

  return isRelay ? placeConfig.relais : placeConfig.individuel;
}

/**
 * Récupère les résultats d'une course avec les positions
 */
async function getRaceResultsWithPositions(raceId) {
  const race = await Race.findByPk(raceId, {
    include: [
      {
        model: require("../models/RacePhase"),
        as: "race_phase",
        include: [
          {
            model: require("../models/Event"),
            as: "event",
            include: [
              {
                model: TimingPoint,
                as: "timing_points",
              },
            ],
          },
        ],
      },
    ],
  });

  if (!race || !race.race_phase?.event) {
    return [];
  }

  const event = race.race_phase.event;
  const timingPoints = event.timing_points?.sort(
    (a, b) => a.order_index - b.order_index
  ) || [];

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
    return [];
  }

  const raceCrews = await RaceCrew.findAll({
    where: { race_id: raceId },
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

    if (finish_time) {
      results.push({
        crew_id: raceCrew.crew_id,
        club_name: raceCrew.crew?.club_name,
        club_code: raceCrew.crew?.club_code,
        duration_ms,
        finish_time,
      });
    }
  }

  // Trier par temps et assigner les positions
  const sortedResults = results
    .filter((r) => r.duration_ms !== null)
    .sort((a, b) => a.duration_ms - b.duration_ms);

  sortedResults.forEach((r, index) => {
    r.position = index + 1;
  });

  return sortedResults;
}

/**
 * Calcule et enregistre les points pour une course
 */
async function calculatePointsForRace(raceId, rankingType = "indoor_points") {
  const RacePhase = require("../models/RacePhase");
  
  const race = await Race.findByPk(raceId, {
    include: [
      {
        model: Distance,
        required: false,
      },
      {
        model: RacePhase,
        as: "race_phase",
        required: true,
      },
    ],
  });

  if (!race) {
    throw new Error("Course non trouvée");
  }

  const eventId = race.race_phase?.event_id;
  if (!eventId) {
    throw new Error("Événement non trouvé pour cette course");
  }

  // Récupérer le template de points
  const template = await getScoringTemplate(rankingType);
  if (!template) {
    throw new Error(`Template de points non trouvé pour le type: ${rankingType}`);
  }

  // Récupérer les résultats avec positions
  const results = await getRaceResultsWithPositions(raceId);
  if (results.length === 0) {
    return { message: "Aucun résultat avec timing pour cette course" };
  }

  const isRelay = race.Distance?.is_relay || false;
  const participantCount = results.length;

  // Supprimer les anciens points pour cette course
  await RankingPoint.destroy({
    where: { race_id: raceId },
  });

  const pointsCreated = [];

  // Calculer les points pour chaque résultat
  for (const result of results) {
    const points = calculateIndoorPoints(
      template,
      result.position,
      participantCount,
      isRelay
    );

    if (points > 0) {
      // Trouver ou créer le classement du club
      let clubRanking = await ClubRanking.findOne({
        where: {
          event_id: eventId,
          club_name: result.club_name,
          ranking_type: rankingType,
        },
      });

      if (!clubRanking) {
        clubRanking = await ClubRanking.create({
          id: uuidv4(),
          event_id: eventId,
          club_name: result.club_name,
          club_code: result.club_code,
          total_points: 0,
          ranking_type: rankingType,
        });
      }

      // Créer l'entrée de points
      const rankingPoint = await RankingPoint.create({
        id: uuidv4(),
        event_id: eventId,
        club_ranking_id: clubRanking.id,
        race_id: raceId,
        crew_id: result.crew_id,
        place: result.position,
        points: points,
        points_type: isRelay ? "relais" : "individuel",
        participant_count: participantCount,
      });

      // Mettre à jour le total des points du club
      await clubRanking.increment("total_points", { by: points });

      pointsCreated.push({
        club_name: result.club_name,
        place: result.position,
        points: points,
        points_type: isRelay ? "relais" : "individuel",
      });
    }
  }

  // Recalculer les rangs de tous les clubs de l'événement
  await recalculateRanks(eventId, rankingType);

  return {
    message: `${pointsCreated.length} points calculés et enregistrés`,
    points: pointsCreated,
  };
}

/**
 * Recalcule les rangs de tous les clubs pour un événement
 */
async function recalculateRanks(eventId, rankingType = "indoor_points") {
  const rankings = await ClubRanking.findAll({
    where: { event_id: eventId, ranking_type: rankingType },
    order: [["total_points", "DESC"]],
  });

  let currentRank = 1;
  let previousPoints = null;

  for (const ranking of rankings) {
    // Si les points sont différents du précédent, on met à jour le rang
    if (previousPoints !== null && ranking.total_points < previousPoints) {
      currentRank = rankings.findIndex((r) => r.id === ranking.id) + 1;
    }

    await ranking.update({ rank: currentRank });
    previousPoints = ranking.total_points;
  }

  return rankings;
}

/**
 * Récupère le classement des clubs pour un événement
 */
async function getClubRanking(eventId, rankingType = "indoor_points") {
  const rankings = await ClubRanking.findAll({
    where: { event_id: eventId, ranking_type: rankingType },
    include: [
      {
        model: RankingPoint,
        as: "ranking_points",
        include: [
          {
            model: Race,
            required: false,
          },
          {
            model: Crew,
            required: false,
          },
        ],
      },
    ],
    order: [["rank", "ASC"], ["total_points", "DESC"]],
  });

  return rankings;
}

module.exports = {
  getScoringTemplate,
  calculateIndoorPoints,
  calculatePointsForRace,
  recalculateRanks,
  getClubRanking,
  getRaceResultsWithPositions,
};

