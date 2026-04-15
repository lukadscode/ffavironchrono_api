const rankingService = require("./rankingService");
const { getMerClubsDashboard } = require("./importEnduranceMerResults");

function enrichIndoorRankingsWithContributions(rankings) {
  if (!Array.isArray(rankings)) return [];
  return rankings.map((r) => {
    const b = r.breakdown || {};
    const contributions = [];
    if (b.best_standard_event?.id != null) {
      contributions.push({
        kind: "meeting_standard_max",
        rule: "meilleur_meeting_standard_saison",
        event_id: b.best_standard_event.id,
        event_name: b.best_standard_event.name,
        points: b.max_standard_event_points,
      });
    }
    if (Number(b.championnat_france_indoor_points) > 0) {
      contributions.push({
        kind: "championnat_france_indoor",
        rule: "somme_tous_evenements_cf_indoor_scope",
        points: b.championnat_france_indoor_points,
      });
    }
    if (Number(b.defis_capitaux_points) > 0) {
      contributions.push({
        kind: "defis_capitaux",
        rule: `top_${b.defis_capitaux_top_n_applied ?? "?"}_meilleurs_defis_saison`,
        points: b.defis_capitaux_points,
        defis_events_rencontres: b.defis_capitaux_events_count,
      });
    }
    return { ...r, contributions };
  });
}

/**
 * GET /rankings/clubs/dashboard — agrège byEvent + global selon le type.
 * @param {{ type: string, season: string, includeTerritorialBonus: boolean }} opts
 */
async function getClubsDashboard(opts) {
  const type = String(opts.type || "").toLowerCase();
  const season = String(
    opts.season != null ? opts.season : new Date().getUTCFullYear(),
  );
  const includeTerritorialBonus = opts.includeTerritorialBonus !== false;

  if (type === "mer") {
    return getMerClubsDashboard({ season, includeTerritorialBonus });
  }

  if (type === "indoor") {
    const [byEvent, globalRaw] = await Promise.all([
      rankingService.getIndoorEventsWithClubRankingsForSeason(season),
      rankingService.getSeasonIndoorClubRanking(season),
    ]);
    return {
      type: "indoor",
      season: globalRaw.season,
      rules_summary: globalRaw.rules_summary,
      defis_capitaux_template: globalRaw.defis_capitaux_template,
      byEvent,
      global: {
        rankings: enrichIndoorRankingsWithContributions(globalRaw.rankings),
      },
    };
  }

  if (type === "riviere") {
    return {
      type: "riviere",
      season,
      rules_summary: {
        note:
          "Classement rivière agrégé : non implémenté. Préciser barème et source des résultats pour extension API.",
      },
      byEvent: [],
      global: { rankings: [] },
    };
  }

  throw new Error("type invalide : indoor | mer | riviere");
}

module.exports = { getClubsDashboard };
