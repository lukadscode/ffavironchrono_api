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

/**
 * Récupère les classements des clubs groupés par événement pour un type d'événement donné
 * Calcule les points à la volée depuis les résultats indoor
 */
async function getClubRankingsByEventType(eventType, rankingType = "indoor_points") {
  const Event = require("../models/Event");
  const Race = require("../models/Race");
  const IndoorRaceResult = require("../models/IndoorRaceResult");
  const IndoorParticipantResult = require("../models/IndoorParticipantResult");
  const Crew = require("../models/Crew");
  const Category = require("../models/Category");
  const Distance = require("../models/Distance");
  const ScoringTemplate = require("../models/ScoringTemplate");
  
  // Récupérer le template de points "Points Indoor"
  const scoringTemplate = await ScoringTemplate.findOne({
    where: { name: "Points Indoor" },
  });

  // Récupérer tous les événements du type spécifié
  const events = await Event.findAll({
    where: { race_type: eventType },
    order: [["start_date", "DESC"]],
  });

  const results = [];

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

  // Pour chaque événement, calculer les classements des clubs
  for (const event of events) {
    // Récupérer toutes les courses de l'événement avec leurs résultats
    const races = await Race.findAll({
      include: [
        {
          model: require("../models/RacePhase"),
          where: { event_id: event.id },
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

    // Collecter tous les résultats par catégorie pour calculer les positions
    const resultsByCategory = {};

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

          if (!resultsByCategory[categoryKey]) {
            resultsByCategory[categoryKey] = [];
          }

          // Vérifier si la distance est éligible pour les points
          const distance = race.Distance;
          const isEligibleDistance = distance && (
            (distance.meters === 2000 && !distance.is_relay) ||
            (distance.meters === 500 && !distance.is_relay) ||
            (distance.is_relay && distance.meters === 250 && distance.relay_count === 8)
          );

          // Vérifier si la catégorie est exclue des points
          const excludedCategoryCodes = ['U15', 'U14', 'U13', 'U12', 'U11', 'U10', 'J15', 'J14', 'J13', 'J12', 'J11', 'J10'];
          const categoryCode = pr.crew?.category?.code || '';
          const isExcludedCategory = excludedCategoryCodes.some(code => categoryCode.includes(code));

          resultsByCategory[categoryKey].push({
            crew_id: pr.crew_id,
            club_name: pr.crew.club_name,
            club_code: pr.crew.club_code,
            time_ms: pr.time_ms,
            distance_info: distance ? {
              is_relay: distance.is_relay,
            } : null,
            is_eligible_for_points: isEligibleDistance && pr.time_ms !== null && pr.time_ms !== 0 && !isExcludedCategory,
          });
        }
      }
    }

    // Trier les résultats dans chaque catégorie par temps et calculer les positions et points
    const clubPoints = {}; // { club_name: { club_code, total_points, points_count, results_with_points: Set } }

    for (const categoryKey in resultsByCategory) {
      const categoryResults = resultsByCategory[categoryKey];
      
      // Séparer les résultats avec et sans temps
      const withTime = categoryResults.filter((r) => r.time_ms !== null && r.time_ms !== 0);
      const withoutTime = categoryResults.filter((r) => r.time_ms === null || r.time_ms === 0);
      
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
          const points = calculatePoints(scoringTemplate, r.position, participantCount, isRelay);
          
          if (points !== null && points > 0) {
            // Initialiser le club si nécessaire
            if (!clubPoints[r.club_name]) {
              clubPoints[r.club_name] = {
                club_code: r.club_code,
                total_points: 0,
                points_count: 0,
                results_with_points: new Set(), // Pour compter les résultats distincts (crew_id) qui ont marqué des points
              };
            }
            
            // Ajouter les points
            clubPoints[r.club_name].total_points += points;
            clubPoints[r.club_name].points_count += 1;
            
            // Ajouter le crew_id au Set pour compter les résultats distincts
            clubPoints[r.club_name].results_with_points.add(r.crew_id);
          }
        }
      });
    }

    // Convertir en tableau et trier par points décroissants
    const rankings = Object.entries(clubPoints)
      .map(([club_name, data]) => ({
        club_name,
        club_code: data.club_code,
        total_points: data.total_points,
        points_count: data.points_count,
        results_count: data.results_with_points.size, // Nombre de résultats distincts (équipages) qui ont marqué des points
      }))
      .sort((a, b) => b.total_points - a.total_points)
      .map((ranking, index) => ({
        ...ranking,
        rank: index + 1,
      }));

    // Ne pas inclure les événements sans classements
    if (rankings.length > 0) {
      results.push({
        event: {
          id: event.id,
          name: event.name,
          location: event.location,
          start_date: event.start_date,
          end_date: event.end_date,
          race_type: event.race_type,
        },
        rankings: rankings,
      });
    }
  }

  return results;
}

module.exports = {
  getScoringTemplate,
  calculateIndoorPoints,
  calculatePointsForRace,
  recalculateRanks,
  getClubRanking,
  getRaceResultsWithPositions,
  getClubRankingsByEventType,
};

