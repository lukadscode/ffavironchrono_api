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
  normalizeCode,
} = require("../constants/enduranceMerBaremes");
const {
  resolveClubCode,
  loadClubLookupMaps,
  applyOfficialClubNames,
} = require("../utils/clubCodeUtils");

const SHEET_ORGANISATEUR = "Organisateur";
const DATA_START_ROW_SIMPLE = 5;
/** Même offset que les feuilles « simples » : en-têtes (3), ligne Ex. (4), données (5). */
const DATA_START_ROW_U17 = 5;
const U17_SHEETS = new Set([
  "U17F4X+",
  "U17H4X+",
  "U17M4X+",
  "U17F4X",
  "U17H4X",
  "U17M4X",
]);

function isU17Sheet(sheetName) {
  const n = String(sheetName || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toUpperCase();
  return U17_SHEETS.has(n) || n.startsWith("U17");
}

/** Nom de feuille stocké en `epreuve_code` (BOM / espaces retirés pour matcher le front et les barèmes). */
function normalizeMerSheetLabel(sheetName) {
  return String(sheetName || "").replace(/^\uFEFF/, "").trim();
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

/**
 * Certains fichiers FF ont un !ref gonflé (ex. A1:AMJ235 ou A1:Z1000)
 * sans données réelles → sheet_to_json alloue des centaines de milliers de cellules.
 * On recadre sur le contenu réellement non vide (plafonné).
 */
function clampSheetUsedRange(sheet, maxCol = 16, maxRow = 300) {
  if (!sheet || !sheet["!ref"]) return sheet;
  try {
    let maxC = 0;
    let maxR = 0;
    let has = false;
    for (const addr of Object.keys(sheet)) {
      if (addr[0] === "!") continue;
      const cell = sheet[addr];
      if (cell == null || cell.v == null || cell.v === "") continue;
      const m = XLSX.utils.decode_cell(addr);
      has = true;
      if (m.c > maxC) maxC = m.c;
      if (m.r > maxR) maxR = m.r;
    }
    if (has) {
      sheet["!ref"] = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: {
          r: Math.min(maxR, maxRow),
          c: Math.min(Math.max(maxC, 3), maxCol),
        },
      });
      return sheet;
    }
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    if (range.e.c > maxCol) range.e.c = maxCol;
    if (range.e.r > maxRow) range.e.r = maxRow;
    sheet["!ref"] = XLSX.utils.encode_range(range);
  } catch (_) {
    /* ignore */
  }
  return sheet;
}

function cleanWorkbookInflatedRanges(workbook) {
  let trimmed = 0;
  for (const name of workbook.SheetNames || []) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const before = sheet["!ref"];
    clampSheetUsedRange(sheet);
    if (before !== sheet["!ref"]) trimmed += 1;
  }
  return trimmed;
}

function getSheetRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  clampSheetUsedRange(sheet);
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
 * Retourne { raw, parts: [{ code, count }] } si parseable.
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
  const parts = [];
  for (const seg of segments) {
    const m = seg.match(partRe);
    if (!m) return null;
    parts.push({
      code: String(m[1]).toUpperCase(),
      count: parseInt(m[2], 10),
    });
  }
  return { raw: normalized, parts };
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
    return { raw: normalizeInlineMixedSlashes(raw).trim(), parts: null };
  return null;
}

function detectInlineMixedFromRow(clubCode, clubName) {
  return parseInlineMixedCrewCell(clubCode) || parseInlineMixedCrewCell(clubName);
}

function isChampionnatFrance(eventLevel) {
  return String(eventLevel || "").toLowerCase() === "championnat_france";
}

/**
 * Nom de fichier type « BRS 2026 CHAMP DE FRANCE.xlsx » → options d'import.
 * Évite les mixtes à 0 pt quand l'UI reste sur Enduro / Territorial.
 */
function inferMerImportOptionsFromFileName(fileName) {
  const n = String(fileName || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  const format = /\bbrs\b/.test(n) ? "brs" : /enduro/.test(n) ? "enduro" : null;
  const level = /champ(?:ionnat)?|\bcdf\b/.test(n)
    ? "championnat_france"
    : null;
  return { format, level };
}

function applyInferredMerImportOptions(options = {}) {
  const inferred = inferMerImportOptionsFromFileName(
    options.original_filename || options.filename || ""
  );
  const next = { ...options };
  if (inferred.format) next.event_format = inferred.format;
  if (inferred.level) next.event_level = inferred.level;
  return { options: next, inferred };
}

/**
 * Regroupe les segments inline par club (ex. C078018(1)/C078018(1)/C094005(1)/C078018(1)
 * → [{ code: C078018, count: 3 }, { code: C094005, count: 1 }]).
 */
function groupInlineMixedPartsByClub(parts) {
  if (!Array.isArray(parts) || parts.length < 2) return [];
  const map = new Map();
  for (const p of parts) {
    const code = String(p?.code || "").trim().toUpperCase();
    const count = Number(p?.count) || 0;
    if (!code || code === "MIXTE" || count <= 0) continue;
    const prev = map.get(code) || { code, count: 0 };
    prev.count += count;
    map.set(code, prev);
  }
  return [...map.values()];
}

/** Ancienne règle : U17, 2 clubs, effectifs égaux (50/50). */
function canScoreLegacyU17FiftyFifty(u17, grouped) {
  if (!u17 || !Array.isArray(grouped) || grouped.length !== 2) return false;
  const n1 = Number(grouped[0].count);
  const n2 = Number(grouped[1].count);
  return n1 > 0 && n1 === n2;
}

/**
 * Points mixtes :
 * - 1 club (notation C###### (n) / C###### (n)) → 100 %
 * - Championnat de France (barème CF, Enduro ou BRS) → prorata, toutes catégories
 * - sinon U17 50/50 uniquement
 */
function canScoreMixedClubShares(eventFormat, eventLevel, u17, grouped) {
  if (!Array.isArray(grouped) || grouped.length === 0) return false;
  if (!grouped.every((g) => g.code && Number(g.count) > 0)) return false;
  if (grouped.length === 1) return true;
  if (isChampionnatFrance(eventLevel)) return true;
  return canScoreLegacyU17FiftyFifty(u17, grouped);
}

async function insertMixedClubShareRows({
  grouped,
  mixedCodes,
  basePoints,
  eventFormat,
  eventLevel,
  resolveCode,
  clubsCrewCount,
  eventId,
  sheetName,
  epreuveLibelle,
  place,
  partantsCount,
  importBatchId,
}) {
  const totalCount = grouped.reduce((s, g) => s + Number(g.count), 0);
  if (totalCount <= 0 || basePoints == null) return 0;
  const applyCap =
    String(eventLevel || "").toLowerCase() !== "championnat_france";
  let inserted = 0;
  for (const g of grouped) {
    const resolved = await resolveCode(g.code, null);
    const code = resolved.code;
    const pts = round2(Number(basePoints) * (Number(g.count) / totalCount));
    const next = (clubsCrewCount[code] || 0) + 1;
    clubsCrewCount[code] = next;
    const finalPts = applyCap && next > 2 ? 0 : pts;
    await insertRow({
      eventId,
      sheetName,
      epreuveLibelle,
      place,
      clubCode: code,
      clubName: resolved.name,
      isMixedClubs: true,
      clubCodesMixed: mixedCodes,
      points: finalPts,
      eventFormat,
      eventLevel,
      partantsCount,
      importBatchId,
    });
    inserted += 1;
  }
  return inserted;
}

function getDataRowsSimple(rows) {
  const out = [];
  for (let i = DATA_START_ROW_SIMPLE; i < rows.length; i++) {
    const row = rows[i];
    if (!isDataRow(row)) continue;
    const place = parseInt(row[0], 10);
    const clubCode = getCellString(row[1]);
    const clubName = getCellString(row[2]);
    const clubCode2 = getCellString(row[3]);
    const clubName2 = getCellString(row[4]);
    if (Number.isNaN(place)) continue;
    const inline = detectInlineMixedFromRow(clubCode, clubName);
    if (inline) {
      out.push({
        place,
        inline_mixed: true,
        inline_mixed_raw: inline.raw,
        inline_mixed_parts: inline.parts || null,
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
    if (!clubCode && !clubName) continue;
    // Feuilles type SM2X Beach : Code Club1 + Code Club2 sans être U17
    const isMixte =
      (clubCode && String(clubCode).toUpperCase() === "MIXTE") ||
      (clubCode2 && String(clubCode2).trim() !== "");
    out.push({
      place,
      club_code: clubCode || null,
      club_name: clubName || null,
      is_mixed: !!isMixte,
      club_code_2: clubCode2 || null,
      club_name_2: clubName2 || null,
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
    const inline = detectInlineMixedFromRow(clubCode, clubName);
    if (inline) {
      out.push({
        place,
        inline_mixed: true,
        inline_mixed_raw: inline.raw,
        inline_mixed_parts: inline.parts || null,
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
    if (!clubCode && !clubName) continue;
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
    epreuve_libelle: truncateStr(payload.epreuveLibelle, 255) || null,
    place: payload.place,
    club_code:
      payload.clubCode != null && String(payload.clubCode).trim() !== ""
        ? truncateStr(String(payload.clubCode).trim(), MAX_CLUB_CODE_LEN)
        : null,
    club_name: truncateStr(payload.clubName, MAX_CLUB_NAME_LEN) || null,
    crew_name: truncateStr(payload.crewName, MAX_CREW_NAME_LEN) || null,
    time_raw: truncateStr(payload.timeRaw, 50) || null,
    time_seconds: payload.timeSeconds ?? null,
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

/**
 * Codes épreuve export BASE (cdfadm) → code feuille Time Team / barème.
 * Ex. "SM4+ 50%H/F" → "SM4+", "SM2x AP 50%H/F" → "SM2X", "M40H1x" → "M40H1X"
 */
function normalizeBaseEpreuveCode(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  s = s.replace(/\s+AP\b/gi, "");
  s = s.replace(/\s*50%\s*H\s*\/\s*F.*$/i, "");
  s = s.replace(/\s+/g, "");
  return normalizeCode(s);
}

function findHeaderIndex(rows, names) {
  const targets = names.map((n) => String(n).toLowerCase());
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;
    const cells = row.map((c) => String(c ?? "").trim().toLowerCase());
    if (targets.every((t) => cells.some((c) => c === t || c.includes(t)))) {
      return i;
    }
  }
  return -1;
}

function colIndexByHeader(headerRow, candidates) {
  const cells = (headerRow || []).map((c) => String(c ?? "").trim().toLowerCase());
  for (const cand of candidates) {
    const idx = cells.findIndex((c) => c === cand || c.startsWith(cand));
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Parse un export « BASE » (une ligne = un équipage, colonnes event_code / result / position / club_ref).
 */
function parseBaseFlatRows(workbook) {
  const sheetName = (workbook.SheetNames || [])[0];
  if (!sheetName) return { rows: [], errors: ["Aucune feuille dans le fichier"] };

  const sheet = workbook.Sheets[sheetName];
  clampSheetUsedRange(sheet, 60);
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
  if (!aoa.length) return { rows: [], errors: ["Feuille vide"] };

  const headerIdx = findHeaderIndex(aoa, ["event_code", "position"]);
  const header = headerIdx >= 0 ? aoa[headerIdx] : aoa[0];
  const dataStart = headerIdx >= 0 ? headerIdx + 1 : 1;

  const idxEvent =
    colIndexByHeader(header, ["event_code"]) >= 0
      ? colIndexByHeader(header, ["event_code"])
      : 3;
  const idxEventName =
    colIndexByHeader(header, ["event_name"]) >= 0
      ? colIndexByHeader(header, ["event_name"])
      : 4;
  const idxResult =
    colIndexByHeader(header, ["result"]) >= 0
      ? colIndexByHeader(header, ["result"])
      : 6;
  const idxPosition =
    colIndexByHeader(header, ["position"]) >= 0
      ? colIndexByHeader(header, ["position"])
      : 7;
  const idxStatus =
    colIndexByHeader(header, ["status"]) >= 0
      ? colIndexByHeader(header, ["status"])
      : 8;
  const idxEntry =
    colIndexByHeader(header, ["entry_name"]) >= 0
      ? colIndexByHeader(header, ["entry_name"])
      : 1;
  const idxClub1 =
    colIndexByHeader(header, ["club_ref rower 1", "club_ref"]) >= 0
      ? colIndexByHeader(header, ["club_ref rower 1", "club_ref"])
      : 12;

  const clubColIndexes = (header || [])
    .map((h, i) => [i, String(h ?? "").trim().toLowerCase()])
    .filter(([, h]) => h.startsWith("club_ref"))
    .map(([i]) => i);
  if (clubColIndexes.length === 0 && idxClub1 >= 0) clubColIndexes.push(idxClub1);

  const out = [];
  const errors = [];

  for (let i = dataStart; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row || !Array.isArray(row)) continue;

    const eventRaw = getCellString(row[idxEvent]);
    if (!eventRaw) continue;

    const epreuveCode = normalizeBaseEpreuveCode(eventRaw);
    if (!epreuveCode) {
      errors.push(`Ligne ${i + 1}: code épreuve invalide (${eventRaw})`);
      continue;
    }

    const placeRaw = getCellString(row[idxPosition]);
    let place = placeRaw != null ? parseInt(placeRaw, 10) : NaN;
    // Si pas de position, on n'importe pas (DNS/DNF/exclu) — pas de points
    if (Number.isNaN(place) || place < 1) continue;

    const clubPrimary = getCellString(row[idxClub1]);
    const allClubs = clubColIndexes
      .map((ci) => getCellString(row[ci]))
      .filter(Boolean)
      .map((c) => String(c).trim().toUpperCase());
    const uniqueClubs = [...new Set(allClubs)];
    const isMixed = uniqueClubs.length > 1;

    if (!clubPrimary && uniqueClubs.length === 0) {
      errors.push(`Ligne ${i + 1} (${epreuveCode} #${place}): club manquant`);
      continue;
    }

    out.push({
      epreuve_code: epreuveCode,
      epreuve_libelle: getCellString(row[idxEventName]),
      place,
      club_code: clubPrimary || uniqueClubs[0] || null,
      club_name: getCellString(row[idxEntry]),
      crew_name: getCellString(row[idxEntry]),
      time_raw: getCellString(row[idxResult]),
      status: getCellString(row[idxStatus]),
      is_mixed: isMixed,
      club_codes_mixed: isMixed ? uniqueClubs.join(",") : null,
      mixed_parts: isMixed
        ? allClubs.map((code) => ({ code, count: 1 }))
        : null,
    });
  }

  return { rows: out, errors };
}

async function importEnduranceMerFlatExcel(eventId, fileBuffer, options = {}) {
  const {
    event_format: inputFormat = "enduro",
    event_level: eventLevel = "championnat_france",
    replace_previous: replacePrevious = false,
  } = options;
  const eventFormat = String(inputFormat || "enduro").toLowerCase();
  const errors = [];
  let inserted = 0;

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
  cleanWorkbookInflatedRanges(workbook);

  const parsed = parseBaseFlatRows(workbook);
  errors.push(...parsed.errors);
  if (parsed.rows.length === 0) {
    throw new Error(
      "Aucune ligne exploitable (colonnes event_code / position / club_ref attendues).",
    );
  }

  if (replacePrevious)
    await EnduranceMerImportResult.destroy({ where: { event_id: eventId } });

  const scoringConfig = await getEnduranceMerScoringConfig();
  const importBatchId = uuidv4();
  const clubsByCode = await loadClubLookupMaps();

  const byEpreuve = new Map();
  for (const row of parsed.rows) {
    if (!byEpreuve.has(row.epreuve_code)) byEpreuve.set(row.epreuve_code, []);
    byEpreuve.get(row.epreuve_code).push(row);
  }

  const epreuves = [...byEpreuve.keys()].sort();

  const resolveCode = async (rawCode, rawName) => {
    if (!rawCode || String(rawCode).trim() === "") {
      return { code: null, name: rawName || null };
    }
    const resolved = await resolveClubCode(rawCode, { clubsByCode });
    return {
      code: resolved.code,
      name: (rawName && String(rawName).trim()) || resolved.name || null,
    };
  };

  for (const epreuveCode of epreuves) {
    const dataRows = byEpreuve.get(epreuveCode);
    dataRows.sort((a, b) => a.place - b.place);
    const partantsCount = dataRows.length;
    const clubsCrewCount = Object.create(null);

    for (const row of dataRows) {
      try {
        const resolved = await resolveCode(row.club_code, row.club_name);
        const basePoints = calculatePointsFromConfig({
          config: scoringConfig,
          eventFormat,
          eventLevel,
          epreuveCode,
          place: row.place,
          partantsCount,
        });

        // Mixte multi-clubs : CF = prorata ; 1 club = 100 % ; sinon 0 pt
        if (row.is_mixed) {
          const grouped = groupInlineMixedPartsByClub(row.mixed_parts);
          const u17 = isU17Sheet(epreuveCode);
          const scoreMixed = canScoreMixedClubShares(
            eventFormat,
            eventLevel,
            u17,
            grouped
          );
          if (scoreMixed && basePoints != null) {
            inserted += await insertMixedClubShareRows({
              grouped,
              mixedCodes: row.club_codes_mixed,
              basePoints,
              eventFormat,
              eventLevel,
              resolveCode,
              clubsCrewCount,
              eventId,
              sheetName: epreuveCode,
              epreuveLibelle: row.epreuve_libelle,
              place: row.place,
              partantsCount,
              importBatchId,
            });
            continue;
          }
          await insertRow({
            eventId,
            sheetName: epreuveCode,
            epreuveLibelle: row.epreuve_libelle,
            place: row.place,
            clubCode: resolved.code || "MIXTE",
            clubName: resolved.name,
            crewName: row.crew_name,
            timeRaw: row.time_raw,
            isMixedClubs: true,
            clubCodesMixed: row.club_codes_mixed,
            points: 0,
            eventFormat,
            eventLevel,
            partantsCount,
            importBatchId,
          });
          inserted++;
          continue;
        }

        const clubKey =
          resolved.code ||
          (resolved.name && String(resolved.name).trim()) ||
          null;
        let finalPoints = basePoints;
        if (clubKey) {
          const next = (clubsCrewCount[clubKey] || 0) + 1;
          clubsCrewCount[clubKey] = next;
          // Cap 2 équipages / club : territorial uniquement (pas au CF)
          if (
            basePoints != null &&
            String(eventLevel).toLowerCase() !== "championnat_france"
          ) {
            finalPoints = next <= 2 ? basePoints : 0;
          }
        }

        await insertRow({
          eventId,
          sheetName: epreuveCode,
          epreuveLibelle: row.epreuve_libelle,
          place: row.place,
          clubCode: resolved.code,
          clubName: resolved.name,
          crewName: row.crew_name,
          timeRaw: row.time_raw,
          isMixedClubs: false,
          clubCodesMixed: null,
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
        errors.push(
          `${epreuveCode} place ${row.place}: ${sqlMsg || e.message || String(e)}`,
        );
      }
    }
  }

  return { inserted, epreuves, errors };
}

async function importEnduranceMerExcel(eventId, fileBuffer, options = {}) {
  const { options: merged } = applyInferredMerImportOptions(options);
  const source = String(merged.import_source || merged.source || "base")
    .toLowerCase()
    .trim();
  // BASE = fichier FF historique (une feuille / épreuve)
  // Time Team = export plat cdfadm (event_code / position / club_ref)
  if (
    source === "time_team" ||
    source === "cdfadm" ||
    source === "flat"
  ) {
    return importEnduranceMerFlatExcel(eventId, fileBuffer, merged);
  }
  return importEnduranceMerSheetsExcel(eventId, fileBuffer, merged);
}

async function importEnduranceMerSheetsExcel(eventId, fileBuffer, options = {}) {
  const {
    event_format: inputFormat = "enduro",
    event_level: eventLevel = "territorial",
    replace_previous: replacePrevious = false,
  } = options;
  const eventFormat = String(inputFormat || "enduro").toLowerCase();
  const errors = [];
  let inserted = 0;
  let mixedZeroed = 0;
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
  cleanWorkbookInflatedRanges(workbook);

  const sheetNames = (workbook.SheetNames || []).filter(
    (n) => n !== SHEET_ORGANISATEUR,
  );
  if (sheetNames.length === 0)
    throw new Error("Aucune feuille d'epreuve trouvee dans le fichier");

  if (replacePrevious)
    await EnduranceMerImportResult.destroy({ where: { event_id: eventId } });

  const scoringConfig = await getEnduranceMerScoringConfig();
  const importBatchId = uuidv4();
  // Cache clubs pour résoudre 77002 / C77002 / C077002 → club FFAviron existant
  const clubsByCode = await loadClubLookupMaps();

  for (const sheetName of sheetNames) {
    const rows = getSheetRows(workbook, sheetName);
    const epreuveLabel = normalizeMerSheetLabel(sheetName);
    const u17 = isU17Sheet(sheetName);
    // Première ligne de données à l’index 5 → au moins 6 lignes (indices 0..5).
    const minRows = Math.max(DATA_START_ROW_SIMPLE, DATA_START_ROW_U17) + 1;
    if (rows.length < minRows) continue;

    const dataRows = u17 ? getDataRowsU17(rows) : getDataRowsSimple(rows);
    const partantsCount = dataRows.length;
    if (partantsCount === 0) continue;

    epreuves.push(epreuveLabel);

    dataRows.sort((a, b) => a.place - b.place);
    const clubsCrewCount = Object.create(null);

    const resolveCode = async (rawCode, rawName) => {
      if (!rawCode || String(rawCode).trim() === "") {
        return { code: null, name: rawName || null };
      }
      const resolved = await resolveClubCode(rawCode, { clubsByCode });
      return {
        code: resolved.code,
        // Garder le nom Excel s'il est fourni ; sinon nom du club résolu
        name: (rawName && String(rawName).trim()) || resolved.name || null,
      };
    };

    for (const row of dataRows) {
      try {
        const basePoints = calculatePointsFromConfig({
          config: scoringConfig,
          eventFormat,
          eventLevel,
          epreuveCode: epreuveLabel,
          place: row.place,
          partantsCount,
        });

        // Mixte inline : C078018(1)/C078018(1)/C094005(1)/C078018(1)
        // CF : toutes catégories, prorata rameurs. Hors CF : U17 50/50.
        if (row.inline_mixed) {
          const grouped = groupInlineMixedPartsByClub(row.inline_mixed_parts);
          const scoreMixed = canScoreMixedClubShares(
            eventFormat,
            eventLevel,
            u17,
            grouped
          );
          if (!scoreMixed || basePoints == null) {
            mixedZeroed += 1;
            await insertRow({
              eventId,
              sheetName: epreuveLabel,
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

          inserted += await insertMixedClubShareRows({
            grouped,
            mixedCodes: row.inline_mixed_raw,
            basePoints,
            eventFormat,
            eventLevel,
            resolveCode,
            clubsCrewCount,
            eventId,
            sheetName: epreuveLabel,
            place: row.place,
            partantsCount,
            importBatchId,
          });
          continue;
        }

        // Mixte colonnes (Club1 / Club2) : mêmes règles que l’inline
        if (row.is_mixed) {
          const resolved1 = await resolveCode(row.club_code, row.club_name);
          const resolved2 = await resolveCode(row.club_code_2, row.club_name_2);
          const code1 = resolved1.code;
          const code2 = resolved2.code;
          const name1 = resolved1.name;
          const mixedCodes = [code1, code2].filter(Boolean).join(",");

          const isTwoClubs = !!(
            code1 &&
            code2 &&
            String(code1).toUpperCase() !== "MIXTE" &&
            String(code2).toUpperCase() !== "MIXTE"
          );
          const n1 = row.nb_club1;
          const n2 = row.nb_club2;
          const hasCounts =
            n1 != null &&
            n2 != null &&
            !Number.isNaN(Number(n1)) &&
            !Number.isNaN(Number(n2)) &&
            Number(n1) > 0 &&
            Number(n2) > 0;
          const grouped = isTwoClubs
            ? groupInlineMixedPartsByClub([
                { code: code1, count: hasCounts ? Number(n1) : 1 },
                { code: code2, count: hasCounts ? Number(n2) : 1 },
              ])
            : [];
          const scoreMixed = canScoreMixedClubShares(
            eventFormat,
            eventLevel,
            u17,
            grouped
          );
          if (!scoreMixed || basePoints == null) {
            mixedZeroed += 1;
            await insertRow({
              eventId,
              sheetName: epreuveLabel,
              place: row.place,
              clubCode: code1,
              clubName: name1,
              isMixedClubs: true,
              clubCodesMixed: mixedCodes || row.club_code,
              points: 0,
              eventFormat,
              eventLevel,
              partantsCount,
              importBatchId,
            });
            inserted++;
            continue;
          }

          inserted += await insertMixedClubShareRows({
            grouped,
            mixedCodes,
            basePoints,
            eventFormat,
            eventLevel,
            resolveCode,
            clubsCrewCount,
            eventId,
            sheetName: epreuveLabel,
            place: row.place,
            partantsCount,
            importBatchId,
          });
          continue;
        }

        const resolved = await resolveCode(row.club_code, row.club_name);
        const clubKey =
          resolved.code ||
          (resolved.name && String(resolved.name).trim()) ||
          null;
        let finalPoints = basePoints;
        if (clubKey) {
          const next = (clubsCrewCount[clubKey] || 0) + 1;
          clubsCrewCount[clubKey] = next;
          // Cap 2 équipages / club : territorial uniquement (pas au CF)
          if (
            basePoints != null &&
            String(eventLevel).toLowerCase() !== "championnat_france"
          ) {
            finalPoints = next <= 2 ? basePoints : 0;
          }
        }

        await insertRow({
          eventId,
          sheetName: epreuveLabel,
          place: row.place,
          clubCode: resolved.code,
          clubName: resolved.name,
          isMixedClubs: false,
          clubCodesMixed: null,
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
        errors.push(`Feuille ${epreuveLabel} place ${row.place}: ${msg}`);
      }
    }
  }

  if (mixedZeroed > 0 && !isChampionnatFrance(eventLevel)) {
    errors.push(
      `${mixedZeroed} équipage(s) mixte(s) importé(s) à 0 pt : le partage des points s'applique au Championnat de France. Réimportez avec Niveau = Championnat de France (et Format = BRS) + « remplacer les résultats ».`
    );
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
  const rankings = Array.from(agg.values())
    .sort((a, b) => b.total - a.total)
    .map((r, i) => ({
      club_code: r.club_code,
      club_name: r.club_name,
      total_points: r.total,
      rank: i + 1,
    }));
  return applyOfficialClubNames(rankings);
}

function getIncludedEventFromImportRow(row) {
  if (!row) return null;
  if (row.Event) return row.Event;
  if (row.dataValues?.Event) return row.dataValues.Event;
  return null;
}

/**
 * Filtre saison mer :
 * - `2026` (4 chiffres) → saison sportive du 01/09/(N-1) au 31/08/N
 *   (ex. 2026 = 01/09/2025 inclus → 01/09/2026 exclu), via `events.start_date`.
 * - `2025-2026` ou autre chaîne → `events.season = valeur` (comme l’indoor).
 */
function merSeasonEventWhereClause(season) {
  const s = String(season ?? "").trim();
  if (/^\d{4}$/.test(s)) {
    const y = parseInt(s, 10);
    // Saison N : 1er sept. année N-1 → fin août année N
    const start = new Date(Date.UTC(y - 1, 8, 1, 0, 0, 0, 0)); // 01/09/(N-1)
    const end = new Date(Date.UTC(y, 8, 1, 0, 0, 0, 0)); // 01/09/N (exclu)
    return {
      mode: "sporting_season",
      where: {
        [Op.or]: [
          { start_date: { [Op.gte]: start, [Op.lt]: end } },
          // Événements tagués explicitement sur la saison (si dates absentes / hors plage)
          { season: s },
          { season: `${y - 1}-${y}` },
        ],
      },
      range: {
        from: `${y - 1}-09-01`,
        to_exclusive: `${y}-09-01`,
        label: `01/09/${y - 1} → 31/08/${y}`,
      },
    };
  }
  return { mode: "event_season", where: { season: s } };
}

function isMissingDbTableError(err) {
  const errno = err?.original?.errno ?? err?.parent?.errno ?? err?.errno;
  const code = err?.original?.code ?? err?.parent?.code;
  const msg = String(err?.message || "");
  return (
    errno === 1146 ||
    code === "ER_NO_SUCH_TABLE" ||
    /doesn't exist|n'existe pas|Base table or view not found/i.test(msg)
  );
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
    try {
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
    } catch (e) {
      if (isMissingDbTableError(e)) {
        console.warn(
          "[mer] Table endurance_mer_territorial_bonus absente — bonus ignorés. Exécuter docs/migrations/011_create_endurance_mer_territorial_bonus.sql",
        );
      } else {
        throw e;
      }
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
  const { where: eventWhere } = merSeasonEventWhereClause(season);
  return EnduranceMerImportResult.findAll({
    include: [
      {
        model: Event,
        required: true,
        where: eventWhere,
        attributes: [
          "id",
          "name",
          "location",
          "start_date",
          "end_date",
          "race_type",
          "season",
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
            "season",
          ],
          order: [["start_date", "ASC"]],
        });

  const byEventPayload = [];
  const clubsByCode = await loadClubLookupMaps();
  for (const ev of eventsOrdered) {
    // getEnduranceMerRankingForEvent applique déjà le registre ; on passe le cache via enrichissement local
    const rankingsRaw = await getEnduranceMerRankingForEvent(ev.id);
    byEventPayload.push({
      event: {
        id: ev.id,
        name: ev.name,
        location: ev.location,
        start_date: ev.start_date,
        end_date: ev.end_date,
        race_type: ev.race_type,
        season: ev.season,
      },
      rankings: rankingsRaw,
    });
  }

  const seasonMeta = merSeasonEventWhereClause(season);
  const globalRankings = await applyOfficialClubNames(
    finalizeMerGlobalRankingRows(perClub),
    clubsByCode,
  );

  return {
    type: "mer",
    season: String(season),
    season_filter: {
      mode: seasonMeta.mode,
      description:
        seasonMeta.mode === "sporting_season"
          ? `Événements dont start_date tombe dans la saison sportive ${seasonMeta.range?.label || ""} (ou events.season = ${season} / ${Number(season) - 1}-${season}).`
          : seasonMeta.mode === "calendar_year"
            ? "Événements dont start_date tombe dans l’année calendaire indiquée."
            : "Événements dont le champ events.season correspond exactement au paramètre (ex. 2025-2026).",
      ...(seasonMeta.range ? { range: seasonMeta.range } : {}),
    },
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
      rankings: globalRankings,
    },
  };
}

module.exports = {
  importEnduranceMerExcel,
  getEnduranceMerRankingForEvent,
  getGlobalMerRanking,
  getMerClubsDashboard,
};
