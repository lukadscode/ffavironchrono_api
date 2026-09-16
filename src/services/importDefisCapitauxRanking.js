const XLSX = require("xlsx");
const { v4: uuidv4 } = require("uuid");
const Club = require("../models/Club");
const DefisCapitauxSeasonRanking = require("../models/DefisCapitauxSeasonRanking");
const {
  resolveClubCode,
  loadClubLookupMaps,
  canonicalizeClubCode,
} = require("../utils/clubCodeUtils");
const rankingService = require("./rankingService");

const RANK_HEADERS = new Set([
  "rang",
  "rank",
  "place",
  "classement",
  "position",
  "pos",
  "n",
  "no",
  "numero",
]);
const CODE_HEADERS = new Set([
  "code club",
  "club_code",
  "codeclub",
  "code",
  "n club",
  "no club",
  "numero club",
  "code ffa",
]);
const NAME_HEADERS = new Set([
  "club",
  "nom",
  "nom club",
  "club_name",
  "nom du club",
  "association",
  "libelle",
  "libellé",
  "intitule",
  "intitulé",
]);

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

function normalizeHeader(raw) {
  return String(raw || "")
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeClubName(raw) {
  return String(raw || "")
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function classifyHeader(header) {
  const h = normalizeHeader(header);
  if (!h) return null;
  if (RANK_HEADERS.has(h)) return "rank";
  if (CODE_HEADERS.has(h)) return "code";
  if (NAME_HEADERS.has(h)) return "name";
  if (h.includes("rang") || h.includes("classement") || h === "place")
    return "rank";
  if (h.includes("code") && h.includes("club")) return "code";
  if (h === "code" || h.endsWith(" code")) return "code";
  if (h.includes("club") || h.includes("association") || h.startsWith("nom"))
    return "name";
  return null;
}

function parseRank(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().replace(",", ".");
  const m = s.match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

function looksLikeHeaderRow(values) {
  const classified = values.map((v) => classifyHeader(v)).filter(Boolean);
  return classified.length >= 2;
}

function mapHeaderIndexes(headerValues) {
  const idx = { rank: -1, code: -1, name: -1 };
  headerValues.forEach((v, i) => {
    const kind = classifyHeader(v);
    if (kind && idx[kind] === -1) {
      idx[kind] = i;
    }
  });
  return idx;
}

function clampSheetUsedRange(sheet, maxCol = 12, maxRow = 800) {
  if (!sheet || !sheet["!ref"]) return sheet;
  try {
    let maxC = 0;
    let maxR = 0;
    let has = false;
    for (const addr of Object.keys(sheet)) {
      if (addr[0] === "!") continue;
      const cell = sheet[addr];
      if (getCellString(cell) == null) continue;
      const decoded = XLSX.utils.decode_cell(addr);
      maxC = Math.max(maxC, decoded.c);
      maxR = Math.max(maxR, decoded.r);
      has = true;
    }
    if (!has) return sheet;
    const endC = Math.min(maxC, maxCol - 1);
    const endR = Math.min(maxR, maxRow - 1);
    sheet["!ref"] = XLSX.utils.encode_range({
      s: { c: 0, r: 0 },
      e: { c: endC, r: endR },
    });
  } catch (_e) {
    /* keep original range */
  }
  return sheet;
}

function peekText(fileBuffer, maxBytes = 4096) {
  const slice = Buffer.isBuffer(fileBuffer)
    ? fileBuffer.subarray(0, maxBytes)
    : Buffer.from(fileBuffer).subarray(0, maxBytes);
  return slice.toString("utf8").replace(/^\uFEFF/, "");
}

function looksLikeCsv(fileBuffer, originalFilename) {
  const name = String(originalFilename || "").toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) return true;
  const peek = peekText(fileBuffer, 8);
  return peek.charAt(0) !== "P" || peek.charAt(1) !== "K";
}

function detectCsvDelimiter(fileBuffer) {
  const firstLine = (peekText(fileBuffer).split(/\r?\n/).find((l) => l.trim()) || "");
  const semi = (firstLine.match(/;/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  const tab = (firstLine.match(/\t/g) || []).length;
  if (tab > semi && tab > comma) return "\t";
  if (semi > comma) return ";";
  return ",";
}

function parseSpreadsheetRows(fileBuffer, originalFilename) {
  const readOpts = { type: "buffer", cellDates: true };
  if (looksLikeCsv(fileBuffer, originalFilename)) {
    readOpts.FS = detectCsvDelimiter(fileBuffer);
  }

  let workbook;
  try {
    workbook = XLSX.read(fileBuffer, readOpts);
  } catch (e) {
    const err = new Error(
      "Fichier Excel invalide : " + (e.message || "erreur de lecture")
    );
    err.statusCode = 400;
    throw err;
  }

  const sheetName = workbook.SheetNames && workbook.SheetNames[0];
  if (!sheetName) {
    const err = new Error("Le fichier ne contient aucune feuille.");
    err.statusCode = 400;
    throw err;
  }

  const sheet = clampSheetUsedRange(workbook.Sheets[sheetName]);
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  const rows = [];
  for (const raw of matrix) {
    if (!Array.isArray(raw)) continue;
    const values = raw.map((c) => getCellString(c) || "");
    if (values.every((v) => !String(v).trim())) continue;
    rows.push(values);
  }
  return rows;
}

async function buildNameLookup() {
  const clubs = await Club.findAll({
    attributes: ["id", "code", "code_court", "nom", "nom_court"],
  });
  const byName = new Map();
  for (const club of clubs) {
    for (const n of [club.nom, club.nom_court]) {
      const key = normalizeClubName(n);
      if (!key) continue;
      if (!byName.has(key)) byName.set(key, []);
      const list = byName.get(key);
      if (!list.some((c) => c.code === club.code)) {
        list.push(club);
      }
    }
  }
  return byName;
}

async function resolveImportedClub(rawCode, rawName, clubsByCode, byName) {
  const codeStr = String(rawCode || "").trim();
  const nameStr = String(rawName || "").trim();

  if (codeStr) {
    const resolved = await resolveClubCode(codeStr, { clubsByCode });
    if (resolved.matched && resolved.code) {
      return {
        club_code: resolved.code,
        club_name: resolved.name || nameStr || resolved.code,
        club_matched: true,
      };
    }
  }

  const nameKey = normalizeClubName(nameStr);
  if (nameKey && byName.has(nameKey)) {
    const hits = byName.get(nameKey);
    if (hits.length === 1) {
      const club = hits[0];
      return {
        club_code: club.code,
        club_name: club.nom || club.nom_court || nameStr,
        club_matched: true,
      };
    }
    return {
      club_code: canonicalizeClubCode(codeStr) || null,
      club_name: nameStr || codeStr || "Club",
      club_matched: false,
      warning: `Club ambigu (« ${nameStr} ») : ${hits.length} correspondances`,
    };
  }

  return {
    club_code: canonicalizeClubCode(codeStr) || (codeStr ? codeStr : null),
    club_name: nameStr || codeStr || "Club",
    club_matched: false,
    warning:
      nameStr || codeStr
        ? `Club non trouvé dans le registre : ${nameStr || codeStr}`
        : "Ligne sans club identifiable",
  };
}

/**
 * Parse le tableau final (Excel/CSV) et applique le barème défis capitaux (rang → points).
 * Ne persiste rien.
 */
async function previewDefisCapitauxRanking(fileBuffer, originalFilename) {
  const matrix = parseSpreadsheetRows(fileBuffer, originalFilename);
  if (matrix.length === 0) {
    const err = new Error("Le fichier est vide.");
    err.statusCode = 400;
    throw err;
  }

  let start = 0;
  let cols = mapHeaderIndexes(matrix[0]);
  if (looksLikeHeaderRow(matrix[0]) && (cols.rank >= 0 || cols.name >= 0 || cols.code >= 0)) {
    start = 1;
  } else {
    cols = { rank: 0, code: -1, name: matrix[0].length > 1 ? 1 : 0 };
  }

  if (cols.name < 0 && cols.code < 0) {
    const err = new Error(
      "Impossible d'identifier les colonnes. Attendu : Rang, Code club, Club."
    );
    err.statusCode = 400;
    throw err;
  }

  const defisTemplate = await rankingService.getDefisCapitauxTemplateOrNull();
  if (!defisTemplate) {
    const err = new Error(
      'Template de points « défis capitaux » introuvable. Configurez-le dans Barèmes de points.'
    );
    err.statusCode = 500;
    throw err;
  }

  const [clubsByCode, byName] = await Promise.all([
    loadClubLookupMaps(),
    buildNameLookup(),
  ]);

  const warnings = [];
  const parsed = [];
  let sequential = 0;

  for (let i = start; i < matrix.length; i++) {
    const values = matrix[i];
    const rankRaw = cols.rank >= 0 ? values[cols.rank] : "";
    const codeRaw = cols.code >= 0 ? values[cols.code] : "";
    const nameRaw = cols.name >= 0 ? values[cols.name] : "";
    if (!String(codeRaw || "").trim() && !String(nameRaw || "").trim()) {
      continue;
    }

    sequential += 1;
    const rank = parseRank(rankRaw) || sequential;
    const resolved = await resolveImportedClub(
      codeRaw,
      nameRaw,
      clubsByCode,
      byName
    );
    const points = rankingService.getDefisCapitauxPointsForRank(
      defisTemplate,
      rank
    );

    if (resolved.warning) {
      warnings.push({ row: i + 1, message: resolved.warning });
    }

    parsed.push({
      imported_rank: rank,
      club_code: resolved.club_code,
      club_name: resolved.club_name,
      points,
      club_matched: resolved.club_matched,
    });
  }

  if (parsed.length === 0) {
    const err = new Error(
      "Aucune ligne club / rang lisible. Colonnes attendues : Rang, Code club, Club."
    );
    err.statusCode = 400;
    throw err;
  }

  parsed.sort((a, b) => a.imported_rank - b.imported_rank);

  return {
    source_filename: originalFilename || null,
    template: {
      id: defisTemplate.id,
      name: defisTemplate.name,
    },
    rows: parsed,
    warnings,
  };
}

function serializeStoredRow(row) {
  return {
    imported_rank: Number(row.imported_rank),
    club_code: row.club_code,
    club_name: row.club_name,
    points: Number(row.points),
    club_matched: Boolean(row.club_matched),
  };
}

async function getDefisCapitauxSeasonRanking(season) {
  const seasonKey = String(season || "").trim();
  if (!seasonKey) {
    const err = new Error("Paramètre season requis");
    err.statusCode = 400;
    throw err;
  }

  const rows = await DefisCapitauxSeasonRanking.findAll({
    where: { season: seasonKey },
    order: [
      ["imported_rank", "ASC"],
      ["club_name", "ASC"],
    ],
  });

  if (rows.length === 0) {
    return {
      season: seasonKey,
      imported: false,
      rankings: [],
    };
  }

  const first = rows[0];
  return {
    season: seasonKey,
    imported: true,
    imported_at: first.imported_at,
    source_filename: first.source_filename,
    imported_by: first.imported_by,
    import_batch_id: first.import_batch_id,
    rows_count: rows.length,
    rankings: rows.map(serializeStoredRow),
  };
}

async function saveDefisCapitauxSeasonRanking({
  season,
  rows,
  sourceFilename,
  importedBy,
}) {
  const seasonKey = String(season || "").trim();
  if (!seasonKey) {
    const err = new Error("Paramètre season requis");
    err.statusCode = 400;
    throw err;
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    const err = new Error("Aucune ligne à enregistrer.");
    err.statusCode = 400;
    throw err;
  }

  const batchId = uuidv4();
  const now = new Date();
  const records = rows.map((row) => ({
    id: uuidv4(),
    season: seasonKey,
    imported_rank: Number(row.imported_rank),
    club_code: row.club_code ? String(row.club_code).trim() : null,
    club_name: String(row.club_name || "").trim() || "Club",
    points: Number(row.points) || 0,
    club_matched: Boolean(row.club_matched),
    source_filename: sourceFilename || null,
    import_batch_id: batchId,
    imported_by: importedBy || null,
    imported_at: now,
  }));

  await DefisCapitauxSeasonRanking.destroy({ where: { season: seasonKey } });
  await DefisCapitauxSeasonRanking.bulkCreate(records);

  return getDefisCapitauxSeasonRanking(seasonKey);
}

async function deleteDefisCapitauxSeasonRanking(season) {
  const seasonKey = String(season || "").trim();
  if (!seasonKey) {
    const err = new Error("Paramètre season requis");
    err.statusCode = 400;
    throw err;
  }
  const deleted = await DefisCapitauxSeasonRanking.destroy({
    where: { season: seasonKey },
  });
  return { season: seasonKey, deleted };
}

module.exports = {
  previewDefisCapitauxRanking,
  getDefisCapitauxSeasonRanking,
  saveDefisCapitauxSeasonRanking,
  deleteDefisCapitauxSeasonRanking,
};
