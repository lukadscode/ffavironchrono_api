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

/** Catégories jeunes / mixtes exclues du barème indoor club (réf. règlement FF). */
const INDOOR_RANKING_EXCLUDED_AGE_SUBSTRINGS = [
  "U15",
  "U14",
  "U13",
  "U12",
  "U11",
  "U10",
  "J15",
  "J14",
  "J13",
  "J12",
  "J11",
  "J10",
];

const INDOOR_RANKING_EXCLUDED_KEYWORDS = [
  "partagé",
  "tronc",
  "bras",
  "handisport",
  "handi",
  "para",
  "aviron adapt",
  "aviron adapté",
];

/**
 * Exclusion « hors aviron handisport » et catégories non comptabilisées (aligné classement indoor clubs FF).
 */
function isCategoryExcludedFromIndoorClubRanking(categoryCode, categoryLabel) {
  const code = categoryCode || "";
  const label = (categoryLabel || "").toLowerCase();
  const codeLower = code.toLowerCase();

  if (
    INDOOR_RANKING_EXCLUDED_AGE_SUBSTRINGS.some((s) => code.includes(s))
  ) {
    return true;
  }
  if (
    INDOOR_RANKING_EXCLUDED_KEYWORDS.some(
      (k) => codeLower.includes(k) || label.includes(k)
    )
  ) {
    return true;
  }
  // Codes type PR1… (parabateau), sans matcher des libellés génériques type « sprint »
  if (/\bPR[1-3]\b/i.test(code) || /^PR[1-3]/i.test(code.trim())) {
    return true;
  }
  return false;
}

/**
 * Ligne comptant pour le classement club indoor : au moins un identifiant club renseigné.
 */
function hasCrewClubForIndoorClubRanking(row) {
  const code = row.club_code != null ? String(row.club_code).trim() : "";
  const name = row.club_name != null ? String(row.club_name).trim() : "";
  return code.length > 0 || name.length > 0;
}

/**
 * Pour GET /indoor-results/event/:id/bycategorie : `position` = rang catégorie (tous les temps) ;
 * `points` = barème **classement club** (sous-groupe avec club uniquement, même règle que l'agrégat API).
 * @param {Array} results - categoryData.results (objets mutés)
 */
function assignIndoorByCategoryResultsPositionsAndClubPoints(results, scoringTemplate) {
  const withTime = results.filter((r) => r.time_ms !== null && r.time_ms !== 0);
  withTime.sort((a, b) => {
    const timeA = a.time_ms || 999999999;
    const timeB = b.time_ms || 999999999;
    return timeA - timeB;
  });

  withTime.forEach((r, index) => {
    r.position = index + 1;
  });

  const withClubEligible = withTime.filter((r) => {
    if (!r.is_eligible_for_points || !r.crew) {
      return false;
    }
    return hasCrewClubForIndoorClubRanking({
      club_code: r.crew.club_code,
      club_name: r.crew.club_name,
    });
  });

  const participantCount = withClubEligible.length;
  const eligibleClubCrewIds = new Set(withClubEligible.map((r) => r.crew_id));

  withClubEligible.forEach((r, index) => {
    const place = index + 1;
    const isRelay = r.distance_info?.is_relay || false;
    const pts =
      scoringTemplate && participantCount > 0
        ? calculateIndoorPoints(scoringTemplate, place, participantCount, isRelay)
        : 0;
    r.points = pts > 0 ? pts : null;
  });

  withTime.forEach((r) => {
    if (!eligibleClubCrewIds.has(r.crew_id)) {
      r.points = null;
    }
  });

  const withoutTime = results.filter((r) => r.time_ms === null || r.time_ms === 0);
  withoutTime.forEach((r) => {
    r.position = null;
    r.points = null;
  });

  return [...withTime, ...withoutTime];
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
    const category = raceCrew.crew?.category;
    if (
      category &&
      isCategoryExcludedFromIndoorClubRanking(
        category.code || "",
        category.label || ""
      )
    ) {
      continue;
    }

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

const INDOOR_SCOPE_STANDARD = "standard";
const INDOOR_SCOPE_CF = "championnat_france_indoor";
const INDOOR_SCOPE_DEFIS = "defi_capitaux";

function normalizeIndoorRankingScope(scope) {
  if (scope === INDOOR_SCOPE_CF || scope === INDOOR_SCOPE_DEFIS) {
    return scope;
  }
  return INDOOR_SCOPE_STANDARD;
}

/**
 * Template défis capitaux (barème `classement_defis_capitaux` en BDD).
 */
async function getDefisCapitauxTemplateOrNull() {
  let t = await ScoringTemplate.findOne({
    where: { type: "defis_capitaux", is_default: true },
  });
  if (!t) {
    t = await ScoringTemplate.findOne({ where: { type: "defis_capitaux" } });
  }
  return t;
}

/**
 * Nombre de défis retenus pour la saison (ex. 7). Lu depuis le JSON du template.
 */
function getDefisCapitauxSeasonTopN(defisTemplate) {
  const cfg = defisTemplate?.config;
  if (!cfg || typeof cfg !== "object") {
    return 7;
  }
  const n =
    cfg.nombre_defis_comptabilises ??
    cfg.season_aggregation?.top_n_defis ??
    cfg.aggregation?.defis_capitaux_top_n;
  if (n === undefined || n === null) {
    return 7;
  }
  const num = parseInt(String(n), 10);
  if (!Number.isFinite(num) || num < 1) {
    return 7;
  }
  return Math.min(num, 50);
}

/**
 * Points officiels d'un défi selon le rang au classement général du meeting * (config `classement_defis_capitaux` du ScoringTemplate type defis_capitaux).
 * Réf. FF : rangs 75 et au-delà = 2 pts (surcharge possible via `c7dc_fixed_points_rank_75_plus` dans le JSON du template).
 */
function getDefisCapitauxPointsForRank(defisTemplate, rank) {
  if (!defisTemplate?.config || rank < 1) {
    return 0;
  }
  if (rank >= 75) {
    const o = defisTemplate.config.c7dc_fixed_points_rank_75_plus;
    if (o !== undefined && o !== null && Number.isFinite(Number(o))) {
      return Number(o);
    }
    return 2;
  }
  const raw = defisTemplate.config.classement_defis_capitaux;
  if (raw == null) {
    return 0;
  }

  if (Array.isArray(raw)) {
    const exact = raw.find((row) => {
      const r = row?.rank ?? row?.place ?? row?.rang;
      return Number(r) === rank;
    });
    if (exact != null) {
      const p = exact.points ?? exact.point;
      return p != null ? Number(p) : 0;
    }
    const idx = rank - 1;
    if (idx >= 0 && idx < raw.length) {
      const row = raw[idx];
      const p = row?.points ?? row?.point;
      return p != null ? Number(p) : 0;
    }
    if (raw.length > 0 && rank > raw.length) {
      const last = raw[raw.length - 1];
      const p = last?.points ?? last?.point;
      return p != null ? Number(p) : 0;
    }
    return 0;
  }

  if (typeof raw === "object") {
    const k = String(rank);
    if (raw[k] != null && typeof raw[k] !== "object") {
      return Number(raw[k]);
    }
    const entry = raw[rank];
    if (entry != null && typeof entry === "object") {
      const p = entry.points ?? entry.point;
      return p != null ? Number(p) : 0;
    }
    if (entry != null && typeof entry !== "object") {
      return Number(entry);
    }
  }

  return 0;
}

/**
 * Classement général du meeting (totaux barème indoor par club), puis points défi via template défis.
 */
function mapClubIndoorTotalsToDefisCapitauxPoints(clubPoints, defisTemplate) {
  const rows = Object.entries(clubPoints)
    .map(([clubKey, v]) => ({ clubKey, ...v }))
    .sort((a, b) => {
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }
      const ca = String(a.club_code || a.club_name || "");
      const cb = String(b.club_code || b.club_name || "");
      return ca.localeCompare(cb, "fr");
    });

  const out = {};
  rows.forEach((row, index) => {
    const rank = index + 1;
    const defisPts = getDefisCapitauxPointsForRank(defisTemplate, rank);
    out[row.clubKey] = {
      club_code: row.club_code,
      club_name: row.club_name,
      defis_points: defisPts,
      classement_general_rank: rank,
      indoor_aggregate_points: row.total_points,
    };
  });
  return out;
}

async function computeDefisCapitauxClubPointsForEvent(
  event,
  indoorTemplate,
  defisTemplate
) {
  const clubPoints = await computeIndoorClubPointsByClubKeyForEvent(
    event,
    indoorTemplate
  );
  if (Object.keys(clubPoints).length === 0) {
    return {};
  }
  return mapClubIndoorTotalsToDefisCapitauxPoints(clubPoints, defisTemplate);
}

/**
 * Points indoor par club pour un événement (toutes courses indoor éligibles),
 * même barème et exclusions que getClubRankingsByEventType.
 *
 * Classement club : seules les lignes avec club (code ou nom) et éligibles comptent ;
 * rangs 1…n et tranche du barème (effectif) sont calculés sur ce sous-groupe uniquement
 * (les concurrents sans club ne consomment pas une place ni une tranche).
 *
 * @returns {Record<string, { club_code, club_name, total_points, points_count, results_with_points: Set }>}
 */
async function computeIndoorClubPointsByClubKeyForEvent(event, scoringTemplate) {
  const Race = require("../models/Race");
  const IndoorRaceResult = require("../models/IndoorRaceResult");
  const IndoorParticipantResult = require("../models/IndoorParticipantResult");
  const Crew = require("../models/Crew");
  const Category = require("../models/Category");

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

        const distance = race.Distance;
        const isEligibleDistance =
          distance &&
          ((distance.meters === 2000 && !distance.is_relay) ||
            (distance.meters === 500 && !distance.is_relay) ||
            (distance.is_relay &&
              distance.meters === 250 &&
              distance.relay_count === 8));

        const categoryCode = pr.crew?.category?.code || "";
        const categoryLabel = pr.crew?.category?.label || "";
        const isExcludedCategory = isCategoryExcludedFromIndoorClubRanking(
          categoryCode,
          categoryLabel
        );

        resultsByCategory[categoryKey].push({
          crew_id: pr.crew_id,
          club_name: pr.crew.club_name,
          club_code: pr.crew.club_code,
          time_ms: pr.time_ms,
          distance_info: distance
            ? {
                is_relay: distance.is_relay,
              }
            : null,
          is_eligible_for_points:
            isEligibleDistance &&
            pr.time_ms !== null &&
            pr.time_ms !== 0 &&
            !isExcludedCategory,
        });
      }
    }
  }

  const clubPoints = {};

  for (const categoryKey in resultsByCategory) {
    const categoryResults = resultsByCategory[categoryKey];
    const withTime = categoryResults.filter(
      (r) => r.time_ms !== null && r.time_ms !== 0
    );

    withTime.sort((a, b) => {
      const timeA = a.time_ms || 999999999;
      const timeB = b.time_ms || 999999999;
      return timeA - timeB;
    });

    const withClubEligible = withTime.filter(
      (r) => r.is_eligible_for_points && hasCrewClubForIndoorClubRanking(r)
    );

    const participantCount = withClubEligible.length;
    if (participantCount === 0 || !scoringTemplate) {
      continue;
    }

    withClubEligible.forEach((r, index) => {
      const position = index + 1;
      const clubKey =
        (r.club_code != null && String(r.club_code).trim()) ||
        (r.club_name != null && String(r.club_name).trim());
      if (!clubKey) {
        return;
      }

      const isRelay = r.distance_info?.is_relay || false;
      const points = calculateIndoorPoints(
        scoringTemplate,
        position,
        participantCount,
        isRelay
      );

      if (points > 0) {
        if (!clubPoints[clubKey]) {
          clubPoints[clubKey] = {
            club_code: r.club_code,
            club_name: r.club_name,
            total_points: 0,
            points_count: 0,
            results_with_points: new Set(),
          };
        }

        if (r.club_name && clubPoints[clubKey].club_name !== r.club_name) {
          clubPoints[clubKey].club_name = r.club_name;
        }
        if (r.club_code && clubPoints[clubKey].club_code !== r.club_code) {
          clubPoints[clubKey].club_code = r.club_code;
        }

        clubPoints[clubKey].total_points += points;
        clubPoints[clubKey].points_count += 1;
        clubPoints[clubKey].results_with_points.add(r.crew_id);
      }
    });
  }

  return clubPoints;
}

function clubPointsMapToRankings(clubPoints) {
  return Object.entries(clubPoints)
    .map(([, data]) => ({
      club_name: data.club_name,
      club_code: data.club_code,
      total_points: data.total_points,
      points_count: data.points_count,
      results_count: data.results_with_points.size,
    }))
    .sort((a, b) => b.total_points - a.total_points)
    .map((ranking, index) => ({
      ...ranking,
      rank: index + 1,
    }));
}

/**
 * Récupère les classements des clubs groupés par événement pour un type d'événement donné
 * Calcule les points à la volée depuis les résultats indoor
 */
async function getClubRankingsByEventType(eventType, rankingType = "indoor_points") {
  const Event = require("../models/Event");
  const ScoringTemplate = require("../models/ScoringTemplate");

  const scoringTemplate = await ScoringTemplate.findOne({
    where: { name: "Points Indoor" },
  });

  const events = await Event.findAll({
    where: { race_type: eventType },
    order: [["start_date", "DESC"]],
  });

  const results = [];

  for (const event of events) {
    const clubPoints = await computeIndoorClubPointsByClubKeyForEvent(
      event,
      scoringTemplate
    );
    const rankings = clubPointsMapToRankings(clubPoints);

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

/**
 * Classement indoor clubs agrégé sur une saison (FF : max d'un meeting « standard »,
 * + somme championnat France indoor, + défis capitaux via barème BDD et agrégation des N meilleurs).
 */
async function getSeasonIndoorClubRanking(season) {
  const Event = require("../models/Event");

  if (!season || String(season).trim() === "") {
    throw new Error("Paramètre season requis");
  }

  const scoringTemplate = await ScoringTemplate.findOne({
    where: { name: "Points Indoor" },
  });

  if (!scoringTemplate) {
    throw new Error('Template de points "Points Indoor" introuvable');
  }

  const defisTemplate = await getDefisCapitauxTemplateOrNull();
  const defisTopN = getDefisCapitauxSeasonTopN(defisTemplate);

  const events = await Event.findAll({
    where: { season: String(season).trim() },
    order: [["start_date", "ASC"]],
  });

  const agg = new Map();

  function ensureEntry(clubKey, row) {
    if (!agg.has(clubKey)) {
      agg.set(clubKey, {
        club_code: row.club_code,
        club_name: row.club_name,
        maxStandard: 0,
        bestStandardEventId: null,
        bestStandardEventName: null,
        championnatFrance: 0,
        defisScores: [],
      });
    }
    return agg.get(clubKey);
  }

  for (const event of events) {
    const scope = normalizeIndoorRankingScope(event.indoor_ranking_scope);

    if (scope === INDOOR_SCOPE_DEFIS) {
      const defisMap = await computeDefisCapitauxClubPointsForEvent(
        event,
        scoringTemplate,
        defisTemplate
      );
      const keys = Object.keys(defisMap);
      if (keys.length === 0) {
        continue;
      }
      for (const clubKey of keys) {
        const row = defisMap[clubKey];
        const entry = ensureEntry(clubKey, row);
        if (row.club_name) {
          entry.club_name = row.club_name;
        }
        if (row.club_code) {
          entry.club_code = row.club_code;
        }
        const p =
          row.defis_points != null && Number.isFinite(Number(row.defis_points))
            ? Number(row.defis_points)
            : 0;
        entry.defisScores.push(p);
      }
      continue;
    }

    const clubPoints = await computeIndoorClubPointsByClubKeyForEvent(
      event,
      scoringTemplate
    );
    const clubKeys = Object.keys(clubPoints);
    if (clubKeys.length === 0) {
      continue;
    }

    for (const clubKey of clubKeys) {
      const row = clubPoints[clubKey];
      const pts = row.total_points;
      const entry = ensureEntry(clubKey, row);
      if (row.club_name) {
        entry.club_name = row.club_name;
      }
      if (row.club_code) {
        entry.club_code = row.club_code;
      }

      if (scope === INDOOR_SCOPE_CF) {
        entry.championnatFrance += pts;
      } else if (pts > entry.maxStandard) {
        entry.maxStandard = pts;
        entry.bestStandardEventId = event.id;
        entry.bestStandardEventName = event.name;
      }
    }
  }

  const rankings = [...agg.values()]
    .map((e) => {
      const defisSorted = [...e.defisScores].sort((a, b) => b - a);
      const defisCapitaux = defisSorted
        .slice(0, defisTopN)
        .reduce((s, x) => s + x, 0);
      const total = e.maxStandard + e.championnatFrance + defisCapitaux;
      return {
        club_code: e.club_code,
        club_name: e.club_name,
        total_points: total,
        breakdown: {
          max_standard_event_points: e.maxStandard,
          best_standard_event:
            e.bestStandardEventId != null
              ? {
                  id: e.bestStandardEventId,
                  name: e.bestStandardEventName,
                }
              : null,
          championnat_france_indoor_points: e.championnatFrance,
          defis_capitaux_points: defisCapitaux,
          defis_capitaux_events_count: e.defisScores.length,
          defis_capitaux_top_n_applied: defisTopN,
        },
      };
    })
    .filter((r) => r.total_points > 0)
    .sort((a, b) => b.total_points - a.total_points)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  return {
    season: String(season).trim(),
    defis_capitaux_template: defisTemplate
      ? {
          id: defisTemplate.id,
          name: defisTemplate.name,
          nombre_defis_comptabilises: defisTopN,
        }
      : null,
    rules_summary: {
      standard:
        "Parmi les événements avec indoor_ranking_scope=standard (ou null), on retient le maximum des points obtenus sur un seul événement (barème Points Indoor).",
      championnat_france_indoor:
        "Somme des points sur tous les événements marqués championnat_france_indoor (barème Points Indoor).",
      defi_capitaux:
        "Pour chaque événement defi_capitaux : classement général du meeting = totaux clubs au barème Points Indoor, puis points du barème `classement_defis_capitaux` du template type defis_capitaux en BDD. Sur la saison : somme des N meilleurs scores défi (N = `nombre_defis_comptabilises` dans le template, défaut 7).",
    },
    rankings,
  };
}

/**
 * Tous les événements d'une saison indoor avec classement clubs calculé (même logique que by-type).
 */
async function getIndoorEventsWithClubRankingsForSeason(season) {
  if (!season || String(season).trim() === "") {
    throw new Error("Paramètre season requis");
  }
  const scoringTemplate = await ScoringTemplate.findOne({
    where: { name: "Points Indoor" },
  });
  if (!scoringTemplate) {
    throw new Error('Template de points "Points Indoor" introuvable');
  }
  const Event = require("../models/Event");
  const events = await Event.findAll({
    where: { season: String(season).trim() },
    order: [["start_date", "ASC"]],
  });
  const results = [];
  for (const event of events) {
    const clubPoints = await computeIndoorClubPointsByClubKeyForEvent(
      event,
      scoringTemplate,
    );
    const rankings = clubPointsMapToRankings(clubPoints);
    if (rankings.length > 0) {
      results.push({
        event: {
          id: event.id,
          name: event.name,
          location: event.location,
          start_date: event.start_date,
          end_date: event.end_date,
          race_type: event.race_type,
          indoor_ranking_scope: event.indoor_ranking_scope,
          season: event.season,
        },
        rankings,
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
  getSeasonIndoorClubRanking,
  getIndoorEventsWithClubRankingsForSeason,
  isCategoryExcludedFromIndoorClubRanking,
  assignIndoorByCategoryResultsPositionsAndClubPoints,
};

