const axios = require("axios");

const INTRANET_MANIFESTATIONS_URL =
  "https://intranet.ffaviron.fr/api/v1/manifestations";

const DEFAULT_PAR_PAGE = 200;
const MAX_PAR_PAGE = 500;
const MAX_PAGES_FETCH_ALL = 100;

/** Paramètres de filtre reconnus par l’intranet `/api/v1/manifestations` (proxy). */
const INTRANET_FORWARD_KEYS = [
  "date_debut",
  "date_fin",
  "modele_id",
  "structure_id",
  "discipline_code",
  "tour_id",
  "include",
];

function collectIntranetForwardParams(opts) {
  const out = {};
  if (!opts || typeof opts !== "object") return out;
  for (const key of INTRANET_FORWARD_KEYS) {
    const v = opts[key];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[key] = typeof v === "string" ? v.trim() : String(v);
  }
  return out;
}

function applyForwardParamsToUrl(url, forward) {
  for (const [k, v] of Object.entries(forward)) {
    url.searchParams.set(k, v);
  }
}

function parseParPage(raw) {
  const n = parseInt(String(raw ?? DEFAULT_PAR_PAGE), 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PAR_PAGE;
  return Math.min(n, MAX_PAR_PAGE);
}

function parsePage(raw) {
  const n = parseInt(String(raw ?? 1), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

function truthyFetchAll(raw) {
  if (raw === true) return true;
  const s = String(raw ?? "").toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

/**
 * Champs utiles pour un sélecteur / filtres (import manifestation).
 * @param {object} m — entrée brute `data[]` de l’API intranet
 */
function mapManifestationRow(m) {
  const type = m.type;
  return {
    id: m.id,
    libelle: m.libelle ?? null,
    nom: m.libelle ?? null,
    structure: m.structure
      ? {
          nom: m.structure.nom ?? null,
          code: m.structure.code ?? null,
        }
      : null,
    type: type
      ? {
          id: type.id,
          libelle: type.libelle ?? null,
          disciplines: Array.isArray(type.disciplines) ? type.disciplines : [],
        }
      : null,
    details_type: m.details?.type
      ? {
          code: m.details.type.code ?? null,
          libelle: m.details.type.libelle ?? null,
        }
      : null,
    date_debut: m.date_debut ?? null,
    date_fin: m.date_fin ?? null,
  };
}

async function fetchIntranetPage(headers, par_page, page, forward) {
  const url = new URL(INTRANET_MANIFESTATIONS_URL);
  url.searchParams.set("par_page", String(par_page));
  url.searchParams.set("page", String(page));
  applyForwardParamsToUrl(url, forward);
  const { data } = await axios.get(url.toString(), {
    headers,
    timeout: 60000,
  });
  return data;
}

/**
 * Liste les manifestations depuis l’intranet FFA (proxy).
 * @param {Record<string, string|undefined>} opts — query Express : par_page, page, fetch_all,
 *   et filtres transmis tels quels à l’intranet : date_debut, date_fin (yyyy-mm-dd), modele_id,
 *   structure_id, discipline_code, tour_id, include.
 */
async function listFfManifestations(opts = {}) {
  const token = process.env.EXTERNAL_API_TOKEN;
  if (!token) {
    const err = new Error("EXTERNAL_API_TOKEN non configuré");
    err.code = "NO_TOKEN";
    throw err;
  }

  const par_page = parseParPage(opts.par_page);
  const fetch_all = truthyFetchAll(opts.fetch_all);
  const headers = { Authorization: `Bearer ${token}` };
  const intranet_filters = collectIntranetForwardParams(opts);

  const baseMeta = {
    par_page,
    intranet_filters:
      Object.keys(intranet_filters).length > 0 ? intranet_filters : undefined,
  };

  if (!fetch_all) {
    const page = parsePage(opts.page);
    const raw = await fetchIntranetPage(
      headers,
      par_page,
      page,
      intranet_filters,
    );
    const rows = Array.isArray(raw.data) ? raw.data : [];
    return {
      data: rows.map(mapManifestationRow),
      meta: {
        ...baseMeta,
        page,
        last_page: raw.meta?.last_page ?? 1,
        total: raw.meta?.total ?? rows.length,
        from: raw.meta?.from ?? null,
        to: raw.meta?.to ?? null,
      },
    };
  }

  const data = [];
  let page = 1;
  let last_page = 1;
  let total = null;

  for (let guard = 0; guard < MAX_PAGES_FETCH_ALL; guard += 1) {
    const raw = await fetchIntranetPage(
      headers,
      par_page,
      page,
      intranet_filters,
    );
    const rows = Array.isArray(raw.data) ? raw.data : [];
    last_page = Number(raw.meta?.last_page) || page;
    if (total == null && raw.meta?.total != null) total = raw.meta.total;

    data.push(...rows.map(mapManifestationRow));

    if (page >= last_page || rows.length === 0) break;
    page += 1;
  }

  return {
    data,
    meta: {
      ...baseMeta,
      fetch_all: true,
      pages_fetched: page,
      last_page,
      total: total ?? data.length,
    },
  };
}

module.exports = { listFfManifestations };
