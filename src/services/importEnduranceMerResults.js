const XLSX = require("xlsx");
const { v4: uuidv4 } = require("uuid");
const { Op } = require("sequelize");
const EnduranceMerImportResult = require("../models/EnduranceMerImportResult");
const EnduranceMerTerritorialBonus = require("../models/EnduranceMerTerritorialBonus");
const Event = require("../models/Event");
const ScoringTemplate = require("../models/ScoringTemplate");
const {
  DEFAULT_ENDURANCE_MER_TEMPLATE_CONFIG,
  calculatePointsFromConfig,
  inferBRSGroup,
} = require("../constants/enduranceMerBaremes");

const SHEET_ORGANISATEUR = "Organisateur";
const DATA_START_ROW_SIMPLE = 5;
const DATA_START_ROW_U17 = 6;
const U17_SHEETS = new Set([
  "U17F4X+",
  "U17H4X+",
  "U17M4X+",
  "U17F4X",
  "U17H4X",
  "U17M4X",
]);

function isU17Sheet(sheetName) {
  const n = String(sheetName || "").toUpperCase();
  return U17_SHEETS.has(n) || n.startsWith("U17");
}

/** Valeur affichée d'une cellule Excel (évite objets SheetJS, espaces insécables). */
function getCellString(cell) {
  if (cell === null || cell === undefined || cell === "") return null;
  if (cell instanceof Date) return String(cell).trim();
  if (typeof cell === "object" && !Array.isArray(cell)) {
    if (cell.v != null && cell.v !== "") return getCellString(cell.v);
    if (cell.w != null && String(cell.w).trim() !== "")
      return String(cell.w).trim();
    if (cell.r != null) return String(cell.r).trim();
    return null;
  }
  return String(cell).trim();
}

function normalizeInlineMixedSlashes(s) {
  return String(s)
    .replace(/\uFF0F/g, "/")
    .replace(/\u2215/g, "/")
    .replace(/\u2044/g, "/")
    .replace(/\u00A0/g, " ");
}

function getSheetRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
}

function isDataRow(row) {
  if (!row || !Array.isArray(row)) return false;
  const place = row[0];
  if (place === "Ex." || place === null || place === undefined) return false;
  const num = parseInt(place, 10);
  return !Number.isNaN(num) && num >= 1;
}

/**
 * Code club « multi-clubs » sur une seule cellule : C029009(2)/C029028(3) ou N segments.
 * 0 pt en base, is_mixed_clubs + club_codes_mixed ; compte dans partants.
 */
function parseInlineMixedCrewCellStrict(s) {
  const normalized = normalizeInlineMixedSlashes(s).trim();
  if (!normalized) return null;
  const segments = normalized
    .split(/\s*\/\s*/)
    .map((x) => x.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  if (segments.length < 2) return null;
  const partRe = /^([A-Za-z][A-Za-z0-9]*)\s*\(\s*(\d+)\s*\)$/;
  for (const seg of segments) {
    if (!partRe.test(seg)) return null;
  }
  return { raw: normalized };
}

function looksLikeInlineMixedClubCell(s) {
  if (!s || typeof s !== "string") return false;
  const t = normalizeInlineMixedSlashes(s).trim();
  if (!t.includes("/")) return false;
  const segments = t.split(/\s*\/\s*/).filter(Boolean);
  if (segments.length < 2) return false;
  return segments.every((seg) => /\([0-9]+\)/.test(seg));
}

function parseInlineMixedCrewCell(cell) {
  const raw = getCellString(cell);
  if (!raw) return null;
  const strict = parseInlineMixedCrewCellStrict(raw);
  if (strict) return strict;
  if (looksLikeInlineMixedClubCell(raw))
    return { raw: normalizeInlineMixedSlashes(raw).trim() };
  return null;
}

function getDataRowsSimple(rows) {
  const out = [];
  for (let i = DATA_START_ROW_SIMPLE; i < rows.length; i++) {
    const row = rows[i];
    if (!isDataRow(row)) continue;
    const place = parseInt(row[0], 10);
    const clubCode = getCellString(row[1]);
    const clubName = getCellString(row[2]);
    if (Number.isNaN(place)) continue;
    const inline = clubCode ? parseInlineMixedCrewCell(clubCode) : null;
    if (inline) {
      out.push({
        place,
        inline_mixed: true,
        inline_mixed_raw: inline.raw,
        inline_mixed_sheet_label: clubName || null,
        club_code: "MIXTE",
        club_name: clubName || null,
        is_mixed: true,
        club_code_2: null,
        club_name_2: null,
        nb_club1: null,
        nb_club2: null,
      });
      continue;
    }
    out.push({
      place,
      club_code: clubCode || null,
      club_name: clubName || null,
      is_mixed: false,
      club_code_2: null,
      club_name_2: null,
      nb_club1: null,
      nb_club2: null,
    });
  }
  return out;
}

function getDataRowsU17(rows) {
  const out = [];
  for (let i = DATA_START_ROW_U17; i < rows.length; i++) {
    const row = rows[i];
    if (!isDataRow(row)) continue;
    const place = parseInt(row[0], 10);
    const clubCode = getCellString(row[1]);
    const clubName = getCellString(row[2]);
    const clubCode2 = getCellString(row[3]);
    const clubName2 = getCellString(row[4]);
    const nb1 = row[5] != null ? parseInt(row[5], 10) : null;
    const nb2 = row[6] != null ? parseInt(row[6], 10) : null;
    if (Number.isNaN(place)) continue;
    const inline = clubCode ? parseInlineMixedCrewCell(clubCode) : null;
    if (inline) {
      out.push({
        place,
        inline_mixed: true,
        inline_mixed_raw: inline.raw,
        inline_mixed_sheet_label: clubName || null,
        club_code: "MIXTE",
        club_name: clubName || null,
        is_mixed: true,
        club_code_2: null,
        club_name_2: null,
        nb_club1: null,
        nb_club2: null,
      });
      continue;
    }
    const isMixte =
      (clubCode && String(clubCode).toUpperCase() === "MIXTE") ||
      (clubCode2 && String(clubCode2).trim() !== "");
    out.push({
      place,
      club_code: clubCode || null,
      club_name: clubName || null,
      is_mixed: isMixte,
      club_code_2: clubCode2 || null,
      club_name_2: clubName2 || null,
      nb_club1: Number.isNaN(nb1) ? null : nb1,
      nb_club2: Number.isNaN(nb2) ? null : nb2,
    });
  }
  return out;
}

async function getEnduranceMerScoringConfig() {
  const template = await ScoringTemplate.findOne({
    where: { type: "endurance_mer", is_default: true },
  });
  return template?.config || DEFAULT_ENDURANCE_MER_TEMPLATE_CONFIG;
}

function round2(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

const MAX_CLUB_CODE_LEN = 50;
const MAX_CLUB_NAME_LEN = 255;
const MAX_CREW_NAME_LEN = 255;
const MAX_EPREUVE_CODE_LEN = 100;
const MAX_CLUB_CODES_MIXED_LEN = 255;

function truncateStr(v, maxLen) {
  if (v == null) return null;
  const s = String(v);
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen);
}

async function insertRow(payload) {
  await EnduranceMerImportResult.create({
    id: uuidv4(),
    event_id: payload.eventId,
    epreuve_code: truncateStr(payload.sheetName, MAX_EPREUVE_CODE_LEN),
    epreuve_libelle: null,
    place: payload.place,
    club_code:
      payload.clubCode != null && String(payload.clubCode).trim() !== ""
        ? truncateStr(String(payload.clubCode).trim(), MAX_CLUB_CODE_LEN)
        : null,
    club_name: truncateStr(payload.clubName, MAX_CLUB_NAME_LEN) || null,
    crew_name: truncateStr(payload.crewName, MAX_CREW_NAME_LEN) || null,
    time_raw: null,
    time_seconds: null,
    is_mixed_clubs: !!payload.isMixedClubs,
    club_codes_mixed: truncateStr(
      payload.clubCodesMixed,
      MAX_CLUB_CODES_MIXED_LEN,
    ),
    points_attributed: payload.points,
    event_format: payload.eventFormat,
    event_level: payload.eventLevel,
    partants_count: payload.partantsCount,
    import_batch_id: payload.importBatchId,
  });
}

async function importEnduranceMerExcel(eventId, fileBuffer, options = {}) {
  const {
    event_format: inputFormat = "enduro",
    event_level: eventLevel = "territorial",
    replace_previous: replacePrevious = false,
  } = options;
  const eventFormat = String(inputFormat || "enduro").toLowerCase();
  const errors = [];
  let inserted = 0;
  const epreuves = [];

  const event = await Event.findByPk(eventId);
  if (!event) throw new Error("Evenement introuvable");

  let workbook;
  try {
    workbook = XLSX.read(fileBuffer, { type: "buffer" });
  } catch (e) {
    throw new Error(
      "Fichier Excel invalide : " + (e.message || "erreur de lecture"),
    );
  }

  const sheetNames = (workbook.SheetNames || []).filter(
    (n) => n !== SHEET_ORGANISATEUR,
  );
  if (sheetNames.length === 0)
    throw new Error("Aucune feuille d'epreuve trouvee dans le fichier");

  if (replacePrevious)
    await EnduranceMerImportResult.destroy({ where: { event_id: eventId } });

  const scoringConfig = await getEnduranceMerScoringConfig();
  const importBatchId = uuidv4();

  for (const sheetName of sheetNames) {
    const rows = getSheetRows(workbook, sheetName);
    if (rows.length < DATA_START_ROW_SIMPLE + 1) continue;

    const u17 = isU17Sheet(sheetName);
    const dataRows = u17 ? getDataRowsU17(rows) : getDataRowsSimple(rows);
    const partantsCount = dataRows.length;
    if (partantsCount === 0) continue;

    epreuves.push(sheetName);

    dataRows.sort((a, b) => a.place - b.place);
    const clubsCrewCount = Object.create(null);

    for (const row of dataRows) {
      try {
        if (row.inline_mixed) {
          await insertRow({
            eventId,
            sheetName,
            place: row.place,
            clubCode: "MIXTE",
            clubName: row.club_name || row.inline_mixed_sheet_label,
            crewName: null,
            isMixedClubs: true,
            clubCodesMixed: row.inline_mixed_raw,
            points: 0,
            eventFormat,
            eventLevel,
            partantsCount,
            importBatchId,
          });
          inserted++;
          continue;
        }

        const basePoints = calculatePointsFromConfig({
          config: scoringConfig,
          eventFormat,
          eventLevel,
          epreuveCode: sheetName,
          place: row.place,
          partantsCount,
        });

        if (eventFormat === "enduro" && row.is_mixed) {
          const code1 = row.club_code;
          const code2 = row.club_code_2;
          const name1 = row.club_name;
          const name2 = row.club_name_2;
          const mixedCodes = [code1, code2].filter(Boolean).join(",");

          const isTwoClubs = !!(
            code1 &&
            code2 &&
            String(code1).toUpperCase() !== "MIXTE"
          );
          if (!u17 || !isTwoClubs || basePoints == null) {
            await insertRow({
              eventId,
              sheetName,
              place: row.place,
              clubCode: code1,
              clubName: name1,
              isMixedClubs: true,
              clubCodesMixed: mixedCodes,
              points: 0,
              eventFormat,
              eventLevel,
              partantsCount,
              importBatchId,
            });
            inserted++;
            continue;
          }

          const n1 = row.nb_club1;
          const n2 = row.nb_club2;
          const total = (n1 || 0) + (n2 || 0);
          const r1 = total > 0 ? n1 / total : 0.5;
          const r2 = total > 0 ? n2 / total : 0.5;

          const next1 = (clubsCrewCount[code1] || 0) + 1;
          const next2 = (clubsCrewCount[code2] || 0) + 1;
          clubsCrewCount[code1] = next1;
          clubsCrewCount[code2] = next2;

          const p1 =
            next1 <= 2 ? round2(Number(basePoints) * r1) : 0;
          const p2 =
            next2 <= 2 ? round2(Number(basePoints) * r2) : 0;

          await insertRow({
            eventId,
            sheetName,
            place: row.place,
            clubCode: code1,
            clubName: name1,
            isMixedClubs: true,
            clubCodesMixed: mixedCodes,
            points: p1,
            eventFormat,
            eventLevel,
            partantsCount,
            importBatchId,
          });
          await insertRow({
            eventId,
            sheetName,
            place: row.place,
            clubCode: code2,
            clubName: name2,
            isMixedClubs: true,
            clubCodesMixed: mixedCodes,
            points: p2,
            eventFormat,
            eventLevel,
            partantsCount,
            importBatchId,
          });
          inserted += 2;
          continue;
        }

        const clubKey =
          (row.club_code && String(row.club_code).trim()) ||
          (row.club_name && String(row.club_name).trim()) ||
          null;
        let finalPoints = basePoints;
        if (clubKey) {
          const next = (clubsCrewCount[clubKey] || 0) + 1;
          clubsCrewCount[clubKey] = next;
          if (basePoints != null) {
            finalPoints = next <= 2 ? basePoints : 0;
          }
        }

        await insertRow({
          eventId,
          sheetName,
          place: row.place,
          clubCode: row.club_code,
          clubName: row.club_name,
          isMixedClubs: !!row.is_mixed,
          clubCodesMixed: row.is_mixed
            ? [row.club_code, row.club_code_2].filter(Boolean).join(",")
            : null,
          points: finalPoints,
          eventFormat,
          eventLevel,
          partantsCount,
          importBatchId,
        });
        inserted++;
      } catch (e) {
        const sqlMsg =
          e.original?.sqlMessage ||
          e.parent?.sqlMessage ||
          e.sqlMessage ||
          null;
        const msg = sqlMsg || e.message || String(e);
        errors.push(`Feuille ${sheetName} place ${row.place}: ${msg}`);
      }
    }
  }

  return { inserted, epreuves, errors };
}

function isInlineMixedCrewRow(r) {
  if (!r?.is_mixed_clubs) return false;
  const code = r.club_code != null ? String(r.club_code).trim().toUpperCase() : "";
  return code === "MIXTE" || code === "0" || code === "";
}

function aggregateEventRows(rows) {
  const perClubEpreuve = new Map();
  for (const r of rows) {
    const ptsAgg = Number(r.points_attributed) || 0;
    if (isInlineMixedCrewRow(r) && ptsAgg <= 0) continue;

    const clubKey = r.club_code || r.club_name || "?";
    const epreuveKey = `${clubKey}|${r.epreuve_code}`;
    if (!perClubEpreuve.has(epreuveKey)) {
      perClubEpreuve.set(epreuveKey, {
        club_key: clubKey,
        club_code: r.club_code,
        club_name: r.club_name,
        epreuve_code: r.epreuve_code,
        event_format: String(r.event_format || "enduro").toLowerCase(),
        points: [],
        juniors: [],
        seniors: [],
      });
    }
    const pts = Number(r.points_attributed) || 0;
    if (pts <= 0) continue;
    const b = perClubEpreuve.get(epreuveKey);
    b.points.push(pts);
    if (b.event_format === "brs") {
      const grp = inferBRSGroup(r.epreuve_code);
      if (grp === "junior") b.juniors.push(pts);
      else b.seniors.push(pts);
    }
  }

  const byClub = new Map();
  for (const [, b] of perClubEpreuve) {
    let epreuveTotal = 0;
    if (b.event_format === "brs") {
      const j = b.juniors
        .sort((a, c) => c - a)
        .slice(0, 2)
        .reduce((s, p) => s + p, 0);
      const s = b.seniors
        .sort((a, c) => c - a)
        .slice(0, 2)
        .reduce((s1, p) => s1 + p, 0);
      epreuveTotal = j + s;
    } else {
      epreuveTotal = b.points
        .sort((a, c) => c - a)
        .slice(0, 2)
        .reduce((s, p) => s + p, 0);
    }

    if (!byClub.has(b.club_key)) {
      byClub.set(b.club_key, {
        club_code: b.club_code,
        club_name: b.club_name,
        event_format: b.event_format,
        epreuves_juniors: [],
        epreuves_seniors: [],
        epreuves_all: [],
      });
    }

    const club = byClub.get(b.club_key);
    if (b.event_format === "brs") {
      const grp = inferBRSGroup(b.epreuve_code);
      if (grp === "junior") club.epreuves_juniors.push(epreuveTotal);
      else club.epreuves_seniors.push(epreuveTotal);
    }
    club.epreuves_all.push(epreuveTotal);
  }

  const result = new Map();
  for (const [k, c] of byClub) {
    let total = 0;
    if (c.event_format === "brs") {
      const topJ = c.epreuves_juniors
        .sort((a, b) => b - a)
        .slice(0, 2)
        .reduce((s, p) => s + p, 0);
      const topS = c.epreuves_seniors
        .sort((a, b) => b - a)
        .slice(0, 2)
        .reduce((s, p) => s + p, 0);
      total = topJ + topS;
    } else {
      total = c.epreuves_all.reduce((s, p) => s + p, 0);
    }
    result.set(k, {
      club_code: c.club_code,
      club_name: c.club_name,
      event_format: c.event_format,
      total: round2(total),
    });
  }
  return result;
}

async function getEnduranceMerRankingForEvent(eventId) {
  const rows = await EnduranceMerImportResult.findAll({
    where: { event_id: eventId },
    order: [
      ["epreuve_code", "ASC"],
      ["place", "ASC"],
    ],
  });
  const agg = aggregateEventRows(rows);
  return Array.from(agg.values())
    .sort((a, b) => b.total - a.total)
    .map((r, i) => ({
      club_code: r.club_code,
      club_name: r.club_name,
      total_points: r.total,
      rank: i + 1,
    }));
}

function getIncludedEventFromImportRow(row) {
  if (!row) return null;
  if (row.Event) return row.Event;
  if (row.dataValues?.Event) return row.dataValues.Event;
  return null;
}

function newMerClubSeasonAccumulator(clubCode, clubName) {
  return {
    club_code: clubCode,
    club_name: clubName,
    enduro_territorial_events: [],
    brs_territorial_events: [],
    championnats_france_enduro_events: [],
    championnats_france_brs_events: [],
    territorial_bonus: 0,
  };
}

/**
 * Agrège les totaux par club et par compétition (saison mer) à partir des lignes importées.
 */
async function accumulateMerSeasonPerClubFromImportRows(
  rows,
  { season, includeTerritorialBonus },
) {
  const byEvent = new Map();
  for (const r of rows) {
    if (!byEvent.has(r.event_id)) byEvent.set(r.event_id, []);
    byEvent.get(r.event_id).push(r);
  }

  const perClub = new Map();
  for (const [eventId, eventRows] of byEvent) {
    const sample = eventRows[0];
    const level = String(sample.event_level || "territorial").toLowerCase();
    const format = String(sample.event_format || "enduro").toLowerCase();
    const ev = getIncludedEventFromImportRow(sample);
    const eventMeta = {
      event_id: eventId,
      event_name: ev?.name || null,
      start_date: ev?.start_date || null,
    };

    const agg = aggregateEventRows(eventRows);
    for (const [clubKey, d] of agg) {
      if (!perClub.has(clubKey)) {
        perClub.set(
          clubKey,
          newMerClubSeasonAccumulator(d.club_code, d.club_name),
        );
      }
      const c = perClub.get(clubKey);
      const pts = round2(Number(d.total) || 0);
      const entry = { ...eventMeta, points: pts };
      if (level === "championnat_france") {
        if (format === "brs") c.championnats_france_brs_events.push(entry);
        else c.championnats_france_enduro_events.push(entry);
      } else if (format === "brs") c.brs_territorial_events.push(entry);
      else c.enduro_territorial_events.push(entry);
    }
  }

  if (includeTerritorialBonus) {
    const bonuses = await EnduranceMerTerritorialBonus.findAll({
      where: { season: String(season), is_active: true },
    });
    for (const b of bonuses) {
      const clubKey = b.club_code || b.club_name;
      if (!perClub.has(clubKey)) {
        perClub.set(
          clubKey,
          newMerClubSeasonAccumulator(b.club_code, b.club_name),
        );
      }
      const c = perClub.get(clubKey);
      c.territorial_bonus = round2(
        Number(c.territorial_bonus || 0) + Number(b.points || 67.5),
      );
    }
  }

  return { perClub, byEvent };
}

function finalizeMerGlobalRankingRows(perClub) {
  const ranking = [];
  for (const [, c] of perClub) {
    const enduroSorted = [...c.enduro_territorial_events].sort(
      (a, b) => b.points - a.points,
    );
    const enduroTop4 = enduroSorted.slice(0, 4);
    const enduroTop4Sum = enduroTop4.reduce((s, x) => s + x.points, 0);

    const brsSorted = [...c.brs_territorial_events].sort(
      (a, b) => b.points - a.points,
    );
    const brsTop1 = brsSorted.slice(0, 1);
    const brsTop1Sum = brsTop1.reduce((s, x) => s + x.points, 0);

    const cfEnduroSum = c.championnats_france_enduro_events.reduce(
      (s, x) => s + x.points,
      0,
    );
    const cfBrsSum = c.championnats_france_brs_events.reduce(
      (s, x) => s + x.points,
      0,
    );
    const cfAll = cfEnduroSum + cfBrsSum;

    const total = round2(
      enduroTop4Sum + brsTop1Sum + cfAll + c.territorial_bonus,
    );

    const contributions = [
      ...enduroTop4.map((x, i) => ({
        kind: "enduro_territorial",
        rule: "top_4_meilleures_competitions",
        selection_rank: i + 1,
        event_id: x.event_id,
        event_name: x.event_name,
        start_date: x.start_date,
        points: x.points,
      })),
      ...brsTop1.map((x, i) => ({
        kind: "brs_territorial",
        rule: "top_1_meilleure_competition",
        selection_rank: i + 1,
        event_id: x.event_id,
        event_name: x.event_name,
        start_date: x.start_date,
        points: x.points,
      })),
      ...c.championnats_france_enduro_events.map((x) => ({
        kind: "championnat_france_enduro",
        rule: "somme_tous_cf_enduro",
        event_id: x.event_id,
        event_name: x.event_name,
        start_date: x.start_date,
        points: x.points,
      })),
      ...c.championnats_france_brs_events.map((x) => ({
        kind: "championnat_france_brs",
        rule: "somme_tous_cf_brs",
        event_id: x.event_id,
        event_name: x.event_name,
        start_date: x.start_date,
        points: x.points,
      })),
    ];
    if (Number(c.territorial_bonus) > 0) {
      contributions.push({
        kind: "territorial_bonus",
        rule: "bonus_saison_bdd",
        points: round2(c.territorial_bonus),
      });
    }

    ranking.push({
      club_code: c.club_code,
      club_name: c.club_name,
      total_points: total,
      breakdown: {
        enduro_top4: round2(enduroTop4Sum),
        brs_top1: round2(brsTop1Sum),
        championnat_france_enduro: round2(cfEnduroSum),
        championnat_france_brs: round2(cfBrsSum),
        championnat_france: round2(cfAll),
        territorial_bonus: round2(c.territorial_bonus),
      },
      contributions,
      /** Toutes les manches territoriales (hors sélection top4/top1), pour audit */
      other_enduro_territorial: enduroSorted.slice(4).map((x) => ({ ...x })),
      other_brs_territorial: brsSorted.slice(1).map((x) => ({ ...x })),
    });
  }

  return ranking
    .sort((a, b) => b.total_points - a.total_points)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

async function fetchMerImportRowsForSeason(season) {
  const start = new Date(`${season}-01-01T00:00:00.000Z`);
  const end = new Date(`${Number(season) + 1}-01-01T00:00:00.000Z`);
  return EnduranceMerImportResult.findAll({
    include: [
      {
        model: Event,
        required: true,
        where: { start_date: { [Op.gte]: start, [Op.lt]: end } },
        attributes: [
          "id",
          "name",
          "location",
          "start_date",
          "end_date",
          "race_type",
        ],
      },
    ],
    order: [
      ["event_id", "ASC"],
      ["epreuve_code", "ASC"],
      ["place", "ASC"],
    ],
  });
}

async function getGlobalMerRanking({
  season = "2026",
  includeTerritorialBonus = true,
}) {
  const rows = await fetchMerImportRowsForSeason(season);
  const { perClub } = await accumulateMerSeasonPerClubFromImportRows(rows, {
    season,
    includeTerritorialBonus,
  });
  return finalizeMerGlobalRankingRows(perClub);
}

/**
 * Dashboard mer : classement par compétition + global avec contributions détaillées.
 */
async function getMerClubsDashboard({
  season = "2026",
  includeTerritorialBonus = true,
}) {
  const rows = await fetchMerImportRowsForSeason(season);
  const { perClub, byEvent } = await accumulateMerSeasonPerClubFromImportRows(
    rows,
    { season, includeTerritorialBonus },
  );

  const eventIds = Array.from(byEvent.keys());
  const eventsOrdered =
    eventIds.length === 0
      ? []
      : await Event.findAll({
          where: { id: { [Op.in]: eventIds } },
          attributes: [
            "id",
            "name",
            "location",
            "start_date",
            "end_date",
            "race_type",
          ],
          order: [["start_date", "ASC"]],
        });

  const byEventPayload = [];
  for (const ev of eventsOrdered) {
    const rankings = await getEnduranceMerRankingForEvent(ev.id);
    byEventPayload.push({
      event: {
        id: ev.id,
        name: ev.name,
        location: ev.location,
        start_date: ev.start_date,
        end_date: ev.end_date,
        race_type: ev.race_type,
      },
      rankings,
    });
  }

  return {
    type: "mer",
    season: String(season),
    rules_summary: {
      enduro_territorial:
        "Somme des points des 4 meilleures compétitions ENDURO de niveau territorial (import).",
      brs_territorial:
        "Points de la meilleure compétition BRS territoriale (import).",
      championnat_france_enduro:
        "Somme des points de toutes les compétitions Championnat de France au format ENDURO (import).",
      championnat_france_brs:
        "Somme des points de toutes les compétitions Championnat de France au format BRS (import).",
      territorial_bonus:
        "Bonus territorial mer actifs en base pour la saison (`endurance_mer_territorial_bonus`).",
    },
    byEvent: byEventPayload,
    global: {
      rankings: finalizeMerGlobalRankingRows(perClub),
    },
  };
}

module.exports = {
  importEnduranceMerExcel,
  getEnduranceMerRankingForEvent,
  getGlobalMerRanking,
  getMerClubsDashboard,
};
