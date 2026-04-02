const XLSX = require("xlsx");
const { v4: uuidv4 } = require("uuid");
const { Op } = require("sequelize");
const EnduranceMerImportResult = require("../models/EnduranceMerImportResult");
const EnduranceMerTerritorialBonus = require("../models/EnduranceMerTerritorialBonus");
const Event = require("../models/Event");
const ScoringTemplate = require("../models/ScoringTemplate");
const { DEFAULT_ENDURANCE_MER_TEMPLATE_CONFIG, calculatePointsFromConfig, inferBRSGroup } = require("../constants/enduranceMerBaremes");

const SHEET_ORGANISATEUR = "Organisateur";
const DATA_START_ROW_SIMPLE = 5;
const DATA_START_ROW_U17 = 6;
const U17_SHEETS = new Set(["U17F4X+", "U17H4X+", "U17M4X+", "U17F4X", "U17H4X", "U17M4X"]);

function isU17Sheet(sheetName) {
  const n = String(sheetName || "").toUpperCase();
  return U17_SHEETS.has(n) || n.startsWith("U17");
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

function getDataRowsSimple(rows) {
  const out = [];
  for (let i = DATA_START_ROW_SIMPLE; i < rows.length; i++) {
    const row = rows[i];
    if (!isDataRow(row)) continue;
    const place = parseInt(row[0], 10);
    const clubCode = row[1] != null ? String(row[1]).trim() : null;
    const clubName = row[2] != null ? String(row[2]).trim() : null;
    if (Number.isNaN(place)) continue;
    out.push({ place, club_code: clubCode || null, club_name: clubName || null, is_mixed: false, club_code_2: null, club_name_2: null, nb_club1: null, nb_club2: null });
  }
  return out;
}

function getDataRowsU17(rows) {
  const out = [];
  for (let i = DATA_START_ROW_U17; i < rows.length; i++) {
    const row = rows[i];
    if (!isDataRow(row)) continue;
    const place = parseInt(row[0], 10);
    const clubCode = row[1] != null ? String(row[1]).trim() : null;
    const clubName = row[2] != null ? String(row[2]).trim() : null;
    const clubCode2 = row[3] != null ? String(row[3]).trim() : null;
    const clubName2 = row[4] != null ? String(row[4]).trim() : null;
    const nb1 = row[5] != null ? parseInt(row[5], 10) : null;
    const nb2 = row[6] != null ? parseInt(row[6], 10) : null;
    if (Number.isNaN(place)) continue;
    const isMixte = (clubCode && String(clubCode).toUpperCase() === "MIXTE") || (clubCode2 && String(clubCode2).trim() !== "");
    out.push({ place, club_code: clubCode || null, club_name: clubName || null, is_mixed: isMixte, club_code_2: clubCode2 || null, club_name_2: clubName2 || null, nb_club1: Number.isNaN(nb1) ? null : nb1, nb_club2: Number.isNaN(nb2) ? null : nb2 });
  }
  return out;
}

async function getEnduranceMerScoringConfig() {
  const template = await ScoringTemplate.findOne({ where: { type: "endurance_mer", is_default: true } });
  return template?.config || DEFAULT_ENDURANCE_MER_TEMPLATE_CONFIG;
}

function round2(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

async function insertRow(payload) {
  await EnduranceMerImportResult.create({
    id: uuidv4(),
    event_id: payload.eventId,
    epreuve_code: payload.sheetName,
    epreuve_libelle: null,
    place: payload.place,
    club_code: payload.clubCode || null,
    club_name: payload.clubName || null,
    crew_name: null,
    time_raw: null,
    time_seconds: null,
    is_mixed_clubs: !!payload.isMixedClubs,
    club_codes_mixed: payload.clubCodesMixed || null,
    points_attributed: payload.points,
    event_format: payload.eventFormat,
    event_level: payload.eventLevel,
    partants_count: payload.partantsCount,
    import_batch_id: payload.importBatchId,
  });
}

async function importEnduranceMerExcel(eventId, fileBuffer, options = {}) {
  const { event_format: inputFormat = "enduro", event_level: eventLevel = "territorial", replace_previous: replacePrevious = false } = options;
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
    throw new Error("Fichier Excel invalide : " + (e.message || "erreur de lecture"));
  }

  const sheetNames = (workbook.SheetNames || []).filter((n) => n !== SHEET_ORGANISATEUR);
  if (sheetNames.length === 0) throw new Error("Aucune feuille d'epreuve trouvee dans le fichier");

  if (replacePrevious) await EnduranceMerImportResult.destroy({ where: { event_id: eventId } });

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

    for (const row of dataRows) {
      const basePoints = calculatePointsFromConfig({
        config: scoringConfig,
        eventFormat,
        eventLevel,
        epreuveCode: sheetName,
        place: row.place,
        partantsCount,
      });

      try {
        if (eventFormat === "enduro" && row.is_mixed) {
          const code1 = row.club_code;
          const code2 = row.club_code_2;
          const name1 = row.club_name;
          const name2 = row.club_name_2;
          const mixedCodes = [code1, code2].filter(Boolean).join(",");

          const isTwoClubs = !!(code1 && code2 && String(code1).toUpperCase() !== "MIXTE");
          if (!u17 || !isTwoClubs || basePoints == null) {
            await insertRow({ eventId, sheetName, place: row.place, clubCode: code1, clubName: name1, isMixedClubs: true, clubCodesMixed: mixedCodes, points: 0, eventFormat, eventLevel, partantsCount, importBatchId });
            inserted++;
            continue;
          }

          const n1 = row.nb_club1;
          const n2 = row.nb_club2;
          const total = (n1 || 0) + (n2 || 0);
          const r1 = total > 0 ? n1 / total : 0.5;
          const r2 = total > 0 ? n2 / total : 0.5;
          await insertRow({ eventId, sheetName, place: row.place, clubCode: code1, clubName: name1, isMixedClubs: true, clubCodesMixed: mixedCodes, points: round2(basePoints * r1), eventFormat, eventLevel, partantsCount, importBatchId });
          await insertRow({ eventId, sheetName, place: row.place, clubCode: code2, clubName: name2, isMixedClubs: true, clubCodesMixed: mixedCodes, points: round2(basePoints * r2), eventFormat, eventLevel, partantsCount, importBatchId });
          inserted += 2;
          continue;
        }

        await insertRow({
          eventId,
          sheetName,
          place: row.place,
          clubCode: row.club_code,
          clubName: row.club_name,
          isMixedClubs: !!row.is_mixed,
          clubCodesMixed: row.is_mixed ? [row.club_code, row.club_code_2].filter(Boolean).join(",") : null,
          points: basePoints,
          eventFormat,
          eventLevel,
          partantsCount,
          importBatchId,
        });
        inserted++;
      } catch (e) {
        errors.push(`Feuille ${sheetName} place ${row.place}: ${e.message}`);
      }
    }
  }

  return { inserted, epreuves, errors };
}

function aggregateEventRows(rows) {
  const perClubEpreuve = new Map();
  for (const r of rows) {
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
      const j = b.juniors.sort((a, c) => c - a).slice(0, 2).reduce((s, p) => s + p, 0);
      const s = b.seniors.sort((a, c) => c - a).slice(0, 2).reduce((s1, p) => s1 + p, 0);
      epreuveTotal = j + s;
    } else {
      epreuveTotal = b.points.sort((a, c) => c - a).slice(0, 2).reduce((s, p) => s + p, 0);
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
      const topJ = c.epreuves_juniors.sort((a, b) => b - a).slice(0, 2).reduce((s, p) => s + p, 0);
      const topS = c.epreuves_seniors.sort((a, b) => b - a).slice(0, 2).reduce((s, p) => s + p, 0);
      total = topJ + topS;
    } else {
      total = c.epreuves_all.reduce((s, p) => s + p, 0);
    }
    result.set(k, { club_code: c.club_code, club_name: c.club_name, event_format: c.event_format, total: round2(total) });
  }
  return result;
}

async function getEnduranceMerRankingForEvent(eventId) {
  const rows = await EnduranceMerImportResult.findAll({ where: { event_id: eventId }, order: [["epreuve_code", "ASC"], ["place", "ASC"]] });
  const agg = aggregateEventRows(rows);
  return Array.from(agg.values())
    .sort((a, b) => b.total - a.total)
    .map((r, i) => ({ club_code: r.club_code, club_name: r.club_name, total_points: r.total, rank: i + 1 }));
}

async function getGlobalMerRanking({ season = "2026", includeTerritorialBonus = true }) {
  const start = new Date(`${season}-01-01T00:00:00.000Z`);
  const end = new Date(`${Number(season) + 1}-01-01T00:00:00.000Z`);

  const rows = await EnduranceMerImportResult.findAll({
    include: [{ model: Event, required: true, where: { start_date: { [Op.gte]: start, [Op.lt]: end } } }],
    order: [["event_id", "ASC"], ["epreuve_code", "ASC"], ["place", "ASC"]],
  });

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

    const agg = aggregateEventRows(eventRows);
    for (const [clubKey, d] of agg) {
      if (!perClub.has(clubKey)) {
        perClub.set(clubKey, {
          club_code: d.club_code,
          club_name: d.club_name,
          enduro_territorial_events: [],
          brs_territorial_events: [],
          championnats_france_events: [],
          territorial_bonus: 0,
        });
      }
      const c = perClub.get(clubKey);
      if (level === "championnat_france") c.championnats_france_events.push(d.total);
      else if (format === "brs") c.brs_territorial_events.push(d.total);
      else c.enduro_territorial_events.push(d.total);
    }
  }

  if (includeTerritorialBonus) {
    const bonuses = await EnduranceMerTerritorialBonus.findAll({ where: { season: String(season), is_active: true } });
    for (const b of bonuses) {
      const clubKey = b.club_code || b.club_name;
      if (!perClub.has(clubKey)) {
        perClub.set(clubKey, {
          club_code: b.club_code,
          club_name: b.club_name,
          enduro_territorial_events: [],
          brs_territorial_events: [],
          championnats_france_events: [],
          territorial_bonus: 0,
        });
      }
      perClub.get(clubKey).territorial_bonus = round2(Number(perClub.get(clubKey).territorial_bonus || 0) + Number(b.points || 67.5));
    }
  }

  const ranking = [];
  for (const [, c] of perClub) {
    const enduroTop4 = c.enduro_territorial_events.sort((a, b) => b - a).slice(0, 4).reduce((s, p) => s + p, 0);
    const brsTop1 = c.brs_territorial_events.sort((a, b) => b - a).slice(0, 1).reduce((s, p) => s + p, 0);
    const cfAll = c.championnats_france_events.reduce((s, p) => s + p, 0);
    const total = round2(enduroTop4 + brsTop1 + cfAll + c.territorial_bonus);
    ranking.push({
      club_code: c.club_code,
      club_name: c.club_name,
      total_points: total,
      breakdown: {
        enduro_top4: round2(enduroTop4),
        brs_top1: round2(brsTop1),
        championnat_france: round2(cfAll),
        territorial_bonus: round2(c.territorial_bonus),
      },
    });
  }

  return ranking.sort((a, b) => b.total_points - a.total_points).map((r, i) => ({ ...r, rank: i + 1 }));
}

module.exports = {
  importEnduranceMerExcel,
  getEnduranceMerRankingForEvent,
  getGlobalMerRanking,
};