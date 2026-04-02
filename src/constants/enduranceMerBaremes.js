const ENDURO_TABLE = {
  "1x": [30, 24, 18, 13.5, 9, 6, 3, 1.5, 1.5, 1.5, 0.75],
  "2x": [45, 36, 27, 20.25, 13.5, 9, 4.5, 2.25, 2.25, 2.25, 1.5],
  "4x+_senior": [67.5, 54, 40.5, 30, 20.25, 13.5, 6.75, 3.375, 3.375, 3.375, 2.25],
  "2x_u19": [90, 72, 54, 40, 27, 18, 9, 4.5, 4.5, 4.5, 3],
  "4x+_u17_u19": [90, 72, 54, 40, 27, 18, 9, 4.5, 4.5, 4.5, 3],
};

const BRS_TABLE = {
  "u19_1x": [60, 48, 36, 27, 18, 12, 6, 3, 3, 3, 0],
  "u19_2x": [80, 60, 48, 36, 27, 18, 12, 6, 3, 3, 0],
  "senior": [60, 48, 36, 27, 18, 12, 6, 3, 3, 3, 0],
};

const CHAMP_FRANCE_TABLE = {
  "1x_u19": [75, 63, 54, 45, 39, 33, 27, 22.5, 18, 15, 13.5, 12, 10.5, 9, 7.5, 6, 4.5, 3, 1.5, 1.5],
  "1x_senior": [50, 42, 36, 30, 26, 22, 18, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1],
  "2x_u19": [100, 90, 75, 63, 54, 45, 39, 33, 27, 22.5, 18, 15, 13.5, 12, 10.5, 9, 7.5, 5, 1, 1],
  "2x_senior": [75, 63, 54, 45, 39, 33, 27, 22.5, 18, 15, 13.5, 12, 10.5, 9, 7.5, 6, 4.5, 3, 1.5, 1.5],
  "4x_u17_u19": [150, 126, 108, 90, 78, 66, 54, 45, 36, 30, 27, 24, 21, 18, 15, 12, 9, 6, 3, 3],
  "4x_senior": [112.5, 94.5, 81, 67.5, 58.5, 49.5, 40.5, 33.8, 27, 22.5, 20.3, 18, 15.8, 13.5, 11.3, 9, 6.8, 4.5, 2.3, 2.3],
};

const ENDURO_EPREUVE_TO_COLUMN = {
  SF1X: "1x", SH1X: "1x", M40F1X: "1x", M40H1X: "1x",
  SF2X: "2x", SH2X: "2x", M40F2X: "2x", M40H2X: "2x", SM2X: "2x", M40M2X: "2x",
  U19M2X: "2x_u19",
  "SF4X+": "4x+_senior", "M40F4X+": "4x+_senior", "SH4X+": "4x+_senior", "M40H4X+": "4x+_senior",
  "SM4X+": "4x+_senior", "M40M4X+": "4x+_senior", "SM4+": "4x+_senior",
  "U17F4X+": "4x+_u17_u19", "U19F4X+": "4x+_u17_u19", "U17H4X+": "4x+_u17_u19", "U19H4X+": "4x+_u17_u19", "U17M4X+": "4x+_u17_u19", "U19M4X+": "4x+_u17_u19",
};

const DEFAULT_ENDURANCE_MER_TEMPLATE_CONFIG = {
  version: "2026",
  ponderation: { lt7: 0.75, gte7: 1 },
  enduro: { epreuve_map: ENDURO_EPREUVE_TO_COLUMN, table: ENDURO_TABLE },
  brs: { epreuve_map: {}, table: BRS_TABLE },
  championnat_france: { table: CHAMP_FRANCE_TABLE },
};

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

function inferBrsColumnFromCode(epreuveCode) {
  const c = normalizeCode(epreuveCode);
  if (c.includes("U19")) {
    if (c.includes("1X")) return "u19_1x";
    if (c.includes("2X")) return "u19_2x";
  }
  return "senior";
}

function inferChampFranceColumn(epreuveCode) {
  const c = normalizeCode(epreuveCode);
  const isU19 = c.includes("U19");
  const isU17 = c.includes("U17");
  const isSenior = !isU17 && !isU19;
  if (c.includes("1X")) return isU19 ? "1x_u19" : "1x_senior";
  if (c.includes("2X")) return isU19 ? "2x_u19" : "2x_senior";
  if (c.includes("4")) return (isU17 || isU19) ? "4x_u17_u19" : "4x_senior";
  return null;
}

function getPointsByColumn(table, column, place, maxPlace = 11) {
  if (!column || !table || !table[column]) return null;
  const row = table[column];
  const index = place >= 1 && place <= maxPlace ? place - 1 : maxPlace - 1;
  return row[index] ?? null;
}

function applyPonderationFromConfig(config, pointsBruts, partantsCount) {
  if (pointsBruts == null || pointsBruts === 0) return 0;
  const lt7 = config?.ponderation?.lt7 ?? 0.75;
  const gte7 = config?.ponderation?.gte7 ?? 1;
  const factor = partantsCount != null && partantsCount < 7 ? lt7 : gte7;
  return Math.round(pointsBruts * factor * 100) / 100;
}

function calculatePointsFromConfig({ config, eventFormat, eventLevel, epreuveCode, place, partantsCount }) {
  const fmt = String(eventFormat || "enduro").toLowerCase();
  const lvl = String(eventLevel || "territorial").toLowerCase();

  if (lvl === "championnat_france") {
    const col = inferChampFranceColumn(epreuveCode);
    const table = config?.championnat_france?.table || CHAMP_FRANCE_TABLE;
    const bruts = getPointsByColumn(table, col, place, 20);
    return bruts == null ? null : Math.round(bruts * 100) / 100;
  }

  if (fmt === "enduro") {
    const map = config?.enduro?.epreuve_map || ENDURO_EPREUVE_TO_COLUMN;
    const key = normalizeCode(epreuveCode);
    const col = map[key] || map[epreuveCode] || null;
    const bruts = getPointsByColumn(config?.enduro?.table || ENDURO_TABLE, col, place, 11);
    if (bruts == null) return null;
    return applyPonderationFromConfig(config, bruts, partantsCount);
  }

  if (fmt === "brs") {
    const map = config?.brs?.epreuve_map || {};
    const key = normalizeCode(epreuveCode);
    const col = map[key] || map[epreuveCode] || inferBrsColumnFromCode(epreuveCode);
    const bruts = getPointsByColumn(config?.brs?.table || BRS_TABLE, col, place, 11);
    if (bruts == null) return null;
    return applyPonderationFromConfig(config, bruts, partantsCount);
  }

  return null;
}

function inferBRSGroup(epreuveCode) {
  const col = inferBrsColumnFromCode(epreuveCode);
  return col.startsWith("u19") ? "junior" : "senior";
}

module.exports = {
  DEFAULT_ENDURANCE_MER_TEMPLATE_CONFIG,
  calculatePointsFromConfig,
  applyPonderationFromConfig,
  inferBRSGroup,
};