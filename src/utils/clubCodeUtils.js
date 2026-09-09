const { Op } = require("sequelize");
const Club = require("../models/Club");

/**
 * Normalisation / matching des codes clubs FFAviron.
 *
 * Exemples :
 *  - "77002"   → "C077002"
 *  - "077002"  → "C077002"
 *  - "C77002"  → "C077002"
 *  - "C077002" → "C077002"
 *  - "c077002" → "C077002"
 */

function extractDigits(raw) {
  return String(raw || "").replace(/\D/g, "");
}

/**
 * Canonicalise un code club vers le format FFAviron `C` + 6 chiffres quand c'est possible.
 * Retourne null si le code n'est pas interprétable comme code club numérique.
 */
function canonicalizeClubCode(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toUpperCase();
  if (!s || s === "MIXTE" || s === "0") return s || null;

  // Mixte inline : ne pas toucher
  if (s.includes("/")) return s;

  // Déjà au format C######
  if (/^C\d{6}$/.test(s)) return s;

  const digits = extractDigits(s);
  if (!digits) return s;

  // Trop long pour un code club standard → on garde tel quel
  if (digits.length > 6) return s;

  return `C${digits.padStart(6, "0")}`;
}

/**
 * Variantes de recherche pour un code club (égalité flexible).
 * Ex. "77002" → ["77002", "C77002", "C077002", "077002"]
 */
function clubCodeSearchVariants(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (!s) return [];

  const variants = new Set([s]);
  const canonical = canonicalizeClubCode(s);
  if (canonical) variants.add(canonical);

  const digits = extractDigits(s);
  if (digits) {
    variants.add(digits);
    variants.add(digits.padStart(6, "0"));
    variants.add(`C${digits}`);
    variants.add(`C${digits.padStart(6, "0")}`);
    // Sans zéros de tête
    const stripped = digits.replace(/^0+/, "") || "0";
    variants.add(stripped);
    variants.add(`C${stripped.padStart(6, "0")}`);
  }

  return Array.from(variants);
}

/**
 * Résout un code club contre la table `clubs`.
 * Priorité : code exact → code canonicalisé → match sur chiffres (RIGHT(code, n) / LIKE).
 *
 * @returns {Promise<{ code: string, name: string|null, matched: boolean, raw: string }>}
 */
async function resolveClubCode(raw, { clubsByCode = null } = {}) {
  const original = String(raw || "").trim();
  if (!original) {
    return { code: null, name: null, matched: false, raw: original };
  }

  const upper = original.toUpperCase();
  if (upper === "MIXTE" || original.includes("/")) {
    return { code: upper === "MIXTE" ? "MIXTE" : original, name: null, matched: false, raw: original };
  }

  const canonical = canonicalizeClubCode(original) || upper;
  const variants = clubCodeSearchVariants(original);

  // Cache en mémoire (chargé une fois par import)
  if (clubsByCode) {
    for (const v of variants) {
      const hit = clubsByCode.get(v.toUpperCase());
      if (hit) {
        return {
          code: hit.code,
          name: hit.nom_court || hit.nom || null,
          matched: true,
          raw: original,
        };
      }
    }

    // Match par chiffres seuls (ex. clubsByDigits["77002"] → C077002)
    const digits = extractDigits(original);
    if (digits) {
      const stripped = digits.replace(/^0+/, "") || "0";
      const hit =
        clubsByCode.get(`__digits__${stripped}`) ||
        clubsByCode.get(`__digits__${digits.padStart(6, "0")}`);
      if (hit) {
        return {
          code: hit.code,
          name: hit.nom_court || hit.nom || null,
          matched: true,
          raw: original,
        };
      }
    }

    return { code: canonical, name: null, matched: false, raw: original };
  }

  // Requête DB ponctuelle
  const club =
    (await Club.findOne({ where: { code: { [Op.in]: variants } } })) ||
    (await findClubByDigits(extractDigits(original)));

  if (club) {
    return {
      code: club.code,
      name: club.nom_court || club.nom || null,
      matched: true,
      raw: original,
    };
  }

  return { code: canonical, name: null, matched: false, raw: original };
}

async function findClubByDigits(digits) {
  if (!digits) return null;
  const stripped = digits.replace(/^0+/, "") || "0";
  const padded = stripped.padStart(6, "0");

  // Codes type C###### se terminant par les mêmes chiffres
  return Club.findOne({
    where: {
      [Op.or]: [
        { code: `C${padded}` },
        { code: { [Op.like]: `%${stripped}` } },
      ],
    },
    order: [["code", "ASC"]],
  });
}

/**
 * Charge tous les clubs en maps pour un import batch rapide.
 */
async function loadClubLookupMaps() {
  const clubs = await Club.findAll({
    attributes: ["id", "code", "code_court", "nom", "nom_court"],
  });

  const byCode = new Map();
  for (const club of clubs) {
    const code = String(club.code || "").toUpperCase();
    if (!code) continue;
    byCode.set(code, club);

    const digits = extractDigits(code);
    if (digits) {
      const stripped = digits.replace(/^0+/, "") || "0";
      // Première occurrence gagne (évite d'écraser un match plus précis)
      if (!byCode.has(`__digits__${stripped}`)) {
        byCode.set(`__digits__${stripped}`, club);
      }
      if (!byCode.has(`__digits__${digits.padStart(6, "0")}`)) {
        byCode.set(`__digits__${digits.padStart(6, "0")}`, club);
      }
    }

    if (club.code_court) {
      byCode.set(String(club.code_court).toUpperCase(), club);
    }
  }

  return byCode;
}

/**
 * Remplace `club_name` par le nom officiel du registre `clubs` (nom_court || nom)
 * quand `club_code` matche. Conserve le libellé d'origine sinon.
 *
 * @param {Array<{ club_code?: string|null, club_name?: string|null }>} items
 * @param {Map|null} clubsByCode - cache optionnel (loadClubLookupMaps)
 */
async function applyOfficialClubNames(items, clubsByCode = null) {
  if (!Array.isArray(items) || items.length === 0) return items || [];
  const map = clubsByCode || (await loadClubLookupMaps());

  const out = [];
  for (const row of items) {
    if (!row || row.club_code == null || String(row.club_code).trim() === "") {
      out.push(row);
      continue;
    }
    const resolved = await resolveClubCode(row.club_code, { clubsByCode: map });
    if (!resolved?.matched || !resolved.code) {
      out.push(row);
      continue;
    }
    // Affichage classement : nom officiel complet du registre (fallback nom_court)
    const hit =
      map.get(String(resolved.code).toUpperCase()) ||
      null;
    const officialName =
      (hit && (hit.nom || hit.nom_court)) || resolved.name || null;
    if (!officialName) {
      out.push(row);
      continue;
    }
    out.push({
      ...row,
      club_code: resolved.code || row.club_code,
      club_name: officialName,
      club_name_source: "registry",
      club_name_import: row.club_name ?? null,
    });
  }
  return out;
}

module.exports = {
  canonicalizeClubCode,
  clubCodeSearchVariants,
  resolveClubCode,
  loadClubLookupMaps,
  applyOfficialClubNames,
  extractDigits,
};
