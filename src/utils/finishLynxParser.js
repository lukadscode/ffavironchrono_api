const FINISH_LYNX_STATUS_MAP = {
  DNS: "dns",
  DNF: "dnf",
  DQ: "disqualified",
  DQB: "disqualified",
  DQF: "disqualified",
  DSQ: "disqualified",
  FS: "disqualified",
  NT: "dnf",
};

const TIME_PATTERN =
  /^(\d+:)??(\d{1,2}):(\d{2})(\.\d+)?$|^(\d+)(\.\d+)?$/;

function splitCsvLine(line) {
  return line.split(",").map((part) => part.trim());
}

function parseFinishLynxTime(raw) {
  if (!raw || typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;

  const upper = value.toUpperCase();
  if (FINISH_LYNX_STATUS_MAP[upper]) return null;

  const parts = value.split(":");
  if (parts.length === 1) {
    const seconds = parseFloat(parts[0]);
    return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
  }

  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    return Math.round((minutes * 60 + seconds) * 1000);
  }

  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);
    if (
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes) ||
      !Number.isFinite(seconds)
    ) {
      return null;
    }
    return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
  }

  return null;
}

function parseTimeOfDayMs(raw) {
  if (!raw || typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;

  const segments = value.split(":");
  if (segments.length < 2) return null;

  let hours = 0;
  let minutes;
  let secondsPart;

  if (segments.length === 2) {
    minutes = parseInt(segments[0], 10);
    secondsPart = segments[1];
  } else {
    hours = parseInt(segments[0], 10);
    minutes = parseInt(segments[1], 10);
    secondsPart = segments[2];
  }

  const seconds = parseFloat(secondsPart);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds)
  ) {
    return null;
  }

  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

function mergeTimeWithDate(timeOfDayMs, referenceDate) {
  if (timeOfDayMs == null || !referenceDate) return null;
  const ref = new Date(referenceDate);
  if (Number.isNaN(ref.getTime())) return null;

  const base = new Date(
    ref.getFullYear(),
    ref.getMonth(),
    ref.getDate(),
    0,
    0,
    0,
    0
  );
  return new Date(base.getTime() + timeOfDayMs);
}

function parseCompetitorStatus(placeRaw) {
  if (!placeRaw) return null;
  const upper = String(placeRaw).trim().toUpperCase();
  return FINISH_LYNX_STATUS_MAP[upper] || null;
}

function isLikelyTimeValue(raw) {
  if (!raw) return false;
  return TIME_PATTERN.test(raw.trim());
}

function parseLifContent(content) {
  if (!content || typeof content !== "string") {
    throw new Error("Contenu LIF invalide");
  }

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith(";"));

  if (lines.length === 0) {
    throw new Error("Fichier LIF vide");
  }

  const eventCols = splitCsvLine(lines[0]);
  const event = {
    eventNumber: eventCols[0] || null,
    roundNumber: eventCols[1] || null,
    heatNumber: eventCols[2] ? parseInt(eventCols[2], 10) : null,
    eventName: eventCols[3] || null,
    distance: eventCols[9] || null,
    startTimeRaw: eventCols[10] || null,
    startTimeMs: parseTimeOfDayMs(eventCols[10]),
  };

  const competitors = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 3) continue;

    const place = cols[0] || null;
    const lane = cols[2] ? parseInt(cols[2], 10) : null;
    const status = parseCompetitorStatus(place);
    const timeRaw = cols[6] || null;
    const timeMs = status ? null : parseFinishLynxTime(timeRaw);

    competitors.push({
      place,
      id: cols[1] || null,
      lane: Number.isFinite(lane) ? lane : null,
      lastName: cols[3] || "",
      firstName: cols[4] || "",
      affiliation: cols[5] || "",
      timeRaw,
      timeMs,
      status,
      splitsRaw: cols[10] || null,
      timeTrialStartRaw: cols[11] || null,
      timeTrialStartMs: parseTimeOfDayMs(cols[11]),
      isLikelyCompetitorRow:
        cols[2] !== "" && (status || isLikelyTimeValue(timeRaw) || place === ""),
    });
  }

  return { event, competitors };
}

module.exports = {
  parseLifContent,
  parseFinishLynxTime,
  parseTimeOfDayMs,
  mergeTimeWithDate,
  parseCompetitorStatus,
  FINISH_LYNX_STATUS_MAP,
};
